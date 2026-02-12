// Tiny CSPICE runner for backend-verify.
//
// Protocol:
//   stdin:  { setup: { kernels?: (string | { path: string, restrictToDir?: string })[] }, call: string, args: any }
//   stdout: { ok:true, result:any } OR { ok:false, error:{ message, spiceShort?, spiceLong?, spiceTrace? } }
//
// Implements:
//   - time.str2et (alias: str2et) args: [string] -> number
//   - time.et2utc (alias: et2utc) args: [number, string, number] -> string
//   - ids-names.bodn2c (alias: bodn2c) args: [string] -> {found, code?}
//   - ids-names.bodc2n (alias: bodc2n) args: [number] -> {found, name?}
//   - frames.namfrm (alias: namfrm) args: [string] -> {found, code?}
//   - frames.frmnam (alias: frmnam) args: [number] -> {found, name?}
//   - frames.pxform (alias: pxform) args: [string, string, number] -> number[9] (row-major)

#include "SpiceUsr.h"

#include <math.h>

#include <ctype.h>
#include <errno.h>
#include <inttypes.h>
#include <limits.h>
#include <locale.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>

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

// NOTE: This embedded jsmn variant increments `tok->size` once per *child token*.
//
// For arrays, `tok->size` is the element count.
// For objects, `tok->size` is the number of child tokens (key + value tokens),
// i.e. `2 * pairCount`.
static int jsmn_object_pair_count(const jsmntok_t *t) {
  if (t->type != JSMN_OBJECT) {
    return -1;
  }
  if (t->size < 0 || (t->size % 2) != 0) {
    return -1;
  }
  return t->size / 2;
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
    const int pairs = jsmn_object_pair_count(t);
    if (pairs < 0) {
      return tokenCount;
    }
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
  const int pairs = jsmn_object_pair_count(obj);
  if (pairs < 0) {
    return -1;
  }
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

typedef enum {
  JSMN_STRDUP_OK = 0,
  JSMN_STRDUP_OOM,
  JSMN_STRDUP_INVALID,
} jsmn_strdup_err_t;

static int json_hex_nibble(const unsigned char c) {
  if (c >= '0' && c <= '9') {
    return (int)(c - '0');
  }
  if (c >= 'a' && c <= 'f') {
    return (int)(c - 'a') + 10;
  }
  if (c >= 'A' && c <= 'F') {
    return (int)(c - 'A') + 10;
  }
  return -1;
}

static bool json_parse_hex4(const char *s, uint16_t *out) {
  uint16_t v = 0;
  for (int i = 0; i < 4; i++) {
    const int n = json_hex_nibble((unsigned char)s[i]);
    if (n < 0) {
      return false;
    }
    v = (uint16_t)((v << 4) | (uint16_t)n);
  }
  *out = v;
  return true;
}

static bool json_write_utf8(char *dst, const size_t dstCap, size_t *dstLen,
                            const uint32_t codepoint) {
  if (codepoint == 0) {
    // The runner uses NUL-terminated C strings, so embedded NUL can't be
    // represented safely.
    return false;
  }

  if (codepoint <= 0x7F) {
    if (*dstLen + 1 > dstCap) {
      return false;
    }
    dst[(*dstLen)++] = (char)codepoint;
    return true;
  }

  if (codepoint <= 0x7FF) {
    if (*dstLen + 2 > dstCap) {
      return false;
    }
    dst[(*dstLen)++] = (char)(0xC0 | (codepoint >> 6));
    dst[(*dstLen)++] = (char)(0x80 | (codepoint & 0x3F));
    return true;
  }

  if (codepoint <= 0xFFFF) {
    if (codepoint >= 0xD800 && codepoint <= 0xDFFF) {
      // Surrogate halves are not valid Unicode scalar values.
      return false;
    }
    if (*dstLen + 3 > dstCap) {
      return false;
    }
    dst[(*dstLen)++] = (char)(0xE0 | (codepoint >> 12));
    dst[(*dstLen)++] = (char)(0x80 | ((codepoint >> 6) & 0x3F));
    dst[(*dstLen)++] = (char)(0x80 | (codepoint & 0x3F));
    return true;
  }

  if (codepoint <= 0x10FFFF) {
    if (*dstLen + 4 > dstCap) {
      return false;
    }
    dst[(*dstLen)++] = (char)(0xF0 | (codepoint >> 18));
    dst[(*dstLen)++] = (char)(0x80 | ((codepoint >> 12) & 0x3F));
    dst[(*dstLen)++] = (char)(0x80 | ((codepoint >> 6) & 0x3F));
    dst[(*dstLen)++] = (char)(0x80 | (codepoint & 0x3F));
    return true;
  }

  return false;
}

static jsmn_strdup_err_t jsmn_strdup(const char *json, const jsmntok_t *tok,
                                     char **out,
                                     char *errDetail,
                                     const size_t errDetailBytes) {
  *out = NULL;
  if (tok->type != JSMN_STRING) {
    return JSMN_STRDUP_INVALID;
  }

  const int n = tok->end - tok->start;
  if (n < 0) {
    return JSMN_STRDUP_INVALID;
  }

  // Unescaping always shrinks or keeps the same size, so `n + 1` is safe.
  char *s = (char *)malloc((size_t)n + 1);
  if (s == NULL) {
    return JSMN_STRDUP_OOM;
  }

  const char *p = json + tok->start;
  const char *end = json + tok->start + n;
  size_t outLen = 0;

  while (p < end) {
    const unsigned char c = (unsigned char)*p++;

    if (c == '\\') {
      if (p >= end) {
        if (errDetail && errDetailBytes > 0) {
          snprintf(errDetail, errDetailBytes,
                   "Invalid JSON string: trailing backslash");
        }
        free(s);
        return JSMN_STRDUP_INVALID;
      }

      const unsigned char esc = (unsigned char)*p++;
      switch (esc) {
      case '"':
        s[outLen++] = '"';
        break;
      case '\\':
        s[outLen++] = '\\';
        break;
      case '/':
        s[outLen++] = '/';
        break;
      case 'b':
        s[outLen++] = '\b';
        break;
      case 'f':
        s[outLen++] = '\f';
        break;
      case 'n':
        s[outLen++] = '\n';
        break;
      case 'r':
        s[outLen++] = '\r';
        break;
      case 't':
        s[outLen++] = '\t';
        break;
      case 'u': {
        if (end - p < 4) {
          if (errDetail && errDetailBytes > 0) {
            snprintf(errDetail, errDetailBytes,
                     "Invalid JSON string escape: \\u must be followed by 4 hex digits");
          }
          free(s);
          return JSMN_STRDUP_INVALID;
        }

        uint16_t unit = 0;
        if (!json_parse_hex4(p, &unit)) {
          if (errDetail && errDetailBytes > 0) {
            snprintf(errDetail, errDetailBytes,
                     "Invalid JSON string escape: \\u must be followed by 4 hex digits");
          }
          free(s);
          return JSMN_STRDUP_INVALID;
        }
        p += 4;

        uint32_t codepoint = (uint32_t)unit;
        if (unit >= 0xD800 && unit <= 0xDBFF) {
          // High surrogate: must be followed by a low surrogate.
          if (end - p < 6 || p[0] != '\\' || p[1] != 'u') {
            if (errDetail && errDetailBytes > 0) {
              snprintf(errDetail, errDetailBytes,
                       "Invalid JSON string escape: high surrogate must be followed by a \\uXXXX low surrogate");
            }
            free(s);
            return JSMN_STRDUP_INVALID;
          }

          uint16_t unit2 = 0;
          if (!json_parse_hex4(p + 2, &unit2)) {
            if (errDetail && errDetailBytes > 0) {
              snprintf(errDetail, errDetailBytes,
                       "Invalid JSON string escape: high surrogate must be followed by valid low surrogate");
            }
            free(s);
            return JSMN_STRDUP_INVALID;
          }
          if (unit2 < 0xDC00 || unit2 > 0xDFFF) {
            if (errDetail && errDetailBytes > 0) {
              snprintf(errDetail, errDetailBytes,
                       "Invalid JSON string escape: high surrogate must be followed by low surrogate (got 0x%04x)",
                       (unsigned int)unit2);
            }
            free(s);
            return JSMN_STRDUP_INVALID;
          }

          p += 6;

          codepoint = 0x10000u + (((uint32_t)unit - 0xD800u) << 10) +
                      ((uint32_t)unit2 - 0xDC00u);
        } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
          // Low surrogate without a preceding high surrogate.
          if (errDetail && errDetailBytes > 0) {
            snprintf(errDetail, errDetailBytes,
                     "Invalid JSON string escape: unexpected low surrogate (0x%04x)",
                     (unsigned int)unit);
          }
          free(s);
          return JSMN_STRDUP_INVALID;
        }

        if (!json_write_utf8(s, (size_t)n, &outLen, codepoint)) {
          if (errDetail && errDetailBytes > 0) {
            snprintf(errDetail, errDetailBytes,
                     "Invalid JSON string escape: invalid Unicode code point");
          }
          free(s);
          return JSMN_STRDUP_INVALID;
        }

        break;
      }

      default:
        if (errDetail && errDetailBytes > 0) {
          snprintf(errDetail, errDetailBytes,
                   "Invalid JSON string escape: \\%c is not allowed",
                   (int)esc);
        }
        free(s);
        return JSMN_STRDUP_INVALID;
      }

      continue;
    }

    if (c < 0x20) {
      if (errDetail && errDetailBytes > 0) {
        snprintf(errDetail, errDetailBytes,
                 "Invalid JSON string: unescaped control character (0x%02x)",
                 (unsigned int)c);
      }
      free(s);
      return JSMN_STRDUP_INVALID;
    }

    s[outLen++] = (char)c;
  }

  s[outLen] = '\0';
  *out = s;
  return JSMN_STRDUP_OK;
}

