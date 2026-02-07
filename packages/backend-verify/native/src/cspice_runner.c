// Tiny CSPICE runner for backend-verify.
//
// Protocol:
//   stdin:  { setup: { kernels?: string[] }, call: string, args: any }
//   stdout: { ok:true, result:any } OR { ok:false, error:{ message, spiceShort?, spiceLong?, spiceTrace? } }
//
// Implements:
//   - call: "time.str2et" (args: [string])
//   - alias: "str2et"

#include "SpiceUsr.h"

#include <errno.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// --- Minimal JSON parsing via jsmn (public domain) --------------------------
// https://github.com/zserge/jsmn

typedef enum {
  JSMN_UNDEFINED = 0,
  JSMN_OBJECT = 1,
  JSMN_ARRAY = 2,
  JSMN_STRING = 3,
  JSMN_PRIMITIVE = 4
} jsmntype_t;

typedef struct {
  jsmntype_t type;
  int start;
  int end;
  int size;
#ifdef JSMN_PARENT_LINKS
  int parent;
#endif
} jsmntok_t;

typedef struct {
  unsigned int pos;
  unsigned int toknext;
  int toksuper;
} jsmn_parser;

static void jsmn_init(jsmn_parser *parser) {
  parser->pos = 0;
  parser->toknext = 0;
  parser->toksuper = -1;
}

static jsmntok_t *jsmn_alloc_token(jsmn_parser *parser, jsmntok_t *tokens,
                                  const size_t num_tokens) {
  if (parser->toknext >= num_tokens) {
    return NULL;
  }
  jsmntok_t *tok = &tokens[parser->toknext++];
  tok->start = tok->end = -1;
  tok->size = 0;
#ifdef JSMN_PARENT_LINKS
  tok->parent = -1;
#endif
  tok->type = JSMN_UNDEFINED;
  return tok;
}

static void jsmn_fill_token(jsmntok_t *token, const jsmntype_t type,
                            const int start, const int end) {
  token->type = type;
  token->start = start;
  token->end = end;
  token->size = 0;
}

static int jsmn_parse_primitive(jsmn_parser *parser, const char *js,
                                const size_t len, jsmntok_t *tokens,
                                const size_t num_tokens) {
  const int start = (int)parser->pos;

  for (; parser->pos < len; parser->pos++) {
    const char c = js[parser->pos];
    if (c == '\t' || c == '\r' || c == '\n' || c == ' ' || c == ',' || c == ']' ||
        c == '}') {
      jsmntok_t *tok = jsmn_alloc_token(parser, tokens, num_tokens);
      if (tok == NULL) {
        return -1;
      }
      jsmn_fill_token(tok, JSMN_PRIMITIVE, start, (int)parser->pos);
#ifdef JSMN_PARENT_LINKS
      tok->parent = parser->toksuper;
#endif
      parser->pos--;
      return 0;
    }
    if (c < 32 || c == '"' || c == '\\') {
      return -2;
    }
  }

  // Reached end.
  jsmntok_t *tok = jsmn_alloc_token(parser, tokens, num_tokens);
  if (tok == NULL) {
    return -1;
  }
  jsmn_fill_token(tok, JSMN_PRIMITIVE, start, (int)parser->pos);
#ifdef JSMN_PARENT_LINKS
  tok->parent = parser->toksuper;
#endif
  parser->pos--;
  return 0;
}

static int jsmn_parse_string(jsmn_parser *parser, const char *js, const size_t len,
                             jsmntok_t *tokens, const size_t num_tokens) {
  const int start = (int)parser->pos;

  parser->pos++;
  for (; parser->pos < len; parser->pos++) {
    const char c = js[parser->pos];

    if (c == '"') {
      jsmntok_t *tok = jsmn_alloc_token(parser, tokens, num_tokens);
      if (tok == NULL) {
        return -1;
      }
      jsmn_fill_token(tok, JSMN_STRING, start + 1, (int)parser->pos);
#ifdef JSMN_PARENT_LINKS
      tok->parent = parser->toksuper;
#endif
      return 0;
    }

    if (c == '\\') {
      parser->pos++;
      if (parser->pos >= len) {
        return -2;
      }
      // Skip escaped char.
      continue;
    }
  }

  return -2;
}

static int jsmn_parse(jsmn_parser *parser, const char *js, const size_t len,
                      jsmntok_t *tokens, const unsigned int num_tokens) {
  int r;
  int i;
  jsmntok_t *token;

  for (; parser->pos < len; parser->pos++) {
    const char c = js[parser->pos];

    switch (c) {
    case '{':
    case '[':
      token = jsmn_alloc_token(parser, tokens, num_tokens);
      if (token == NULL) {
        return -1;
      }
      if (parser->toksuper != -1) {
        tokens[parser->toksuper].size++;
#ifdef JSMN_PARENT_LINKS
        token->parent = parser->toksuper;
#endif
      }
      token->type = (c == '{' ? JSMN_OBJECT : JSMN_ARRAY);
      token->start = (int)parser->pos;
      parser->toksuper = (int)parser->toknext - 1;
      break;

    case '}':
    case ']':
      for (i = (int)parser->toknext - 1; i >= 0; i--) {
        token = &tokens[i];
        if (token->start != -1 && token->end == -1) {
          if ((token->type == JSMN_OBJECT && c == '}') ||
              (token->type == JSMN_ARRAY && c == ']')) {
            token->end = (int)parser->pos + 1;
            parser->toksuper = -1;
#ifdef JSMN_PARENT_LINKS
            parser->toksuper = token->parent;
#else
            // Find parent.
            for (int j = i - 1; j >= 0; j--) {
              if (tokens[j].start != -1 && tokens[j].end == -1) {
                parser->toksuper = j;
                break;
              }
            }
#endif
            break;
          } else {
            return -2;
          }
        }
      }
      if (i == -1) {
        return -2;
      }
      break;

    case '"':
      r = jsmn_parse_string(parser, js, len, tokens, num_tokens);
      if (r < 0) {
        return r;
      }
      if (parser->toksuper != -1) {
        tokens[parser->toksuper].size++;
      }
      break;

    case '\t':
    case '\r':
    case '\n':
    case ' ':
    case ':':
    case ',':
      break;

    default:
      r = jsmn_parse_primitive(parser, js, len, tokens, num_tokens);
      if (r < 0) {
        return r;
      }
      if (parser->toksuper != -1) {
        tokens[parser->toksuper].size++;
      }
      break;
    }
  }

  for (i = (int)parser->toknext - 1; i >= 0; i--) {
    // Unmatched opened object or array.
    if (tokens[i].start != -1 && tokens[i].end == -1) {
      return -2;
    }
  }

  return (int)parser->toknext;
}

static bool jsmn_token_streq(const char *json, const jsmntok_t *tok,
                             const char *s) {
  if (tok->type != JSMN_STRING) {
    return false;
  }
  const size_t len = (size_t)(tok->end - tok->start);
  return strlen(s) == len && strncmp(json + tok->start, s, len) == 0;
}

// Return index of the value token for `key` within object token at objIndex.
// Returns -1 if not found or invalid.
static int jsmn_skip_subtree(const jsmntok_t *tokens, const int index,
                             const int tokenCount) {
  if (index < 0 || index >= tokenCount) {
    return tokenCount;
  }

  const jsmntok_t *t = &tokens[index];

  int i = index + 1;
  if (t->type == JSMN_OBJECT) {
    const int pairs = t->size / 2;
    for (int p = 0; p < pairs; p++) {
      // key
      i = jsmn_skip_subtree(tokens, i, tokenCount);
      // value
      i = jsmn_skip_subtree(tokens, i, tokenCount);
    }
    return i;
  }

  if (t->type == JSMN_ARRAY) {
    for (int p = 0; p < t->size; p++) {
      i = jsmn_skip_subtree(tokens, i, tokenCount);
    }
    return i;
  }

  // String/primitive
  return i;
}