// Strict JSON number grammar (RFC 8259):
//   number = [ "-" ] int [ frac ] [ exp ]
//   int = "0" / ( digit1-9 *digit )
//   frac = "." 1*digit
//   exp = ("e" / "E") ["+" / "-"] 1*digit
//
// This intentionally rejects:
//   - leading '+'
//   - any whitespace
//   - leading zeros in the integer part (except "0")
//   - missing digits after '.' or exponent marker

static const char *scan_strict_json_int_part(const char *s) {
  if (s == NULL || s[0] == '\0') {
    return NULL;
  }

  const char *p = s;

  // No leading '+' in JSON.
  if (*p == '+') {
    return NULL;
  }

  if (*p == '-') {
    p++;
  }

  if (*p == '\0') {
    return NULL;
  }

  if (*p == '0') {
    p++;
    // No leading zeros like "01".
    if (*p >= '0' && *p <= '9') {
      return NULL;
    }
    return p;
  }

  if (*p < '1' || *p > '9') {
    return NULL;
  }

  for (p = p + 1; *p >= '0' && *p <= '9'; p++) {
    // consume digits
  }

  return p;
}

static bool is_strict_json_number_literal(const char *s) {
  if (s == NULL || s[0] == '\0') {
    return false;
  }

  // Reject any whitespace anywhere. (`strtod` accepts it.)
  for (const char *q = s; *q; q++) {
    if (isspace((unsigned char)*q)) {
      return false;
    }
  }

  const char *p = scan_strict_json_int_part(s);
  if (p == NULL) {
    return false;
  }

  // frac
  if (*p == '.') {
    p++;
    if (*p < '0' || *p > '9') {
      return false;
    }
    for (p = p + 1; *p >= '0' && *p <= '9'; p++) {
      // consume digits
    }
  }

  // exp
  if (*p == 'e' || *p == 'E') {
    p++;
    if (*p == '+' || *p == '-') {
      p++;
    }
    if (*p < '0' || *p > '9') {
      return false;
    }
    for (p = p + 1; *p >= '0' && *p <= '9'; p++) {
      // consume digits
    }
  }

  return *p == '\0';
}