static int jsmn_find_object_key(const char *json, const jsmntok_t *tokens,
                                const int objIndex, const char *key,
                                const int tokenCount) {
  if (objIndex < 0 || objIndex >= tokenCount) {
    return -1;
  }

  const jsmntok_t *obj = &tokens[objIndex];
  if (obj->type != JSMN_OBJECT) {
    return -1;
  }

  int i = objIndex + 1;
  const int pairs = obj->size / 2;
  for (int p = 0; p < pairs; p++) {
    if (i >= tokenCount) {
      return -1;
    }

    const jsmntok_t *k = &tokens[i];
    const int valIndex = i + 1;
    if (valIndex >= tokenCount) {
      return -1;
    }
    if (jsmn_token_streq(json, k, key)) {
      return valIndex;
    }

    // Skip key token.
    i++;
    // Skip value subtree.
    i = jsmn_skip_subtree(tokens, i, tokenCount);
  }

  return -1;
}

// Return index of array element `elemIndex` within array token at `arrayIndex`.
// Returns -1 if out of bounds or invalid.
static int jsmn_get_array_elem(const jsmntok_t *tokens, const int arrayIndex,
                               const int elemIndex, const int tokenCount) {
  if (arrayIndex < 0 || arrayIndex >= tokenCount) {
    return -1;
  }
  const jsmntok_t *arr = &tokens[arrayIndex];
  if (arr->type != JSMN_ARRAY) {
    return -1;
  }
  if (elemIndex < 0 || elemIndex >= arr->size) {
    return -1;
  }

  int i = arrayIndex + 1;
  for (int e = 0; e < arr->size; e++) {
    if (i >= tokenCount) {
      return -1;
    }
    if (e == elemIndex) {
      return i;
    }
    i = jsmn_skip_subtree(tokens, i, tokenCount);
  }

  return -1;
}

static char *jsmn_strdup(const char *json, const jsmntok_t *tok) {
  if (tok->type != JSMN_STRING) {
    return NULL;
  }
  const int n = tok->end - tok->start;
  if (n < 0) {
    return NULL;
  }
  char *s = (char *)malloc((size_t)n + 1);
  if (s == NULL) {
    return NULL;
  }
  memcpy(s, json + tok->start, (size_t)n);
  s[n] = '\0';
  return s;
}

// --- JSON output helpers ----------------------------------------------------

static void json_print_escaped(const char *s) {
  // JSON string value (no surrounding quotes).
  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    const unsigned char c = *p;
    switch (c) {
    case '"':
      fputs("\\\"", stdout);
      break;
    case '\\':
      fputs("\\\\", stdout);
      break;
    case '\b':
      fputs("\\b", stdout);
      break;
    case '\f':
      fputs("\\f", stdout);
      break;
    case '\n':
      fputs("\\n", stdout);
      break;
    case '\r':
      fputs("\\r", stdout);
      break;
    case '\t':
      fputs("\\t", stdout);
      break;
    default:
      if (c < 0x20) {
        // Control chars -> \u00XX
        fprintf(stdout, "\\u%04x", (unsigned int)c);
      } else {
        fputc((int)c, stdout);
      }
    }
  }
}

static void json_print_string_field(const char *key, const char *value,
                                    bool *first) {
  if (value == NULL || value[0] == '\0') {
    return;
  }
  if (!*first) {
    fputc(',', stdout);
  }
  *first = false;

  fputc('"', stdout);
  json_print_escaped(key);
  fputs("\":\"", stdout);
  json_print_escaped(value);
  fputc('"', stdout);
}

static void write_error_json(const char *message, const char *spiceShort,
                             const char *spiceLong, const char *spiceTrace) {
  fputs("{\"ok\":false,\"error\":{", stdout);

  bool first = true;
  json_print_string_field("message", message ? message : "error", &first);
  json_print_string_field("spiceShort", spiceShort, &first);
  json_print_string_field("spiceLong", spiceLong, &first);
  json_print_string_field("spiceTrace", spiceTrace, &first);

  fputs("}}\n", stdout);
}

#define CSPICE_RUNNER_MAX_STDIN_BYTES (1024 * 1024)

static char *read_all_stdin(size_t *outLen) {
  *outLen = 0;
  // Ensure callers don't accidentally classify failures based on a stale errno.
  errno = 0;

  size_t cap = 4096;
  if (cap > (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES + 1) {
    cap = (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES + 1;
  }

  char *buf = (char *)malloc(cap);
  if (!buf) {
    errno = ENOMEM;
    return NULL;
  }

  size_t len = 0;
  while (1) {
    if (len + 1 >= cap) {
      if (cap >= (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES + 1) {
        // Input too large.
        errno = EOVERFLOW;
        free(buf);
        return NULL;
      }

      // Grow with overflow guard, but never beyond the max.
      size_t nextCap = cap * 2;
      if (nextCap < cap) {
        errno = EOVERFLOW;
        free(buf);
        return NULL;
      }
      if (nextCap > (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES + 1) {
        nextCap = (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES + 1;
      }

      char *next = (char *)realloc(buf, nextCap);
      if (!next) {
        errno = ENOMEM;
        free(buf);
        return NULL;
      }
      buf = next;
      cap = nextCap;
    }

    size_t n = fread(buf + len, 1, cap - len - 1, stdin);
    len += n;

    if (len > (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES) {
      errno = EOVERFLOW;
      free(buf);
      return NULL;
    }

    if (n == 0) {
      if (ferror(stdin)) {
        if (errno == 0) {
          errno = EIO;
        }
        free(buf);
        return NULL;
      }
      break;
    }
  }

  buf[len] = '\0';
  *outLen = len;
  return buf;
}

static void capture_spice_error(char *shortMsg, size_t shortBytes,
                                char *longMsg, size_t longBytes,
                                char *traceMsg, size_t traceBytes) {
  if (shortMsg && shortBytes > 0) {
    shortMsg[0] = '\0';
    getmsg_c("SHORT", (SpiceInt)shortBytes, shortMsg);
  }
  if (longMsg && longBytes > 0) {
    longMsg[0] = '\0';
    getmsg_c("LONG", (SpiceInt)longBytes, longMsg);
  }
  if (traceMsg && traceBytes > 0) {
    traceMsg[0] = '\0';
    qcktrc_c((SpiceInt)traceBytes, traceMsg);
  }
}

int main(void) {
  size_t inputLen = 0;
  char *input = read_all_stdin(&inputLen);
  if (input == NULL) {
    if (errno == EOVERFLOW) {
      write_error_json("stdin too large", NULL, NULL, NULL);
    } else {
      write_error_json("Failed to read stdin", NULL, NULL, NULL);
    }
    return 0;
  }

  // Parse JSON.
  int tokenCap = 256;
  jsmntok_t *tokens = NULL;
  int tokenCount = 0;

  while (1) {
    tokens = (jsmntok_t *)malloc(sizeof(jsmntok_t) * (size_t)tokenCap);
    if (tokens == NULL) {
      free(input);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return 0;
    }

    jsmn_parser p;
    jsmn_init(&p);
    tokenCount = jsmn_parse(&p, input, inputLen, tokens, (unsigned int)tokenCap);
    if (tokenCount >= 0) {
      break;
    }

    free(tokens);
    tokens = NULL;

    if (tokenCount == -1) {
      tokenCap *= 2;
      if (tokenCap > 8192) {
        free(input);
        write_error_json("JSON too large/complex", NULL, NULL, NULL);
        return 0;
      }
      continue;
    }

    free(input);
    write_error_json("Invalid JSON", NULL, NULL, NULL);
    return 0;
  }

  if (tokenCount < 1 || tokens[0].type != JSMN_OBJECT) {
    free(tokens);
    free(input);
    write_error_json("Input JSON must be an object", NULL, NULL, NULL);
    return 0;
  }

  int callTok = jsmn_find_object_key(input, tokens, 0, "call", tokenCount);
  int argsTok = jsmn_find_object_key(input, tokens, 0, "args", tokenCount);
  int setupTok = jsmn_find_object_key(input, tokens, 0, "setup", tokenCount);

  if (callTok < 0) {
    free(tokens);
    free(input);
    write_error_json("Missing required field: call", NULL, NULL, NULL);
    return 0;
  }

  char *call = jsmn_strdup(input, &tokens[callTok]);
  if (call == NULL) {
    free(tokens);
    free(input);
    write_error_json("call must be a string", NULL, NULL, NULL);
    return 0;
  }

  // --- Per-case isolation + error policy.
  kclear_c();
  reset_c();
  erract_c("SET", 0, "RETURN");
  errprt_c("SET", 0, "NONE");

  // Setup: load kernels if provided.
  if (setupTok >= 0 && tokens[setupTok].type == JSMN_OBJECT) {
    int kernelsTok = jsmn_find_object_key(input, tokens, setupTok, "kernels", tokenCount);
    if (kernelsTok >= 0) {
      if (tokens[kernelsTok].type != JSMN_ARRAY) {
        write_error_json("setup.kernels must be an array of strings", NULL, NULL, NULL);
        goto done;
      }

      int nKernels = tokens[kernelsTok].size;
      int idx = kernelsTok + 1;
      for (int i = 0; i < nKernels; i++) {
        if (idx >= tokenCount) {
          write_error_json("setup.kernels parse error", NULL, NULL, NULL);
          goto done;
        }
        if (tokens[idx].type != JSMN_STRING) {
          write_error_json("setup.kernels must contain only strings", NULL, NULL, NULL);
          goto done;
        }

        char *kernel = jsmn_strdup(input, &tokens[idx]);
        if (kernel == NULL) {
          write_error_json("Out of memory", NULL, NULL, NULL);
          goto done;
        }

        furnsh_c(kernel);
        free(kernel);

        if (failed_c() == SPICETRUE) {
          char shortMsg[1841];
          char longMsg[1841];
          char traceMsg[1841];
          capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                              traceMsg, sizeof(traceMsg));
          write_error_json("SPICE error in furnsh", shortMsg, longMsg, traceMsg);
          goto done;
        }

        idx = jsmn_skip_subtree(tokens, idx, tokenCount);
      }
    }
  }

  if (argsTok < 0) {
    write_error_json("Missing required field: args", NULL, NULL, NULL);
    goto done;
  }

  if (tokens[argsTok].type != JSMN_ARRAY) {
    write_error_json("args must be an array", NULL, NULL, NULL);
    goto done;
  }

  const bool isStr2et = strcmp(call, "time.str2et") == 0 || strcmp(call, "str2et") == 0;

  if (!isStr2et) {
    write_error_json("Unsupported call", NULL, NULL, NULL);
    goto done;
  }

  if (tokens[argsTok].size < 1) {
    write_error_json("time.str2et expects args[0] to be a string", NULL, NULL, NULL);
    goto done;
  }

  int arg0Tok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
  if (arg0Tok < 0 || arg0Tok >= tokenCount || tokens[arg0Tok].type != JSMN_STRING) {
    write_error_json("time.str2et expects args[0] to be a string", NULL, NULL, NULL);
    goto done;
  }

  char *timeStr = jsmn_strdup(input, &tokens[arg0Tok]);
  if (timeStr == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    goto done;
  }

  SpiceDouble et = 0.0;
  str2et_c(timeStr, &et);
  free(timeStr);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                        sizeof(traceMsg));
    write_error_json("SPICE error in str2et", shortMsg, longMsg, traceMsg);
    goto done;
  }

  // Success.
  fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)et);

done:
  // Clear state even though this is a single-shot process.
  kclear_c();
  reset_c();

  free(call);
  free(tokens);
  free(input);
  return 0;
}