typedef enum {
  PARSE_OK = 0,
  PARSE_INVALID,
  PARSE_TOO_LONG,
  PARSE_OUT_OF_RANGE,
  PARSE_UNSUPPORTED,
} parse_result;


static parse_result jsmn_parse_double(const char *json, const jsmntok_t *tok,
                                      SpiceDouble *out) {
  if (tok->type != JSMN_PRIMITIVE) {
    return PARSE_INVALID;
  }

  const int n = tok->end - tok->start;
  if (n <= 0) {
    return PARSE_INVALID;
  }
  if (n >= 128) {
    return PARSE_TOO_LONG;
  }

  char buf[128];
  memcpy(buf, json + tok->start, (size_t)n);
  buf[n] = '\0';

  // `LC_NUMERIC` is set to "C" once at process startup (see main()) so that
  // numeric parsing is locale-stable (decimal separator is '.').

  // Make JSON-number parsing deterministic and strict. `strtod` accepts leading
  // whitespace and a leading '+', which are not valid JSON.
  if (!is_strict_json_number_literal(buf)) {
    return PARSE_INVALID;
  }

  errno = 0;
  char *endptr = NULL;
  const double v = strtod(buf, &endptr);
  if (endptr == buf || *endptr != '\0') {
    return PARSE_INVALID;
  }

  if (errno == ERANGE) {
    return PARSE_OUT_OF_RANGE;
  }
  if (errno != 0) {
    return PARSE_INVALID;
  }

  if (!isfinite(v)) {
    return PARSE_OUT_OF_RANGE;
  }

  *out = (SpiceDouble)v;
  return PARSE_OK;
}

// Strict JSON integer grammar (RFC 8259):
//   int = "0" / ( digit1-9 *digit )
//   number = [ "-" ] int [ frac ] [ exp ]
// For the runner we only accept the integer subset and reject leading '+',
// whitespace, and leading zeros (except for the single literal "0").
static bool is_strict_json_int_literal(const char *s) {
  const char *p = scan_strict_json_int_part(s);
  return p != NULL && *p == '\0';
}

static parse_result jsmn_parse_int(const char *json, const jsmntok_t *tok,
                                   SpiceInt *out) {
  // Defensive: ensure SpiceInt can round-trip through long long on this ABI.
  // If it can't, parsing via strtoll() can't be made safe/portable.
  if (sizeof(SpiceInt) > sizeof(long long)) {
    return PARSE_UNSUPPORTED;
  }

  if (tok->type != JSMN_PRIMITIVE) {
    return PARSE_INVALID;
  }

  const int n = tok->end - tok->start;
  if (n <= 0) {
    return PARSE_INVALID;
  }
  if (n >= 128) {
    return PARSE_TOO_LONG;
  }

  char buf[128];
  memcpy(buf, json + tok->start, (size_t)n);
  buf[n] = '\0';

  if (!is_strict_json_int_literal(buf)) {
    return PARSE_INVALID;
  }

  errno = 0;
  char *endptr = NULL;
  const long long v = strtoll(buf, &endptr, 10);
  if (errno != 0) {
    return PARSE_INVALID;
  }
  if (endptr == buf || *endptr != '\0') {
    return PARSE_INVALID;
  }

  // Defensive: ensure the parsed value round-trips into SpiceInt.
  SpiceInt tmp = (SpiceInt)v;
  if ((long long)tmp != v) {
    return PARSE_INVALID;
  }

  *out = tmp;
  return PARSE_OK;
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

static void write_error_json_ex(const char *code, const char *message,
                                const char *detail, const char *spiceShort,
                                const char *spiceLong, const char *spiceTrace) {
  fputs("{\"ok\":false,\"error\":{", stdout);

  bool first = true;
  json_print_string_field("code", code, &first);
  json_print_string_field("message", message ? message : "error", &first);
  json_print_string_field("detail", detail, &first);
  json_print_string_field("spiceShort", spiceShort, &first);
  json_print_string_field("spiceLong", spiceLong, &first);
  json_print_string_field("spiceTrace", spiceTrace, &first);

  fputs("}}\n", stdout);
}

static void write_error_json(const char *message, const char *spiceShort,
                             const char *spiceLong, const char *spiceTrace) {
  write_error_json_ex(NULL, message, NULL, spiceShort, spiceLong, spiceTrace);
}

static void write_unsupported_spiceint_width_error(void) {
  char detail[128];
  snprintf(detail, sizeof(detail), "sizeof(SpiceInt)=%zu (expected <= sizeof(long long)=%zu)",
           sizeof(SpiceInt), sizeof(long long));
  write_error_json_ex(
      "unsupported_spiceint_width",
      "Unsupported platform ABI: unsupported SpiceInt width",
      detail,
      NULL,
      NULL,
      NULL);
}

#define CSPICE_RUNNER_MAX_STDIN_BYTES (1024 * 1024)

typedef enum {
  READ_STDIN_OK = 0,
  READ_STDIN_TOO_LARGE,
  READ_STDIN_OOM,
  READ_STDIN_IO,
  READ_STDIN_OVERFLOW,
} ReadStdinErr;

static ReadStdinErr read_all_stdin(char **outBuf, size_t *outLen) {
  *outBuf = NULL;
  *outLen = 0;
  // Ensure error detail never uses stale errno.
  errno = 0;

  const size_t maxBytes = (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES;
  // Read 1 extra byte beyond the budget as a deterministic overflow sentinel.
  const size_t maxRead = maxBytes + 1;
  // +1 for the trailing NUL terminator.
  const size_t maxCap = maxRead + 1;

  if (maxRead <= maxBytes || maxCap <= maxRead) {
    return READ_STDIN_OVERFLOW;
  }

  size_t cap = 4096;
  if (cap > maxCap) {
    cap = maxCap;
  }

  char *buf = (char *)malloc(cap);
  if (!buf) {
    return READ_STDIN_OOM;
  }

  size_t len = 0;
  while (len < maxRead) {

    // Ensure there is always room for at least 1 more byte and the trailing NUL.
    if (len + 1 >= cap) {
      // Grow with overflow guard, but never beyond the max.
      size_t nextCap = cap * 2;
      if (nextCap < cap) {
        free(buf);
        return READ_STDIN_OVERFLOW;
      }
      if (nextCap > maxCap) {
        nextCap = maxCap;
      }
      if (nextCap <= cap) {
        free(buf);
        return READ_STDIN_OVERFLOW;
      }

      char *next = (char *)realloc(buf, nextCap);
      if (!next) {
        free(buf);
        return READ_STDIN_OOM;
      }
      buf = next;
      cap = nextCap;
    }

    const size_t remainingBudget = maxRead - len;
    const size_t remainingBuf = cap - len - 1;
    const size_t toRead =
        remainingBuf < remainingBudget ? remainingBuf : remainingBudget;

    size_t n = fread(buf + len, 1, toRead, stdin);
    len += n;

    if (len > maxBytes) {
      free(buf);
      return READ_STDIN_TOO_LARGE;
    }

    if (n < toRead) {
      if (ferror(stdin)) {
        if (errno == 0) {
          errno = EIO;
        }
        free(buf);
        return READ_STDIN_IO;
      }
      break;
    }
  }

  buf[len] = '\0';
  *outBuf = buf;
  *outLen = len;
  return READ_STDIN_OK;
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
  int exitCode = 0;

  // Ensure numeric parsing is locale-stable (decimal separator is '.')
  // regardless of the environment.
  if (setlocale(LC_NUMERIC, "C") == NULL) {
    write_error_json_ex(
        "locale_init",
        "Failed to set process numeric locale (LC_NUMERIC) to 'C'",
        "setlocale(LC_NUMERIC, 'C') returned NULL",
        NULL,
        NULL,
        NULL);
    return 1;
  }

  size_t inputLen = 0;
  char *input = NULL;
  ReadStdinErr readErr = read_all_stdin(&input, &inputLen);
  if (readErr != READ_STDIN_OK) {
    switch (readErr) {
    case READ_STDIN_TOO_LARGE: {
      char msg[128];
      snprintf(msg, sizeof(msg), "stdin too large (max %zu bytes)",
               (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES);
      write_error_json_ex("stdin_too_large", msg, NULL, NULL, NULL, NULL);
      break;
    }
    case READ_STDIN_OOM:
      write_error_json_ex("stdin_oom", "Out of memory while reading stdin", NULL,
                          NULL, NULL, NULL);
      exitCode = 1;
      break;
    case READ_STDIN_IO: {
      const char *detail = errno != 0 ? strerror(errno) : NULL;
      write_error_json_ex("stdin_io", "Failed to read stdin", detail, NULL, NULL,
                          NULL);
      exitCode = 1;
      break;
    }
    case READ_STDIN_OVERFLOW:
      write_error_json_ex("stdin_overflow",
                          "Internal overflow while reading stdin", NULL, NULL,
                          NULL, NULL);
      exitCode = 1;
      break;
    default:
      write_error_json_ex("stdin_error", "Failed to read stdin", NULL, NULL, NULL,
                          NULL);
      exitCode = 1;
      break;
    }
    return exitCode;
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
      return 1;
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
        write_error_json_ex("invalid_request", "JSON too large/complex", NULL,
                            NULL, NULL, NULL);
        return 0;
      }
      continue;
    }

    free(input);
    write_error_json_ex("invalid_request", "Invalid JSON", NULL, NULL, NULL,
                        NULL);
    return 0;
  }

  if (tokenCount < 1 || tokens[0].type != JSMN_OBJECT) {
    free(tokens);
    free(input);
    write_error_json_ex("invalid_request", "Input JSON must be an object", NULL,
                        NULL, NULL, NULL);
    return 0;
  }

  int callTok = jsmn_find_object_key(input, tokens, 0, "call", tokenCount);
  int argsTok = jsmn_find_object_key(input, tokens, 0, "args", tokenCount);
  int setupTok = jsmn_find_object_key(input, tokens, 0, "setup", tokenCount);

  if (callTok < 0) {
    free(tokens);
    free(input);
    write_error_json_ex("invalid_request", "Missing required field: call", NULL,
                        NULL, NULL, NULL);
    return 0;
  }

  if (tokens[callTok].type != JSMN_STRING) {
    free(tokens);
    free(input);
    write_error_json_ex("invalid_request", "call must be a string", NULL, NULL,
                        NULL, NULL);
    return 0;
  }

  char *call = NULL;
  char strDetail[256];
  strDetail[0] = '\0';
  jsmn_strdup_err_t callErr =
      jsmn_strdup(input, &tokens[callTok], &call, strDetail, sizeof(strDetail));
  if (callErr != JSMN_STRDUP_OK) {
    free(tokens);
    free(input);
    if (callErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
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
        write_error_json_ex("invalid_request", "setup.kernels must be an array",
                            NULL, NULL, NULL, NULL);
        goto done;
      }

      int nKernels = tokens[kernelsTok].size;
      int idx = kernelsTok + 1;
      for (int i = 0; i < nKernels; i++) {
        if (idx >= tokenCount) {
          write_error_json_ex("invalid_request", "setup.kernels parse error",
                              NULL, NULL, NULL, NULL);
          goto done;
        }

        char *kernelPath = NULL;
        char *restrictToDir = NULL;

        if (tokens[idx].type == JSMN_STRING) {
          strDetail[0] = '\0';
          jsmn_strdup_err_t kErr =
              jsmn_strdup(input, &tokens[idx], &kernelPath, strDetail, sizeof(strDetail));
          if (kErr != JSMN_STRDUP_OK) {
            if (kErr == JSMN_STRDUP_INVALID) {
              write_error_json_ex("invalid_request", "Invalid JSON string escape",
                                  strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
            } else {
              write_error_json("Out of memory", NULL, NULL, NULL);
            }
            goto done;
          }
        } else if (tokens[idx].type == JSMN_OBJECT) {
          int pathTok = jsmn_find_object_key(input, tokens, idx, "path", tokenCount);
          if (pathTok < 0 || tokens[pathTok].type != JSMN_STRING) {
            write_error_json_ex(
                "invalid_request",
                "setup.kernels entries must have a string 'path' field",
                NULL,
                NULL,
                NULL,
                NULL);
            goto done;
          }

          strDetail[0] = '\0';
          jsmn_strdup_err_t pathErr =
              jsmn_strdup(input, &tokens[pathTok], &kernelPath, strDetail, sizeof(strDetail));
          if (pathErr != JSMN_STRDUP_OK) {
            if (pathErr == JSMN_STRDUP_INVALID) {
              write_error_json_ex("invalid_request", "Invalid JSON string escape",
                                  strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
            } else {
              write_error_json("Out of memory", NULL, NULL, NULL);
            }
            goto done;
          }

          int restrictTok = jsmn_find_object_key(input, tokens, idx, "restrictToDir", tokenCount);
          if (restrictTok >= 0) {
            if (tokens[restrictTok].type != JSMN_STRING) {
              write_error_json_ex(
                  "invalid_request",
                  "setup.kernels[].restrictToDir must be a string",
                  NULL,
                  NULL,
                  NULL,
                  NULL);
              free(kernelPath);
              goto done;
            }

            strDetail[0] = '\0';
            jsmn_strdup_err_t restrictErr = jsmn_strdup(input, &tokens[restrictTok],
                                                       &restrictToDir, strDetail,
                                                       sizeof(strDetail));
            if (restrictErr != JSMN_STRDUP_OK) {
              if (restrictErr == JSMN_STRDUP_INVALID) {
                write_error_json_ex("invalid_request", "Invalid JSON string escape",
                                    strDetail[0] ? strDetail : NULL, NULL, NULL,
                                    NULL);
              } else {
                write_error_json("Out of memory", NULL, NULL, NULL);
              }
              free(kernelPath);
              goto done;
            }
          }
        } else {
          write_error_json_ex(
              "invalid_request",
              "setup.kernels entries must be strings or objects",
              NULL,
              NULL,
              NULL,
              NULL);
          goto done;
        }

        char *prevCwd = NULL;
        if (restrictToDir != NULL) {
          prevCwd = getcwd(NULL, 0);
          if (prevCwd == NULL) {
            write_error_json("Failed to getcwd before kernel load", NULL, NULL, NULL);
            exitCode = 1;
            free(kernelPath);
            free(restrictToDir);
            goto done;
          }

          if (chdir(restrictToDir) != 0) {
            char msg[512];
            snprintf(msg, sizeof(msg),
                     "Failed to chdir to restrictToDir: %s (dir=%s)",
                     strerror(errno), restrictToDir);
            write_error_json(msg, NULL, NULL, NULL);
            exitCode = 1;
            free(prevCwd);
            free(kernelPath);
            free(restrictToDir);
            goto done;
          }
        }

        furnsh_c(kernelPath);

        if (prevCwd != NULL) {
          if (chdir(prevCwd) != 0) {
            char msg[512];
            snprintf(msg, sizeof(msg),
                     "Failed to restore cwd after kernel load: %s (cwd=%s)",
                     strerror(errno), prevCwd);
            write_error_json(msg, NULL, NULL, NULL);
            exitCode = 1;
            free(prevCwd);
            free(kernelPath);
            free(restrictToDir);
            goto done;
          }
          free(prevCwd);
        }

        free(kernelPath);
        free(restrictToDir);

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
    write_error_json_ex("invalid_request", "Missing required field: args", NULL,
                        NULL, NULL, NULL);
    goto done;
  }

  if (tokens[argsTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "args must be an array", NULL, NULL,
                        NULL, NULL);
    goto done;
  }

  const bool isStr2et = strcmp(call, "time.str2et") == 0 || strcmp(call, "str2et") == 0;
  const bool isEt2utc = strcmp(call, "time.et2utc") == 0 || strcmp(call, "et2utc") == 0;
  const bool isBodn2c = strcmp(call, "ids-names.bodn2c") == 0 || strcmp(call, "bodn2c") == 0;
  const bool isBodc2n = strcmp(call, "ids-names.bodc2n") == 0 || strcmp(call, "bodc2n") == 0;
  const bool isNamfrm = strcmp(call, "frames.namfrm") == 0 || strcmp(call, "namfrm") == 0;
  const bool isFrmnam = strcmp(call, "frames.frmnam") == 0 || strcmp(call, "frmnam") == 0;
  const bool isPxform = strcmp(call, "frames.pxform") == 0 || strcmp(call, "pxform") == 0;

  if (!isStr2et && !isEt2utc && !isBodn2c && !isBodc2n && !isNamfrm && !isFrmnam && !isPxform) {
    write_error_json_ex("unsupported_call", "Unsupported call", NULL, NULL,
                        NULL, NULL);
    goto done;
  }

  if (isStr2et) {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "time.str2et expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int arg0Tok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (arg0Tok < 0 || arg0Tok >= tokenCount || tokens[arg0Tok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "time.str2et expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *timeStr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t timeErr =
        jsmn_strdup(input, &tokens[arg0Tok], &timeStr, strDetail, sizeof(strDetail));
    if (timeErr != JSMN_STRDUP_OK) {
      if (timeErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
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
    goto done;
  }

  if (isEt2utc) {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "time.et2utc expects args[0]=number args[1]=string args[2]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int etTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int fmtTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int precTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble et = 0.0;
    SpiceInt prec = 0;

    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }

    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "time.et2utc expects args[0] to be a number",
          etParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    if (fmtTok < 0 || fmtTok >= tokenCount || tokens[fmtTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "time.et2utc expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    parse_result precParse = PARSE_INVALID;
    if (precTok >= 0 && precTok < tokenCount) {
      precParse = jsmn_parse_int(input, &tokens[precTok], &prec);
    }

    if (precTok < 0 || precTok >= tokenCount || precParse != PARSE_OK) {
      if (precParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "time.et2utc expects args[2] to be an integer (SpiceInt range)",
            precParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *format = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t fmtErr =
        jsmn_strdup(input, &tokens[fmtTok], &format, strDetail, sizeof(strDetail));
    if (fmtErr != JSMN_STRDUP_OK) {
      if (fmtErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceChar utc[128];
    utc[0] = '\0';
    et2utc_c(et, format, prec, (SpiceInt)sizeof(utc), utc);
    free(format);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in et2utc", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(utc);
    fputs("\"}\n", stdout);
    goto done;
  }

  if (isBodn2c) {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodn2c expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodn2c expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt code = 0;
    SpiceBoolean found = SPICEFALSE;
    bodn2c_c(name, &code, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodn2c", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"code\":%" PRIdMAX "}}\n",
            (intmax_t)code);
    goto done;
  }
    goto done;
  }

  if (isBodc2n) {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodc2n expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int codeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt code = 0;
    parse_result codeParse = PARSE_INVALID;
    if (codeTok >= 0 && codeTok < tokenCount) {
      codeParse = jsmn_parse_int(input, &tokens[codeTok], &code);
    }

    if (codeTok < 0 || codeTok >= tokenCount || codeParse != PARSE_OK) {
      if (codeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodc2n expects args[0] to be an integer (SpiceInt range)",
            codeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceChar name[64];
    name[0] = '\0';
    SpiceBoolean found = SPICEFALSE;
    bodc2n_c(code, (SpiceInt)sizeof(name), name, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodc2n", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"name\":\"", stdout);
    json_print_escaped(name);
    fputs("\"}}\n", stdout);
    goto done;
  }

  if (isNamfrm) {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.namfrm expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.namfrm expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    namfrm_c(name, &frcode);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in namfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (frcode == 0) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"code\":%" PRIdMAX "}}\n",
            (intmax_t)frcode);
    goto done;
  }

  if (isFrmnam) {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.frmnam expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int codeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt frcode = 0;
    parse_result frcodeParse = PARSE_INVALID;
    if (codeTok >= 0 && codeTok < tokenCount) {
      frcodeParse = jsmn_parse_int(input, &tokens[codeTok], &frcode);
    }

    if (codeTok < 0 || codeTok >= tokenCount || frcodeParse != PARSE_OK) {
      if (frcodeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.frmnam expects args[0] to be an integer (SpiceInt range)",
            frcodeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceChar frname[64];
    frname[0] = '\0';
    frmnam_c(frcode, (SpiceInt)sizeof(frname), frname);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in frmnam", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (frname[0] == '\0') {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"name\":\"", stdout);
    json_print_escaped(frname);
    fputs("\"}}\n", stdout);
    goto done;
  }

  if (isPxform) {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[0]=string args[1]=string args[2]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int fromTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int toTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (fromTok < 0 || fromTok >= tokenCount || tokens[fromTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    if (toTok < 0 || toTok >= tokenCount || tokens[toTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }

    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[2] to be a number",
          etParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *from = NULL;
    char *to = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t fromErr =
        jsmn_strdup(input, &tokens[fromTok], &from, strDetail, sizeof(strDetail));
    if (fromErr != JSMN_STRDUP_OK) {
      if (fromErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t toErr =
        jsmn_strdup(input, &tokens[toTok], &to, strDetail, sizeof(strDetail));
    if (toErr != JSMN_STRDUP_OK) {
      free(from);
      if (toErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble m[3][3];
    pxform_c(from, to, et, m);
    free(from);
    free(to);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pxform", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // Success: row-major matrix.
    fputs("{\"ok\":true,\"result\":[", stdout);
    for (int r = 0; r < 3; r++) {
      for (int c = 0; c < 3; c++) {
        const int i = r * 3 + c;
        if (i != 0) {
          fputc(',', stdout);
        }
        fprintf(stdout, "%.17g", (double)m[r][c]);
      }
    }
    fputs("]}\n", stdout);
    goto done;
  }


done:
  // Clear state even though this is a single-shot process.
  kclear_c();
  reset_c();

  free(call);
  free(tokens);
  free(input);
  return exitCode;
}
