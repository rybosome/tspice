// Tiny CSPICE runner for parity-checking.
//
// Protocol:
//   stdin:  { setup: { kernels?: (string | { path: string, restrictToDir?: string })[] }, call: string, args: any }
//   stdout: { ok:true, result:any } OR { ok:false, error:{ message, spiceShort?, spiceLong?, spiceTrace? } }
//
// Implements:
//   - time.str2et (alias: str2et) args: [string] -> number
//   - time.et2utc (alias: et2utc) args: [number, string, number] -> string
//
//   - ids-names.bodn2c (alias: bodn2c) args: [string] -> {found, code?}
//   - ids-names.bodc2n (alias: bodc2n) args: [number] -> {found, name?}
//   - ids-names.bodc2s (alias: bodc2s) args: [number] -> string
//   - ids-names.bods2c (alias: bods2c) args: [string] -> {found, code?}
//   - ids-names.boddef (alias: boddef) args: [string, number] -> null
//   - ids-names.bodfnd (alias: bodfnd) args: [number, string] -> boolean
//   - ids-names.bodvar (alias: bodvar) args: [number, string] -> number[]
//
//   - frames.namfrm (alias: namfrm) args: [string] -> {found, code?}
//   - frames.frmnam (alias: frmnam) args: [number] -> {found, name?}
//   - frames.cidfrm (alias: cidfrm) args: [number] -> {found, frcode?, frname?}
//   - frames.cnmfrm (alias: cnmfrm) args: [string] -> {found, frcode?, frname?}
//   - frames.frinfo (alias: frinfo) args: [number] -> {found, center?, frameClass?, classId?}
//   - frames.ccifrm (alias: ccifrm) args: [number, number] -> {found, frcode?, frname?, center?}
//   - frames.pxform (alias: pxform) args: [string, string, number] -> number[9] (row-major)
//   - frames.sxform (alias: sxform) args: [string, string, number] -> number[36] (row-major)


#include "SpiceUsr.h"
#include "SpiceZmc.h"

#ifndef NULLCHAR
#define NULLCHAR ((SpiceChar)0)
#endif

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

// Kernel pool fixed-width string sizes (match tspice backends).
#define KPOOL_STRING_MAX_BYTES 2048
#define KPOOL_NAME_MAX_BYTES 64

// Guardrail: cap kernel-pool scratch allocations derived from untrusted `room`.
// This keeps the runner deterministic (invalid_args) instead of OOM/overflow.
#define CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES (64 * 1024 * 1024)

// Minimal triangle mesh used by DSK parity scenarios.
#define DSK_MINIMAL_NV 3
#define DSK_MINIMAL_NP 1
// Keep these comfortably above documented dskmi2 lower bounds for the
// 1-plate fixture while avoiding the 100k+ stress-test sizing used elsewhere.
#define DSK_MINIMAL_WORKSZ 2048
#define DSK_MINIMAL_VOXPSZ 512
#define DSK_MINIMAL_VOXLSZ 1024
#define DSK_MINIMAL_SPXISZ 8192

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


static bool jsmn_parse_double_array_fixed(const char *json, jsmntok_t *tokens,
                                         int arrayTok, int tokenCount,
                                         int expectedLen, SpiceDouble *out) {
  if (arrayTok < 0 || arrayTok >= tokenCount) {
    return false;
  }
  if (tokens[arrayTok].type != JSMN_ARRAY) {
    return false;
  }
  if (tokens[arrayTok].size != expectedLen) {
    return false;
  }

  for (int i = 0; i < expectedLen; i++) {
    const int elemTok = jsmn_get_array_elem(tokens, arrayTok, i, tokenCount);
    if (elemTok < 0 || elemTok >= tokenCount) {
      return false;
    }

    SpiceDouble v = 0.0;
    if (jsmn_parse_double(json, &tokens[elemTok], &v) != PARSE_OK) {
      return false;
    }
    out[i] = v;
  }

  return true;
}

static bool jsmn_parse_vec3(const char *json, jsmntok_t *tokens,
                            int vecTok, int tokenCount,
                            SpiceDouble out[3]) {
  return jsmn_parse_double_array_fixed(json, tokens, vecTok, tokenCount, 3, out);
}

static bool jsmn_parse_mat3_rowmajor(const char *json, jsmntok_t *tokens,
                                    int matTok, int tokenCount,
                                    SpiceDouble out[3][3]) {
  SpiceDouble tmp[9];
  if (!jsmn_parse_double_array_fixed(json, tokens, matTok, tokenCount, 9, tmp)) {
    return false;
  }

  int k = 0;
  for (int r = 0; r < 3; r++) {
    for (int c = 0; c < 3; c++) {
      out[r][c] = tmp[k++];
    }
  }

  return true;
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

static void trim_fixed_width_c_string_end(char *s, size_t maxBytes) {
  if (s == NULL || maxBytes == 0) {
    return;
  }

  // Find the first NUL byte (or stop at maxBytes).
  size_t n = 0;
  while (n < maxBytes && s[n] != '\0') {
    n++;
  }

  // Trim right ASCII whitespace.
  while (n > 0) {
    const unsigned char c = (unsigned char)s[n - 1];
    const bool isWs = (c == ' ') || (c == '\t') || (c == '\n') || (c == '\r') || (c == '\f') || (c == '\v');
    if (!isWs) {
      break;
    }
    n--;
  }

  if (n < maxBytes) {
    s[n] = '\0';
  } else {
    // Defensive: ensure the string is terminated.
    s[maxBytes - 1] = '\0';
  }
}



static void json_print_double_array(const SpiceDouble *arr, int n) {
  fputc('[', stdout);
  for (int i = 0; i < n; i++) {
    if (i != 0) {
      fputc(',', stdout);
    }
    fprintf(stdout, "%.17g", (double)arr[i]);
  }
  fputc(']', stdout);
}

static void json_print_spiceint_array(const SpiceInt *arr, int n) {
  fputc('[', stdout);
  for (int i = 0; i < n; i++) {
    if (i != 0) {
      fputc(',', stdout);
    }
    fprintf(stdout, "%" PRIdMAX, (intmax_t)arr[i]);
  }
  fputc(']', stdout);
}

static void json_print_mat3_rowmajor(const SpiceDouble m[3][3]) {
  fputc('[', stdout);
  for (int r = 0; r < 3; r++) {
    for (int c = 0; c < 3; c++) {
      if (!(r == 0 && c == 0)) {
        fputc(',', stdout);
      }
      fprintf(stdout, "%.17g", (double)m[r][c]);
    }
  }
  fputc(']', stdout);
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

static void write_error_json_ex_with_call(const char *code, const char *message,
                                          const char *detail, const char *spiceShort,
                                          const char *spiceLong, const char *spiceTrace,
                                          const char *detailsCall) {
  fputs("{\"ok\":false,\"error\":{", stdout);

  bool first = true;
  json_print_string_field("code", code, &first);
  json_print_string_field("message", message ? message : "error", &first);
  json_print_string_field("detail", detail, &first);
  json_print_string_field("spiceShort", spiceShort, &first);
  json_print_string_field("spiceLong", spiceLong, &first);
  json_print_string_field("spiceTrace", spiceTrace, &first);

  if (detailsCall != NULL && detailsCall[0] != '\0') {
    if (!first) {
      fputc(',', stdout);
    }
    first = false;

    fputs("\"details\":{", stdout);
    bool detailsFirst = true;
    json_print_string_field("call", detailsCall, &detailsFirst);
    fputc('}', stdout);
  }

  fputs("}}\n", stdout);
}

static void write_error_json_ex(const char *code, const char *message,
                                const char *detail, const char *spiceShort,
                                const char *spiceLong, const char *spiceTrace) {
  write_error_json_ex_with_call(code, message, detail, spiceShort, spiceLong, spiceTrace, NULL);
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

#define MAX_BOD_ITEM_BYTES 1024
#define BODY_CONST_MAX_VALUES 1024

static bool is_ascii_whitespace(unsigned char c) {
  return c == 32 /* space */ || c == 9 /* \t */ || c == 10 /* \n */ ||
         c == 13 /* \r */ || c == 12 /* \f */ || c == 11 /* \v */;
}

typedef enum {
  NORMALIZE_BOD_ITEM_OK = 0,
  NORMALIZE_BOD_ITEM_INVALID,
  NORMALIZE_BOD_ITEM_TOO_LONG,
  NORMALIZE_BOD_ITEM_OOM,
} normalize_bod_item_err_t;

static normalize_bod_item_err_t normalize_bod_item(const char *item, char **out) {
  *out = NULL;
  if (item == NULL) {
    return NORMALIZE_BOD_ITEM_INVALID;
  }

  const size_t len = strlen(item);
  // Contract guardrail: item names are expected to be short.
  if (len > (size_t)MAX_BOD_ITEM_BYTES) {
    return NORMALIZE_BOD_ITEM_TOO_LONG;
  }

  size_t start = 0;
  while (start < len && is_ascii_whitespace((unsigned char)item[start])) {
    start++;
  }

  size_t end = len;
  while (end > start && is_ascii_whitespace((unsigned char)item[end - 1])) {
    end--;
  }

  const size_t outLen = end - start;
  char *normalized = (char *)malloc(outLen + 1);
  if (normalized == NULL) {
    return NORMALIZE_BOD_ITEM_OOM;
  }

  for (size_t i = 0; i < outLen; i++) {
    const unsigned char c = (unsigned char)item[start + i];
    if (c >= 97 /* a */ && c <= 122 /* z */) {
      normalized[i] = (char)(c - 32);
    } else {
      normalized[i] = (char)c;
    }
  }
  normalized[outLen] = '\0';
  *out = normalized;
  return NORMALIZE_BOD_ITEM_OK;
}

static void sanitize_file_io_temp_tag(const char *tag,
                                      char *out,
                                      size_t outBytes) {
  if (outBytes == 0) {
    return;
  }

  if (tag == NULL) {
    tag = "";
  }

  size_t w = 0;
  bool prevDash = false;
  for (size_t i = 0; tag[i] != '\0' && w + 1 < outBytes && w < 64; i++) {
    const unsigned char c = (unsigned char)tag[i];
    if (isalnum(c) || c == '.' || c == '_' || c == '-') {
      out[w++] = (char)c;
      prevDash = (c == '-');
      continue;
    }

    if (!prevDash && w + 1 < outBytes && w < 64) {
      out[w++] = '-';
      prevDash = true;
    }
  }

  while (w > 0 && out[w - 1] == '-') {
    w--;
  }

  if (w == 0) {
    const char fallback[] = "file-io";
    size_t j = 0;
    while (fallback[j] != '\0' && j + 1 < outBytes) {
      out[j] = fallback[j];
      j++;
    }
    out[j] = '\0';
    return;
  }

  out[w] = '\0';
}

static bool build_file_io_temp_path(const char *tag,
                                    const char *extension,
                                    char *outPath,
                                    size_t outPathBytes,
                                    int *outFd,
                                    char *detail,
                                    size_t detailBytes) {
  if (outPath == NULL || outPathBytes == 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "temp path output buffer is missing");
    }
    return false;
  }

  if (outFd == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "temp file descriptor output is missing");
    }
    return false;
  }

  *outFd = -1;

  char safeTag[80];
  sanitize_file_io_temp_tag(tag, safeTag, sizeof(safeTag));

  const char *tmpDir = getenv("TMPDIR");
  if (tmpDir == NULL || tmpDir[0] == '\0') {
    tmpDir = "/tmp";
  }

  if (extension == NULL || extension[0] == '\0') {
    extension = ".tmp";
  }

  const char *extLead = "";
  if (extension[0] != '.') {
    extLead = ".";
  }

  const size_t suffixBytes = strlen(extLead) + strlen(extension);
  if (suffixBytes == 0 || suffixBytes > INT_MAX) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail,
               detailBytes,
               "invalid temporary file extension length");
    }
    return false;
  }

  const int n = snprintf(
      outPath,
      outPathBytes,
      "%s/tspice-parity-%s-XXXXXX%s%s",
      tmpDir,
      safeTag,
      extLead,
      extension);

  if (n < 0 || (size_t)n >= outPathBytes) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "failed to build temporary file path");
    }
    return false;
  }

  errno = 0;
  const int fd = mkstemps(outPath, (int)suffixBytes);
  if (fd < 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail,
               detailBytes,
               "failed to create secure temporary file path: %s",
               strerror(errno));
    }
    return false;
  }

  // Caller owns the descriptor and must close it after use.
  *outFd = fd;

  return true;
}

static bool resolve_first_loaded_ek_path(char *outPath,
                                         size_t outPathBytes,
                                         const char *callName) {
  if (outPath == NULL || outPathBytes == 0) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  char file[2048];
  char filtyp[256];
  char source[2048];
  file[0] = '\0';
  filtyp[0] = '\0';
  source[0] = '\0';

  SpiceInt handle = 0;
  SpiceBoolean found = SPICEFALSE;
  kdata_c(0,
          "EK",
          (SpiceInt)sizeof(file),
          (SpiceInt)sizeof(filtyp),
          (SpiceInt)sizeof(source),
          file,
          filtyp,
          source,
          &handle,
          &found);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json("SPICE error in kdata (resolve EK kernel)", shortMsg,
                     longMsg, traceMsg);
    return false;
  }

  if (found != SPICETRUE) {
    char detail[256];
    snprintf(detail,
             sizeof(detail),
             "%s requires at least one loaded EK kernel in setup.kernels",
             callName != NULL ? callName : "ek call");
    write_error_json_ex("invalid_request", detail, NULL, NULL, NULL, NULL);
    return false;
  }

  trim_fixed_width_c_string_end(file, sizeof(file));
  if (file[0] == '\0') {
    write_error_json_ex("invalid_request",
                        "Loaded EK kernel path from kdata(0, \"EK\") is empty",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  const size_t fileLen = strlen(file);
  if (fileLen + 1 > outPathBytes) {
    write_error_json_ex("invalid_request",
                        "Loaded EK kernel path is too long",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  memcpy(outPath, file, fileLen + 1);
  return true;
}

static void write_found_dla_descriptor_json(const SpiceDLADescr *descr,
                                            SpiceBoolean found) {
  if (found != SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
    return;
  }

  fputs("{\"ok\":true,\"result\":{\"found\":true,\"descr\":{", stdout);
  fputs("\"bwdptr\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->bwdptr);
  fputs(",\"fwdptr\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->fwdptr);
  fputs(",\"ibase\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->ibase);
  fputs(",\"isize\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->isize);
  fputs(",\"dbase\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->dbase);
  fputs(",\"dsize\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->dsize);
  fputs(",\"cbase\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->cbase);
  fputs(",\"csize\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->csize);
  fputs("}}}\n", stdout);
}

static const SpiceDouble DSK_MINIMAL_VERTICES[DSK_MINIMAL_NV][3] = {
    {0.0, 0.0, 0.0},
    {1.0, 0.0, 0.0},
    {0.0, 1.0, 0.0},
};

static const SpiceInt DSK_MINIMAL_PLATES[DSK_MINIMAL_NP][3] = {
    {1, 2, 3},
};

static const SpiceDouble DSK_MINIMAL_CORPAR[SPICE_DSK_NSYPAR] = {
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
};

static const SpiceDouble READ_VIRTUAL_OUTPUT_STATES[2][6] = {
    {0.0, 0.0, 0.0, 1.0, 0.0, 0.0},
    {60.0, 0.0, 0.0, 1.0, 0.0, 0.0},
};

static bool v2_write_minimal_dsk_file(const char *tag,
                                      char *outPath,
                                      size_t outPathBytes) {
  char detail[256];
  detail[0] = '\0';

  int tempFd = -1;
  if (!build_file_io_temp_path(tag,
                               ".bds",
                               outPath,
                               outPathBytes,
                               &tempFd,
                               detail,
                               sizeof(detail))) {
    write_error_json_ex("invalid_request",
                        "Failed to create temporary DSK path",
                        detail[0] ? detail : NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (tempFd >= 0) {
    close(tempFd);
    tempFd = -1;
  }
  unlink(outPath);

  SpiceInt handle = 0;
  dskopn_c(outPath, "TSPICE", 0, &handle);
  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    unlink(outPath);
    write_error_json("SPICE error in dskopn", shortMsg, longMsg, traceMsg);
    return false;
  }

  if ((size_t)DSK_MINIMAL_WORKSZ > SIZE_MAX / sizeof(SpiceInt[2])) {
    dascls_c(handle);
    unlink(outPath);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) *
                                              (size_t)DSK_MINIMAL_WORKSZ);
  if (work == NULL) {
    dascls_c(handle);
    unlink(outPath);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceDouble spaixd[SPICE_DSK02_IXDFIX];
  SpiceInt spaixi[DSK_MINIMAL_SPXISZ];

  dskmi2_c((SpiceInt)DSK_MINIMAL_NV,
           (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
           (SpiceInt)DSK_MINIMAL_NP,
           (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
           0.2,
           5,
           (SpiceInt)DSK_MINIMAL_WORKSZ,
           (SpiceInt)DSK_MINIMAL_VOXPSZ,
           (SpiceInt)DSK_MINIMAL_VOXLSZ,
           SPICETRUE,
           (SpiceInt)DSK_MINIMAL_SPXISZ,
           work,
           spaixd,
           spaixi);

  free(work);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    dascls_c(handle);
    unlink(outPath);
    write_error_json("SPICE error in dskmi2", shortMsg, longMsg, traceMsg);
    return false;
  }

  dskw02_c((SpiceInt)handle,
           399,
           1,
           2,
           "J2000",
           3,
           DSK_MINIMAL_CORPAR,
           0,
           1,
           0,
           1,
           -0.1,
           0.1,
           0,
           1,
           (SpiceInt)DSK_MINIMAL_NV,
           (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
           (SpiceInt)DSK_MINIMAL_NP,
           (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
           spaixd,
           spaixi);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    dascls_c(handle);
    unlink(outPath);
    write_error_json("SPICE error in dskw02", shortMsg, longMsg, traceMsg);
    return false;
  }

  dascls_c(handle);
  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    unlink(outPath);
    write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
    return false;
  }

  return true;
}



typedef enum {
  RUNNER_CELL_RECIPE_INT = 0,
  RUNNER_CELL_RECIPE_DOUBLE,
  RUNNER_CELL_RECIPE_CHAR,
  RUNNER_CELL_RECIPE_WINDOW,
} RunnerCellRecipeKind;

typedef struct {
  RunnerCellRecipeKind kind;
  // For int/double/char: cell size. For window: maxIntervals.
  SpiceInt size;
  // Only used by char recipes.
  SpiceInt length;
} RunnerCellRecipe;

static bool safe_add_size_t(size_t a, size_t b, size_t *out) {
  if (a > SIZE_MAX - b) {
    return false;
  }
  *out = a + b;
  return true;
}

static bool safe_mul_size_t(size_t a, size_t b, size_t *out) {
  if (a != 0 && b > SIZE_MAX / a) {
    return false;
  }
  *out = a * b;
  return true;
}

static bool spiceint_to_size_t_checked(SpiceInt value, size_t *out) {
  if (value < 0) {
    return false;
  }

  if ((uintmax_t)value > (uintmax_t)SIZE_MAX) {
    return false;
  }

  *out = (size_t)value;
  return true;
}

static bool parse_spiceint_arg(const char *input, const jsmntok_t *tokens,
                               int tokenCount, int tokIndex, const char *label,
                               SpiceInt *out, char *detail,
                               size_t detailBytes) {
  parse_result parsed = PARSE_INVALID;
  if (tokIndex >= 0 && tokIndex < tokenCount) {
    parsed = jsmn_parse_int(input, &tokens[tokIndex], out);
  }

  if (tokIndex >= 0 && tokIndex < tokenCount && parsed == PARSE_OK) {
    return true;
  }

  if (detail != NULL && detailBytes > 0) {
    if (parsed == PARSE_TOO_LONG) {
      snprintf(detail, detailBytes, "%s numeric literal too long", label);
    } else if (parsed == PARSE_UNSUPPORTED) {
      snprintf(detail, detailBytes,
               "%s requires supported SpiceInt width on this platform", label);
    } else {
      snprintf(detail, detailBytes, "%s must be an integer (SpiceInt range)",
               label);
    }
  }

  return false;
}

static bool parse_cells_windows_recipe(const char *input,
                                       const jsmntok_t *tokens,
                                       int tokenCount,
                                       int recipeTok,
                                       RunnerCellRecipe *outRecipe,
                                       char *detail,
                                       size_t detailBytes) {
  if (recipeTok < 0 || recipeTok >= tokenCount ||
      tokens[recipeTok].type != JSMN_ARRAY) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "cell recipe must be a tuple array");
    }
    return false;
  }

  const int recipeLen = tokens[recipeTok].size;
  if (recipeLen < 2) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "cell recipe must have at least 2 elements");
    }
    return false;
  }

  const int kindTok = jsmn_get_array_elem(tokens, recipeTok, 0, tokenCount);
  if (kindTok < 0 || kindTok >= tokenCount ||
      tokens[kindTok].type != JSMN_STRING) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "cell recipe kind must be a string");
    }
    return false;
  }

  const bool isInt = jsmn_token_streq(input, &tokens[kindTok], "int");
  const bool isDouble = jsmn_token_streq(input, &tokens[kindTok], "double");
  const bool isChar = jsmn_token_streq(input, &tokens[kindTok], "char");
  const bool isWindow = jsmn_token_streq(input, &tokens[kindTok], "window");

  if (!isInt && !isDouble && !isChar && !isWindow) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(
          detail,
          detailBytes,
          "cell recipe kind must be one of \"int\", \"double\", \"char\", \"window\"");
    }
    return false;
  }

  if ((isInt || isDouble || isWindow) && recipeLen != 2) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "%s recipe expects exactly 2 elements",
               isInt ? "int" : (isDouble ? "double" : "window"));
    }
    return false;
  }

  if (isChar && recipeLen != 3) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char recipe expects exactly 3 elements [\"char\", size, length]");
    }
    return false;
  }

  const int sizeTok = jsmn_get_array_elem(tokens, recipeTok, 1, tokenCount);
  SpiceInt size = 0;
  if (!parse_spiceint_arg(input, tokens, tokenCount, sizeTok,
                          "cell recipe size", &size, detail,
                          detailBytes)) {
    return false;
  }

  if (size < 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes, "cell recipe size must be >= 0");
    }
    return false;
  }

  if (isInt) {
    outRecipe->kind = RUNNER_CELL_RECIPE_INT;
    outRecipe->size = size;
    outRecipe->length = 0;
    return true;
  }

  if (isDouble) {
    outRecipe->kind = RUNNER_CELL_RECIPE_DOUBLE;
    outRecipe->size = size;
    outRecipe->length = 0;
    return true;
  }

  if (isWindow) {
    outRecipe->kind = RUNNER_CELL_RECIPE_WINDOW;
    outRecipe->size = size;
    outRecipe->length = 0;
    return true;
  }

  const int lengthTok = jsmn_get_array_elem(tokens, recipeTok, 2, tokenCount);
  SpiceInt length = 0;
  if (!parse_spiceint_arg(input, tokens, tokenCount, lengthTok,
                          "cell recipe length", &length, detail,
                          detailBytes)) {
    return false;
  }

  if (length <= 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell recipe length must be > 0");
    }
    return false;
  }

  outRecipe->kind = RUNNER_CELL_RECIPE_CHAR;
  outRecipe->size = size;
  outRecipe->length = length;
  return true;
}

static void runner_free_allocated_cell(SpiceCell *cell) {
  if (cell == NULL) {
    return;
  }

  free(cell->base);
  free(cell);
}

static bool runner_alloc_int_cell(SpiceInt size, SpiceCell **outCell,
                                  char *detail, size_t detailBytes) {
  *outCell = NULL;

  size_t sizeElems = 0;
  if (!spiceint_to_size_t_checked(size, &sizeElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "int cell size is out of range for allocation");
    }
    return false;
  }

  size_t totalElems = 0;
  if (!safe_add_size_t((size_t)SPICE_CELL_CTRLSZ, sizeElems, &totalElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "int cell size causes allocation overflow");
    }
    return false;
  }

  SpiceCell *cell = (SpiceCell *)calloc(1, sizeof(SpiceCell));
  if (cell == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating int cell descriptor");
    }
    return false;
  }

  SpiceInt *base = (SpiceInt *)calloc(totalElems, sizeof(SpiceInt));
  if (base == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating int cell storage");
    }
    free(cell);
    return false;
  }

  cell->dtype = SPICE_INT;
  cell->length = 0;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  ssize_c(size, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  scard_c(0, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  *outCell = cell;
  return true;
}

static bool runner_alloc_double_cell(SpiceInt size, SpiceCell **outCell,
                                     char *detail, size_t detailBytes) {
  *outCell = NULL;

  size_t sizeElems = 0;
  if (!spiceint_to_size_t_checked(size, &sizeElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "double cell size is out of range for allocation");
    }
    return false;
  }

  size_t totalElems = 0;
  if (!safe_add_size_t((size_t)SPICE_CELL_CTRLSZ, sizeElems, &totalElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "double cell size causes allocation overflow");
    }
    return false;
  }

  SpiceCell *cell = (SpiceCell *)calloc(1, sizeof(SpiceCell));
  if (cell == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating double cell descriptor");
    }
    return false;
  }

  SpiceDouble *base = (SpiceDouble *)calloc(totalElems, sizeof(SpiceDouble));
  if (base == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating double cell storage");
    }
    free(cell);
    return false;
  }

  cell->dtype = SPICE_DP;
  cell->length = 0;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  ssize_c(size, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  scard_c(0, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  *outCell = cell;
  return true;
}

static bool runner_alloc_char_cell(SpiceInt size, SpiceInt length,
                                   SpiceCell **outCell,
                                   char *detail, size_t detailBytes) {
  *outCell = NULL;

  size_t sizeElems = 0;
  size_t lengthElems = 0;
  if (!spiceint_to_size_t_checked(size, &sizeElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell size is out of range for allocation");
    }
    return false;
  }
  if (!spiceint_to_size_t_checked(length, &lengthElems) || lengthElems == 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell length must be > 0 and in range");
    }
    return false;
  }

  size_t totalStrings = 0;
  if (!safe_add_size_t((size_t)SPICE_CELL_CTRLSZ, sizeElems, &totalStrings)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell size causes allocation overflow");
    }
    return false;
  }

  size_t totalChars = 0;
  if (!safe_mul_size_t(totalStrings, lengthElems, &totalChars)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell allocation overflows platform limits");
    }
    return false;
  }

  size_t controlChars = 0;
  if (!safe_mul_size_t((size_t)SPICE_CELL_CTRLSZ, lengthElems, &controlChars)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell control allocation overflows platform limits");
    }
    return false;
  }

  SpiceCell *cell = (SpiceCell *)calloc(1, sizeof(SpiceCell));
  if (cell == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating char cell descriptor");
    }
    return false;
  }

  SpiceChar *base = (SpiceChar *)calloc(totalChars, sizeof(SpiceChar));
  if (base == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating char cell storage");
    }
    free(cell);
    return false;
  }

  cell->dtype = SPICE_CHR;
  cell->length = length;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + controlChars);

  ssize_c(size, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  scard_c(0, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  *outCell = cell;
  return true;
}

static bool runner_alloc_window_cell(SpiceInt maxIntervals,
                                     SpiceCell **outCell,
                                     char *detail,
                                     size_t detailBytes) {
  *outCell = NULL;

  size_t maxIntervalsSz = 0;
  if (!spiceint_to_size_t_checked(maxIntervals, &maxIntervalsSz)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "window maxIntervals is out of range for allocation");
    }
    return false;
  }

  size_t endpointsSz = 0;
  if (!safe_mul_size_t(maxIntervalsSz, 2u, &endpointsSz)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "window maxIntervals causes allocation overflow");
    }
    return false;
  }

  SpiceInt endpoints = (SpiceInt)endpointsSz;
  if ((size_t)endpoints != endpointsSz) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "window maxIntervals exceeds SpiceInt range");
    }
    return false;
  }

  return runner_alloc_double_cell(endpoints, outCell, detail, detailBytes);
}

static bool runner_alloc_cell_from_recipe(const RunnerCellRecipe *recipe,
                                          SpiceCell **outCell,
                                          bool *outIsWindow,
                                          char *detail,
                                          size_t detailBytes) {
  *outCell = NULL;
  *outIsWindow = false;

  switch (recipe->kind) {
  case RUNNER_CELL_RECIPE_INT:
    return runner_alloc_int_cell(recipe->size, outCell, detail, detailBytes);
  case RUNNER_CELL_RECIPE_DOUBLE:
    return runner_alloc_double_cell(recipe->size, outCell, detail, detailBytes);
  case RUNNER_CELL_RECIPE_CHAR:
    return runner_alloc_char_cell(recipe->size, recipe->length,
                                  outCell, detail, detailBytes);
  case RUNNER_CELL_RECIPE_WINDOW:
    *outIsWindow = true;
    return runner_alloc_window_cell(recipe->size, outCell, detail, detailBytes);
  }

  if (detail != NULL && detailBytes > 0) {
    snprintf(detail, detailBytes, "unsupported cell recipe kind");
  }
  return false;
}


typedef enum {
  CALL_NONE = 0,

  // time
  CALL_TIME_STR2ET,
  CALL_TIME_ET2UTC,

  // time (misc)
  CALL_TIME_SPICE_VERSION,
  CALL_TIME_TKVRSN,
  CALL_TIME_TIMOUT,
  CALL_TIME_DELTET,
  CALL_TIME_UNITIM,
  CALL_TIME_TPARSE,
  CALL_TIME_TPICTR,
  CALL_TIME_TIMDEF,

  // ids-names
  CALL_BODN2C,
  CALL_BODC2N,
  CALL_BODC2S,
  CALL_BODS2C,
  CALL_BODDEF,
  CALL_BODFND,
  CALL_BODVAR,

  // frames
  CALL_NAMFRM,
  CALL_FRMNAM,
  CALL_CIDFRM,
  CALL_CNMFRM,
  CALL_FRINFO,
  CALL_CCIFRM,
  CALL_PXFORM,
  CALL_SXFORM,

  // coords-vectors
  CALL_AXISAR,
  CALL_GEOREC,
  CALL_LATREC,
  CALL_MTXV,
  CALL_MXM,
  CALL_MXV,
  CALL_RECGEO,
  CALL_RECLAT,
  CALL_RECSPH,
  CALL_ROTATE,
  CALL_ROTMAT,
  CALL_SPHREC,
  CALL_VADD,
  CALL_VCRSS,
  CALL_VDOT,
  CALL_VHAT,
  CALL_VMINUS,
  CALL_VNORM,
  CALL_VSCL,
  CALL_VSUB,

  // ephemeris
  CALL_SPKEZR,
  CALL_SPKPOS,
  CALL_SPKEZ,
  CALL_SPKEZP,
  CALL_SPKGEO,
  CALL_SPKGPS,
  CALL_SPKSSB,
  CALL_SPKPDS,
  CALL_SPKUDS,
  CALL_SPKSFS,

  // file-io
  CALL_FILE_IO_EXISTS,
  CALL_FILE_IO_GETFAT,
  CALL_FILE_IO_DAFOPR,
  CALL_FILE_IO_DAFCLS,
  CALL_FILE_IO_DAFBFS,
  CALL_FILE_IO_DAFFNA,
  CALL_FILE_IO_DASOPR,
  CALL_FILE_IO_DASCLS,
  CALL_FILE_IO_DLAOPN,
  CALL_FILE_IO_DLABFS,
  CALL_FILE_IO_DLAFNS,
  CALL_FILE_IO_DLACLS,

  // kernels
  CALL_KERNELS_FURNSH,
  CALL_KERNELS_UNLOAD,
  CALL_KERNELS_KCLEAR,
  CALL_KERNELS_KTOTAL,
  CALL_KERNELS_KDATA,
  CALL_KERNELS_KINFO,
  CALL_KERNELS_KXTRCT,
  CALL_KERNELS_KPLFRM,

  // cells-windows
  CALL_CELLS_WINDOWS_INSRTI,
  CALL_CELLS_WINDOWS_INSRTD,
  CALL_CELLS_WINDOWS_INSRTC,
  CALL_CELLS_WINDOWS_CELL_GETI,
  CALL_CELLS_WINDOWS_CELL_GETD,
  CALL_CELLS_WINDOWS_CELL_GETC,
  CALL_CELLS_WINDOWS_WNINSD,
  CALL_CELLS_WINDOWS_WNCARD,
  CALL_CELLS_WINDOWS_WNFETD,
  CALL_CELLS_WINDOWS_WNVALD,

  // kernel-pool
  CALL_GDPOOL,
  CALL_GIPOOL,
  CALL_GCPOOL,
  CALL_GNPOOL,
  CALL_DTPOOL,
  CALL_PDPOOL,
  CALL_PIPOOL,
  CALL_PCPOOL,
  CALL_SWPOOL,
  CALL_CVPOOL,
  CALL_EXPOOL,
} CallId;

typedef struct {
  const char *name;
  CallId id;
} CallDispatchEntry;

static CallId parse_call_id(const char *call) {
  static const CallDispatchEntry table[] = {
      {"time.str2et", CALL_TIME_STR2ET},
      {"str2et", CALL_TIME_STR2ET},
      {"time.et2utc", CALL_TIME_ET2UTC},
      {"et2utc", CALL_TIME_ET2UTC},

      // time (misc)
      {"time.spiceVersion", CALL_TIME_SPICE_VERSION},
      {"time.tkvrsn", CALL_TIME_TKVRSN},
      {"time.timout", CALL_TIME_TIMOUT},
      {"time.deltet", CALL_TIME_DELTET},
      {"time.unitim", CALL_TIME_UNITIM},
      {"time.tparse", CALL_TIME_TPARSE},
      {"time.tpictr", CALL_TIME_TPICTR},
      {"time.timdef", CALL_TIME_TIMDEF},

      // ids-names
      {"ids-names.bodn2c", CALL_BODN2C},
      {"bodn2c", CALL_BODN2C},
      {"ids-names.bodc2n", CALL_BODC2N},
      {"bodc2n", CALL_BODC2N},
      {"ids-names.bodc2s", CALL_BODC2S},
      {"bodc2s", CALL_BODC2S},
      {"ids-names.bods2c", CALL_BODS2C},
      {"bods2c", CALL_BODS2C},
      {"ids-names.boddef", CALL_BODDEF},
      {"boddef", CALL_BODDEF},
      {"ids-names.bodfnd", CALL_BODFND},
      {"bodfnd", CALL_BODFND},
      {"ids-names.bodvar", CALL_BODVAR},
      {"bodvar", CALL_BODVAR},

      // frames
      {"frames.namfrm", CALL_NAMFRM},
      {"namfrm", CALL_NAMFRM},
      {"frames.frmnam", CALL_FRMNAM},
      {"frmnam", CALL_FRMNAM},
      {"frames.cidfrm", CALL_CIDFRM},
      {"cidfrm", CALL_CIDFRM},
      {"frames.cnmfrm", CALL_CNMFRM},
      {"cnmfrm", CALL_CNMFRM},
      {"frames.frinfo", CALL_FRINFO},
      {"frinfo", CALL_FRINFO},
      {"frames.ccifrm", CALL_CCIFRM},
      {"ccifrm", CALL_CCIFRM},
      {"frames.pxform", CALL_PXFORM},
      {"pxform", CALL_PXFORM},
      {"frames.sxform", CALL_SXFORM},
      {"sxform", CALL_SXFORM},

      // coords-vectors
      {"coords-vectors.axisar", CALL_AXISAR},
      {"coords-vectors.georec", CALL_GEOREC},
      {"coords-vectors.latrec", CALL_LATREC},
      {"coords-vectors.mtxv", CALL_MTXV},
      {"coords-vectors.mxm", CALL_MXM},
      {"coords-vectors.mxv", CALL_MXV},
      {"coords-vectors.recgeo", CALL_RECGEO},
      {"coords-vectors.reclat", CALL_RECLAT},
      {"coords-vectors.recsph", CALL_RECSPH},
      {"coords-vectors.rotate", CALL_ROTATE},
      {"coords-vectors.rotmat", CALL_ROTMAT},
      {"coords-vectors.sphrec", CALL_SPHREC},
      {"coords-vectors.vadd", CALL_VADD},
      {"coords-vectors.vcrss", CALL_VCRSS},
      {"coords-vectors.vdot", CALL_VDOT},
      {"coords-vectors.vhat", CALL_VHAT},
      {"coords-vectors.vminus", CALL_VMINUS},
      {"coords-vectors.vnorm", CALL_VNORM},
      {"coords-vectors.vscl", CALL_VSCL},
      {"coords-vectors.vsub", CALL_VSUB},

      // ephemeris
      {"ephemeris.spkezr", CALL_SPKEZR},
      {"ephemeris.spkpos", CALL_SPKPOS},
      {"ephemeris.spkez", CALL_SPKEZ},
      {"ephemeris.spkezp", CALL_SPKEZP},
      {"ephemeris.spkgeo", CALL_SPKGEO},
      {"ephemeris.spkgps", CALL_SPKGPS},
      {"ephemeris.spkssb", CALL_SPKSSB},
      {"ephemeris.spkpds", CALL_SPKPDS},
      {"ephemeris.spkuds", CALL_SPKUDS},
      {"ephemeris.spksfs", CALL_SPKSFS},

      // file-io
      {"file-io.exists", CALL_FILE_IO_EXISTS},
      {"file-io.getfat", CALL_FILE_IO_GETFAT},
      {"file-io.dafopr", CALL_FILE_IO_DAFOPR},
      {"file-io.dafcls", CALL_FILE_IO_DAFCLS},
      {"file-io.dafbfs", CALL_FILE_IO_DAFBFS},
      {"file-io.daffna", CALL_FILE_IO_DAFFNA},
      {"file-io.dasopr", CALL_FILE_IO_DASOPR},
      {"file-io.dascls", CALL_FILE_IO_DASCLS},
      {"file-io.dlaopn", CALL_FILE_IO_DLAOPN},
      {"file-io.dlabfs", CALL_FILE_IO_DLABFS},
      {"file-io.dlafns", CALL_FILE_IO_DLAFNS},
      {"file-io.dlacls", CALL_FILE_IO_DLACLS},

      // kernels
      {"kernels.furnsh", CALL_KERNELS_FURNSH},
      {"kernels.unload", CALL_KERNELS_UNLOAD},
      {"kernels.kclear", CALL_KERNELS_KCLEAR},
      {"kernels.ktotal", CALL_KERNELS_KTOTAL},
      {"kernels.kdata", CALL_KERNELS_KDATA},
      {"kernels.kinfo", CALL_KERNELS_KINFO},
      {"kernels.kxtrct", CALL_KERNELS_KXTRCT},
      {"kernels.kplfrm", CALL_KERNELS_KPLFRM},

      // cells-windows
      {"cells-windows.insrti", CALL_CELLS_WINDOWS_INSRTI},
      {"cells-windows.insrtd", CALL_CELLS_WINDOWS_INSRTD},
      {"cells-windows.insrtc", CALL_CELLS_WINDOWS_INSRTC},
      {"cells-windows.cellGeti", CALL_CELLS_WINDOWS_CELL_GETI},
      {"cells-windows.cellGetd", CALL_CELLS_WINDOWS_CELL_GETD},
      {"cells-windows.cellGetc", CALL_CELLS_WINDOWS_CELL_GETC},
      {"cells-windows.wninsd", CALL_CELLS_WINDOWS_WNINSD},
      {"cells-windows.wncard", CALL_CELLS_WINDOWS_WNCARD},
      {"cells-windows.wnfetd", CALL_CELLS_WINDOWS_WNFETD},
      {"cells-windows.wnvald", CALL_CELLS_WINDOWS_WNVALD},

      // kernel-pool
      {"kernel-pool.gdpool", CALL_GDPOOL},
      {"kernel-pool.gipool", CALL_GIPOOL},
      {"kernel-pool.gcpool", CALL_GCPOOL},
      {"kernel-pool.gnpool", CALL_GNPOOL},
      {"kernel-pool.dtpool", CALL_DTPOOL},
      {"kernel-pool.pdpool", CALL_PDPOOL},
      {"kernel-pool.pipool", CALL_PIPOOL},
      {"kernel-pool.pcpool", CALL_PCPOOL},
      {"kernel-pool.swpool", CALL_SWPOOL},
      {"kernel-pool.cvpool", CALL_CVPOOL},
      {"kernel-pool.expool", CALL_EXPOOL},
  };

  for (size_t i = 0; i < sizeof(table) / sizeof(table[0]); i++) {
    if (strcmp(call, table[i].name) == 0) {
      return table[i].id;
    }
  }

  return CALL_NONE;
}

#define V2_MAX_REFS 64

typedef enum {
  V2_REF_NONE = 0,
  V2_REF_NULL,
  V2_REF_INT,
  V2_REF_BOOL,
  V2_REF_DOUBLE,
  V2_REF_STRING,
  V2_REF_CELL,
  V2_REF_WINDOW,
} V2RefType;

typedef struct {
  char *name;
  V2RefType type;
  SpiceInt intValue;
  SpiceBoolean boolValue;
  SpiceDouble doubleValue;
  char *stringValue;
  SpiceCell cell;
  void *storage;
} V2RefEntry;

static bool v2_parse_int_token_or_error(const char *json, const jsmntok_t *tok,
                                        SpiceInt *out, const char *label) {
  parse_result pr = jsmn_parse_int(json, tok, out);
  if (pr == PARSE_OK) {
    return true;
  }

  if (pr == PARSE_UNSUPPORTED) {
    write_unsupported_spiceint_width_error();
    return false;
  }

  char msg[256];
  switch (pr) {
  case PARSE_TOO_LONG:
    snprintf(msg, sizeof(msg), "%s is too long", label);
    break;
  case PARSE_OUT_OF_RANGE:
    snprintf(msg, sizeof(msg), "%s is out of range", label);
    break;
  case PARSE_INVALID:
  default:
    snprintf(msg, sizeof(msg), "%s must be an integer", label);
    break;
  }

  write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
  return false;
}

static bool v2_parse_ref_name(const char *expr, const char *prefix,
                              const char **outName) {
  const size_t prefixLen = strlen(prefix);
  if (strncmp(expr, prefix, prefixLen) != 0) {
    return false;
  }

  const char *name = expr + prefixLen;
  if (name[0] == '\0') {
    return false;
  }

  *outName = name;
  return true;
}

static char *v2_strdup(const char *value) {
  if (value == NULL) {
    return NULL;
  }

  size_t len = strlen(value) + 1;
  char *copy = (char *)malloc(len);
  if (copy == NULL) {
    return NULL;
  }

  memcpy(copy, value, len);
  return copy;
}

static int v2_find_ref_index(const V2RefEntry *refs, const int refCount,
                             const char *name) {
  for (int i = 0; i < refCount; i++) {
    if (refs[i].name != NULL && strcmp(refs[i].name, name) == 0) {
      return i;
    }
  }

  return -1;
}

static int v2_find_free_ref_slot(const V2RefEntry *refs, const int refCount) {
  for (int i = 0; i < refCount; i++) {
    if (refs[i].name == NULL) {
      return i;
    }
  }

  return -1;
}

static void v2_free_ref_entry(V2RefEntry *entry) {
  if (entry == NULL) {
    return;
  }

  free(entry->stringValue);
  entry->stringValue = NULL;

  if (entry->storage != NULL) {
    free(entry->storage);
    entry->storage = NULL;
  }

  free(entry->name);
  entry->name = NULL;
  entry->type = V2_REF_NONE;
  memset(&entry->cell, 0, sizeof(entry->cell));
  entry->intValue = 0;
  entry->boolValue = SPICEFALSE;
  entry->doubleValue = 0.0;
}

static void v2_free_all_refs(V2RefEntry *refs, const int refCount) {
  for (int i = 0; i < refCount; i++) {
    v2_free_ref_entry(&refs[i]);
  }
}

static bool v2_add_ref_cell(V2RefEntry *refs, int *refCount, const char *name,
                            const V2RefType type, const SpiceCell *cell,
                            void *storage) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;
  entry->type = type;
  entry->cell = *cell;
  entry->storage = storage;

  if (slot == *refCount) {
    (*refCount)++;
  }
  return true;
}

static bool v2_add_ref_int(V2RefEntry *refs, int *refCount, const char *name,
                           const SpiceInt value) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;
  entry->type = V2_REF_INT;
  entry->intValue = value;

  if (slot == *refCount) {
    (*refCount)++;
  }
  return true;
}

static bool v2_add_ref_null(V2RefEntry *refs, int *refCount, const char *name) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;
  entry->type = V2_REF_NULL;

  if (slot == *refCount) {
    (*refCount)++;
  }
  return true;
}

static bool v2_add_ref_bool(V2RefEntry *refs, int *refCount, const char *name,
                            const SpiceBoolean value) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;
  entry->type = V2_REF_BOOL;
  entry->boolValue = value;

  if (slot == *refCount) {
    (*refCount)++;
  }
  return true;
}

static bool v2_add_ref_double(V2RefEntry *refs, int *refCount, const char *name,
                              const SpiceDouble value) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;
  entry->type = V2_REF_DOUBLE;
  entry->doubleValue = value;

  if (slot == *refCount) {
    (*refCount)++;
  }
  return true;
}

static bool v2_add_ref_string(V2RefEntry *refs, int *refCount, const char *name,
                              const char *value) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  char *ownedValue = v2_strdup(value != NULL ? value : "");
  if (ownedValue == NULL) {
    free(ownedName);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;
  entry->type = V2_REF_STRING;
  entry->stringValue = ownedValue;

  if (slot == *refCount) {
    (*refCount)++;
  }
  return true;
}

static char *v2_join_ref_suffix(const char *base, const char *suffix) {
  if (base == NULL || suffix == NULL) {
    return NULL;
  }

  const size_t baseLen = strlen(base);
  const size_t suffixLen = strlen(suffix);
  if (baseLen > SIZE_MAX - suffixLen - 1U) {
    return NULL;
  }

  const size_t totalLen = baseLen + suffixLen;
  char *joined = (char *)malloc(totalLen + 1U);
  if (joined == NULL) {
    return NULL;
  }

  memcpy(joined, base, baseLen);
  memcpy(joined + baseLen, suffix, suffixLen);
  joined[totalLen] = '\0';
  return joined;
}

static bool v2_resolve_spiceint_expr(const char *json, const jsmntok_t *tokens,
                                     const int tokenCount, const int exprTok,
                                     const int argsTok, const V2RefEntry *refs,
                                     const int refCount, const char *label,
                                     SpiceInt *out) {
  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[exprTok];
  if (tok->type == JSMN_PRIMITIVE) {
    return v2_parse_int_token_or_error(json, tok, out, label);
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to integer",
                        label, NULL, NULL, NULL);
    return false;
  }

  char exprDetail[256];
  exprDetail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, tok, &expr, exprDetail, sizeof(exprDetail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          exprDetail[0] ? exprDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok = jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    bool ok = v2_parse_int_token_or_error(json, &tokens[valueTok], out, label);
    free(expr);
    return ok;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    int refIndex = v2_find_ref_index(refs, refCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    if (refs[refIndex].type != V2_REF_INT) {
      write_error_json_ex("invalid_args", "v2 ref is not an integer", refName,
                          NULL, NULL, NULL);
      free(expr);
      return false;
    }

    *out = refs[refIndex].intValue;
    free(expr);
    return true;
  }

  write_error_json_ex("invalid_args", "Unsupported v2 integer expression", expr,
                      NULL, NULL, NULL);
  free(expr);
  return false;
}

static bool v2_resolve_string_expr(const char *json, const jsmntok_t *tokens,
                                   const int tokenCount, const int exprTok,
                                   const int argsTok, const V2RefEntry *refs,
                                   const int refCount, const char *label,
                                   char **out) {
  if (out == NULL) {
    write_error_json_ex("invalid_request", "Internal v2 string output pointer is missing",
                        NULL, NULL, NULL, NULL);
    return false;
  }
  *out = NULL;

  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[exprTok];
  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to string",
                        label, NULL, NULL, NULL);
    return false;
  }

  char exprDetail[256];
  exprDetail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, tok, &expr, exprDetail, sizeof(exprDetail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          exprDetail[0] ? exprDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok = jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    if (tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "Expression must resolve to string",
                          label, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    char argDetail[256];
    argDetail[0] = '\0';
    char *argValue = NULL;
    jsmn_strdup_err_t argErr =
        jsmn_strdup(json, &tokens[valueTok], &argValue, argDetail, sizeof(argDetail));
    if (argErr != JSMN_STRDUP_OK) {
      if (argErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            argDetail[0] ? argDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(expr);
      return false;
    }

    free(expr);
    *out = argValue;
    return true;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    int refIndex = v2_find_ref_index(refs, refCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    if (refs[refIndex].type != V2_REF_STRING) {
      write_error_json_ex("invalid_args", "v2 ref is not a string", refName,
                          NULL, NULL, NULL);
      free(expr);
      return false;
    }

    const char *value =
        refs[refIndex].stringValue != NULL ? refs[refIndex].stringValue : "";
    char *copied = strdup(value);
    if (copied == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(expr);
      return false;
    }

    free(expr);
    *out = copied;
    return true;
  }

  *out = expr;
  return true;
}

static bool v2_resolve_ref_by_type(const char *json, const jsmntok_t *tokens,
                                   const int tokenCount, const int tokenIndex,
                                   V2RefEntry *refs, const int refCount,
                                   const char *label,
                                   const V2RefType expectedType,
                                   const char *invalidRefMessage,
                                   int *outRefIndex) {
  if (tokenIndex < 0 || tokenIndex >= tokenCount ||
      tokens[tokenIndex].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "Ref expression must be a string",
                        label, NULL, NULL, NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, &tokens[tokenIndex], &expr, detail, sizeof(detail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *refName = NULL;
  if (!v2_parse_ref_name(expr, "$refs.", &refName)) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  int refIndex = v2_find_ref_index(refs, refCount, refName);
  if (refIndex < 0) {
    write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                        NULL, NULL);
    free(expr);
    return false;
  }

  if (refs[refIndex].type != expectedType || refs[refIndex].storage == NULL) {
    write_error_json_ex("invalid_args", invalidRefMessage,
                        refName, NULL, NULL, NULL);
    free(expr);
    return false;
  }

  *outRefIndex = refIndex;
  free(expr);
  return true;
}

static bool v2_resolve_cell_ref(const char *json, const jsmntok_t *tokens,
                                const int tokenCount, const int tokenIndex,
                                V2RefEntry *refs, const int refCount,
                                const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(
      json,
      tokens,
      tokenCount,
      tokenIndex,
      refs,
      refCount,
      label,
      V2_REF_CELL,
      "v2 ref is not an allocated cell",
      outRefIndex);
}

static bool v2_resolve_window_ref(const char *json, const jsmntok_t *tokens,
                                  const int tokenCount, const int tokenIndex,
                                  V2RefEntry *refs, const int refCount,
                                  const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(
      json,
      tokens,
      tokenCount,
      tokenIndex,
      refs,
      refCount,
      label,
      V2_REF_WINDOW,
      "v2 ref is not an allocated window",
      outRefIndex);
}

static bool v2_resolve_cell_or_window_ref(const char *json,
                                          const jsmntok_t *tokens,
                                          const int tokenCount,
                                          const int tokenIndex,
                                          V2RefEntry *refs,
                                          const int refCount,
                                          const char *label,
                                          int *outRefIndex) {
  if (tokenIndex < 0 || tokenIndex >= tokenCount ||
      tokens[tokenIndex].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "Ref expression must be a string",
                        label, NULL, NULL, NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, &tokens[tokenIndex], &expr, detail, sizeof(detail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *refName = NULL;
  if (!v2_parse_ref_name(expr, "$refs.", &refName)) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  int refIndex = v2_find_ref_index(refs, refCount, refName);
  if (refIndex < 0) {
    write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                        NULL, NULL);
    free(expr);
    return false;
  }

  if ((refs[refIndex].type != V2_REF_CELL &&
       refs[refIndex].type != V2_REF_WINDOW) ||
      refs[refIndex].storage == NULL) {
    write_error_json_ex("invalid_args",
                        "v2 ref is not an allocated cell/window",
                        refName, NULL, NULL, NULL);
    free(expr);
    return false;
  }

  *outRefIndex = refIndex;
  free(expr);
  return true;
}

static bool v2_execute_alloc_cell_step(const char *json, const jsmntok_t *tokens,
                                       const int tokenCount, const int stepTok,
                                       const int argsTok, V2RefEntry *refs,
                                       int *refCount) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  int paramsTok =
      jsmn_find_object_key(json, tokens, stepTok, "params", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING || paramsTok < 0 ||
      tokens[paramsTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "allocCell requires string 'as' and object 'params'",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char asDetail[256];
  asDetail[0] = '\0';
  char *asName = NULL;
  jsmn_strdup_err_t asErr =
      jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
  if (asErr != JSMN_STRDUP_OK) {
    if (asErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  int kindTok = jsmn_find_object_key(json, tokens, paramsTok, "kind", tokenCount);
  int sizeTok = jsmn_find_object_key(json, tokens, paramsTok, "size", tokenCount);
  if (kindTok < 0 || tokens[kindTok].type != JSMN_STRING || sizeTok < 0) {
    write_error_json_ex("invalid_request",
                        "allocCell.params requires string kind and size", NULL,
                        NULL, NULL, NULL);
    free(asName);
    return false;
  }

  SpiceInt size = 0;
  if (!v2_resolve_spiceint_expr(json, tokens, tokenCount, sizeTok, argsTok, refs,
                                *refCount, "allocCell.params.size", &size)) {
    free(asName);
    return false;
  }

  if (size < 0) {
    write_error_json_ex("invalid_args", "allocCell.params.size must be >= 0", NULL,
                        NULL, NULL, NULL);
    free(asName);
    return false;
  }

  void *storage = NULL;
  SpiceCell cell;
  memset(&cell, 0, sizeof(cell));

  if (jsmn_token_streq(json, &tokens[kindTok], "int")) {
    size_t cellSize = (size_t)size;
    if (cellSize > (SIZE_MAX / sizeof(SpiceInt)) - (size_t)SPICE_CELL_CTRLSZ) {
      write_error_json_ex("invalid_args", "allocCell.params.size is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t elemCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
    SpiceInt *intStorage = (SpiceInt *)calloc(elemCount, sizeof(SpiceInt));
    if (intStorage == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(asName);
      return false;
    }

    storage = intStorage;
    cell.dtype = SPICE_INT;
    cell.length = 0;
    cell.size = size;
    cell.card = 0;
    cell.isSet = SPICETRUE;
    cell.adjust = SPICEFALSE;
    cell.init = SPICEFALSE;
    cell.base = (void *)intStorage;
    cell.data = (void *)(intStorage + SPICE_CELL_CTRLSZ);
  } else if (jsmn_token_streq(json, &tokens[kindTok], "double")) {
    size_t cellSize = (size_t)size;
    if (cellSize > (SIZE_MAX / sizeof(SpiceDouble)) - (size_t)SPICE_CELL_CTRLSZ) {
      write_error_json_ex("invalid_args", "allocCell.params.size is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t elemCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
    SpiceDouble *doubleStorage =
        (SpiceDouble *)calloc(elemCount, sizeof(SpiceDouble));
    if (doubleStorage == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(asName);
      return false;
    }

    storage = doubleStorage;
    cell.dtype = SPICE_DP;
    cell.length = 0;
    cell.size = size;
    cell.card = 0;
    cell.isSet = SPICETRUE;
    cell.adjust = SPICEFALSE;
    cell.init = SPICEFALSE;
    cell.base = (void *)doubleStorage;
    cell.data = (void *)(doubleStorage + SPICE_CELL_CTRLSZ);
  } else if (jsmn_token_streq(json, &tokens[kindTok], "char")) {
    int lengthTok =
        jsmn_find_object_key(json, tokens, paramsTok, "length", tokenCount);
    if (lengthTok < 0) {
      write_error_json_ex("invalid_request",
                          "allocCell.params.kind=char requires length",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    SpiceInt length = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  lengthTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "allocCell.params.length",
                                  &length)) {
      free(asName);
      return false;
    }

    if (length < 1) {
      write_error_json_ex("invalid_args", "allocCell.params.length must be >= 1",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t cellSize = (size_t)size;
    const size_t charLength = (size_t)length;
    if (cellSize > SIZE_MAX - (size_t)SPICE_CELL_CTRLSZ) {
      write_error_json_ex("invalid_args", "allocCell.params.size is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t slotCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
    if (charLength > SIZE_MAX / slotCount) {
      write_error_json_ex("invalid_args",
                          "allocCell.params.length is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t elemCount = slotCount * charLength;
    SpiceChar *charStorage = (SpiceChar *)calloc(elemCount, sizeof(SpiceChar));
    if (charStorage == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(asName);
      return false;
    }

    storage = charStorage;
    cell.dtype = SPICE_CHR;
    cell.length = length;
    cell.size = size;
    cell.card = 0;
    cell.isSet = SPICETRUE;
    cell.adjust = SPICEFALSE;
    cell.init = SPICEFALSE;
    cell.base = (void *)charStorage;
    cell.data = (void *)(charStorage + ((size_t)SPICE_CELL_CTRLSZ * charLength));
  } else {
    write_error_json_ex("unsupported_call", "Unsupported allocCell kind", NULL,
                        NULL, NULL, NULL);
    free(asName);
    return false;
  }

  ssize_c(size, &cell);
  scard_c(0, &cell);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json_ex("spice_error", "SPICE error in allocCell", NULL, shortMsg,
                        longMsg, traceMsg);
    free(storage);
    free(asName);
    return false;
  }

  bool ok = v2_add_ref_cell(refs, refCount, asName, V2_REF_CELL, &cell, storage);
  free(asName);
  if (!ok) {
    free(storage);
    return false;
  }

  return true;
}

static bool v2_execute_alloc_window_step(const char *json,
                                         const jsmntok_t *tokens,
                                         const int tokenCount,
                                         const int stepTok,
                                         const int argsTok,
                                         V2RefEntry *refs,
                                         int *refCount) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  int paramsTok =
      jsmn_find_object_key(json, tokens, stepTok, "params", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING || paramsTok < 0 ||
      tokens[paramsTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "allocWindow requires string 'as' and object 'params'",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int maxIntervalsTok =
      jsmn_find_object_key(json, tokens, paramsTok, "maxIntervals", tokenCount);
  if (maxIntervalsTok < 0) {
    write_error_json_ex("invalid_request",
                        "allocWindow.params requires maxIntervals", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  SpiceInt maxIntervals = 0;
  if (!v2_resolve_spiceint_expr(json,
                                tokens,
                                tokenCount,
                                maxIntervalsTok,
                                argsTok,
                                refs,
                                *refCount,
                                "allocWindow.params.maxIntervals",
                                &maxIntervals)) {
    return false;
  }

  if (maxIntervals < 0) {
    write_error_json_ex("invalid_args",
                        "allocWindow.params.maxIntervals must be >= 0", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  if (maxIntervals > (SpiceInt)(INT_MAX / 2)) {
    write_error_json_ex("invalid_args",
                        "allocWindow.params.maxIntervals is too large", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const SpiceInt windowSize = maxIntervals * 2;
  const size_t cellSize = (size_t)windowSize;
  if (cellSize > (SIZE_MAX / sizeof(SpiceDouble)) - (size_t)SPICE_CELL_CTRLSZ) {
    write_error_json_ex("invalid_args", "allocWindow.params.maxIntervals is too large",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  const size_t elemCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
  SpiceDouble *storage = (SpiceDouble *)calloc(elemCount, sizeof(SpiceDouble));
  if (storage == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceCell window;
  memset(&window, 0, sizeof(window));
  window.dtype = SPICE_DP;
  window.length = 0;
  window.size = windowSize;
  window.card = 0;
  window.isSet = SPICETRUE;
  window.adjust = SPICEFALSE;
  window.init = SPICEFALSE;
  window.base = (void *)storage;
  window.data = (void *)(storage + SPICE_CELL_CTRLSZ);

  ssize_c(windowSize, &window);
  scard_c(0, &window);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json_ex("spice_error", "SPICE error in allocWindow", NULL,
                        shortMsg, longMsg, traceMsg);
    free(storage);
    return false;
  }

  char asDetail[256];
  asDetail[0] = '\0';
  char *asName = NULL;
  jsmn_strdup_err_t asErr =
      jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
  if (asErr != JSMN_STRDUP_OK) {
    if (asErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    free(storage);
    return false;
  }

  bool ok = v2_add_ref_cell(refs,
                            refCount,
                            asName,
                            V2_REF_WINDOW,
                            &window,
                            (void *)storage);
  free(asName);
  if (!ok) {
    free(storage);
    return false;
  }

  return true;
}

static bool v2_execute_spice_call_step(const char *json, const jsmntok_t *tokens,
                                       const int tokenCount, const int stepTok,
                                       const int argsTok, V2RefEntry *refs,
                                       int *refCount) {
  int callTok = jsmn_find_object_key(json, tokens, stepTok, "call", tokenCount);
  int inTok = jsmn_find_object_key(json, tokens, stepTok, "in", tokenCount);
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (callTok < 0 || tokens[callTok].type != JSMN_STRING || inTok < 0 ||
      tokens[inTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request",
                        "spiceCall requires string call and array in",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char callDetail[256];
  callDetail[0] = '\0';
  char *callName = NULL;
  jsmn_strdup_err_t callErr =
      jsmn_strdup(json, &tokens[callTok], &callName, callDetail, sizeof(callDetail));
  if (callErr != JSMN_STRDUP_OK) {
    if (callErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          callDetail[0] ? callDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const int inputCount = tokens[inTok].size;

  if (strcmp(callName, "card_c") == 0 || strcmp(callName, "size_c") == 0) {
    if (inputCount != 1) {
      write_error_json_ex("invalid_request",
                          "spiceCall card_c/size_c expects one input",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall card_c/size_c requires string as",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int inExprTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       inExprTok,
                                       refs,
                                       *refCount,
                                       "spiceCall.in[0]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    SpiceInt out =
        (strcmp(callName, "card_c") == 0) ? card_c(&refs[refIndex].cell)
                                           : size_c(&refs[refIndex].cell);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json_ex("spice_error", "SPICE error in spiceCall", callName,
                          shortMsg, longMsg, traceMsg);
      free(callName);
      return false;
    }

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, out);
    free(asName);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "dskgd_c") == 0 || strcmp(callName, "dskb02_c") == 0) {
    if (inputCount != 1) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskgd_c/dskb02_c expects one selector input",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskgd_c/dskb02_c requires string as",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int selectorTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    if (selectorTok < 0 || selectorTok >= tokenCount ||
        tokens[selectorTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args",
                          "spiceCall dskgd_c/dskb02_c selector must be a string",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char selectorDetail[256];
    selectorDetail[0] = '\0';
    char *selector = NULL;
    jsmn_strdup_err_t selectorErr = jsmn_strdup(json,
                                                &tokens[selectorTok],
                                                &selector,
                                                selectorDetail,
                                                sizeof(selectorDetail));
    if (selectorErr != JSMN_STRDUP_OK) {
      if (selectorErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            selectorDetail[0] ? selectorDetail : NULL, NULL,
                            NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool selectorOk = false;
    if (strcmp(callName, "dskgd_c") == 0) {
      selectorOk = (strcmp(selector, "surfce") == 0 ||
                    strcmp(selector, "center") == 0);
    } else {
      selectorOk = (strcmp(selector, "nv") == 0 || strcmp(selector, "np") == 0);
    }

    if (!selectorOk) {
      write_error_json_ex("invalid_args",
                          "spiceCall selector is invalid for requested call",
                          selector,
                          NULL,
                          NULL,
                          NULL);
      free(selector);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file(
            strcmp(callName, "dskgd_c") == 0 ? "v2-dskgd" : "v2-dskb02",
            tempPath,
            sizeof(tempPath))) {
      free(selector);
      free(callName);
      return false;
    }

    SpiceInt handle = 0;
    dasopr_c(tempPath, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(selector);
      free(callName);
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      return false;
    }

    SpiceDLADescr dladsc;
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &dladsc, &found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      dascls_c(handle);
      unlink(tempPath);
      free(selector);
      free(callName);
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      return false;
    }

    if (found != SPICETRUE) {
      dascls_c(handle);
      unlink(tempPath);
      write_error_json_ex("invalid_request",
                          "spiceCall expected a DLA segment in minimal DSK",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(selector);
      free(callName);
      return false;
    }

    SpiceInt outValue = 0;

    if (strcmp(callName, "dskgd_c") == 0) {
      SpiceDSKDescr dskdsc;
      dskgd_c(handle, &dladsc, &dskdsc);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        dascls_c(handle);
        unlink(tempPath);
        free(selector);
        free(callName);
        write_error_json("SPICE error in dskgd", shortMsg, longMsg, traceMsg);
        return false;
      }

      outValue = (strcmp(selector, "surfce") == 0) ? dskdsc.surfce : dskdsc.center;
    } else {
      SpiceInt nv = 0;
      SpiceInt np = 0;
      SpiceInt nvxtot = 0;
      SpiceDouble vtxbds[3][2];
      SpiceDouble voxsiz = 0.0;
      SpiceDouble voxori[3];
      SpiceInt vgrext[3];
      SpiceInt cgscal = 0;
      SpiceInt vtxnpl = 0;
      SpiceInt voxnpt = 0;
      SpiceInt voxnpl = 0;

      dskb02_c(handle,
               &dladsc,
               &nv,
               &np,
               &nvxtot,
               vtxbds,
               &voxsiz,
               voxori,
               vgrext,
               &cgscal,
               &vtxnpl,
               &voxnpt,
               &voxnpl);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        dascls_c(handle);
        unlink(tempPath);
        free(selector);
        free(callName);
        write_error_json("SPICE error in dskb02", shortMsg, longMsg, traceMsg);
        return false;
      }

      outValue = (strcmp(selector, "nv") == 0) ? nv : np;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(selector);
      free(callName);
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      return false;
    }

    unlink(tempPath);

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(selector);
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, outValue);
    free(asName);
    free(selector);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "ekfind_c") == 0) {
    if (inputCount != 1) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekfind_c expects one query input",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekfind_c requires string as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    int queryTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    char *query = NULL;
    if (!v2_resolve_string_expr(json,
                                tokens,
                                tokenCount,
                                queryTok,
                                argsTok,
                                refs,
                                *refCount,
                                "spiceCall(ekfind_c).in[0]",
                                &query)) {
      free(callName);
      return false;
    }

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(query);
      free(callName);
      return false;
    }

    char *okRefName = v2_join_ref_suffix(asName, ".ok");
    char *nmrowsRefName = v2_join_ref_suffix(asName, ".nmrows");
    if (okRefName == NULL || nmrowsRefName == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(nmrowsRefName);
      free(okRefName);
      free(asName);
      free(query);
      free(callName);
      return false;
    }

    SpiceInt nmrows = 0;
    SpiceBoolean queryFailed = SPICEFALSE;
    SpiceChar errMsg[1841];
    errMsg[0] = '\0';
    ekfind_c(query, (SpiceInt)sizeof(errMsg), &nmrows, &queryFailed, errMsg);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(nmrowsRefName);
      free(okRefName);
      free(asName);
      free(query);
      free(callName);
      write_error_json("SPICE error in ekfind", shortMsg, longMsg, traceMsg);
      return false;
    }

    bool ok = v2_add_ref_bool(refs,
                              refCount,
                              okRefName,
                              queryFailed == SPICEFALSE ? SPICETRUE : SPICEFALSE);
    if (ok) {
      ok = v2_add_ref_int(refs,
                          refCount,
                          nmrowsRefName,
                          queryFailed == SPICEFALSE ? nmrows : 0);
    }

    free(nmrowsRefName);
    free(okRefName);
    free(asName);
    free(query);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "ekntab_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekntab_c expects no inputs",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekntab_c requires string as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    SpiceInt ntab = 0;
    ekntab_c(&ntab);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(callName);
      write_error_json("SPICE error in ekntab", shortMsg, longMsg, traceMsg);
      return false;
    }

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, ntab);
    free(asName);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "ektnam_c") == 0) {
    if (inputCount != 1) {
      write_error_json_ex("invalid_request",
                          "spiceCall ektnam_c expects one index input",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall ektnam_c requires string as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    int indexTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    SpiceInt index = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  indexTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ektnam_c).in[0]",
                                  &index)) {
      free(callName);
      return false;
    }

    if (index < 0) {
      write_error_json_ex("invalid_args",
                          "spiceCall(ektnam_c).in[0] must be >= 0",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    char tableName[256];
    memset(tableName, 0, sizeof(tableName));
    ektnam_c(index, (SpiceInt)sizeof(tableName), tableName);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(callName);
      write_error_json("SPICE error in ektnam", shortMsg, longMsg, traceMsg);
      return false;
    }

    trim_fixed_width_c_string_end(tableName, sizeof(tableName));

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_string(refs, refCount, asName, tableName);
    free(asName);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "eknseg_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall eknseg_c expects no inputs",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall eknseg_c requires string as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    char ekPath[PATH_MAX];
    if (!resolve_first_loaded_ek_path(ekPath, sizeof(ekPath), "spiceCall(eknseg_c)")) {
      free(callName);
      return false;
    }

    SpiceInt handle = 0;
    ekopr_c(ekPath, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(callName);
      write_error_json("SPICE error in ekopr (eknseg_c)", shortMsg, longMsg, traceMsg);
      return false;
    }

    SpiceInt nseg = 0;
    eknseg_c(handle, &nseg);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));

      reset_c();
      ekcls_c(handle);
      reset_c();

      free(callName);
      write_error_json("SPICE error in eknseg", shortMsg, longMsg, traceMsg);
      return false;
    }

    ekcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(callName);
      write_error_json("SPICE error in ekcls (eknseg_c cleanup)",
                       shortMsg,
                       longMsg,
                       traceMsg);
      return false;
    }

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, nseg);
    free(asName);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "ekopn_c") == 0 || strcmp(callName, "ekopr_c") == 0 ||
      strcmp(callName, "ekopw_c") == 0) {
    if (inputCount != 3) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekopn_c/ekopr_c/ekopw_c expects [tag, ifname, ncomch]",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekopn_c/ekopr_c/ekopw_c requires string as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    int tagTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    int ifnameTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int ncomchTok = jsmn_get_array_elem(tokens, inTok, 2, tokenCount);

    char *tag = NULL;
    if (!v2_resolve_string_expr(json,
                                tokens,
                                tokenCount,
                                tagTok,
                                argsTok,
                                refs,
                                *refCount,
                                "spiceCall(ekop*_c).in[0]",
                                &tag)) {
      free(callName);
      return false;
    }

    if (tag[0] == '\0') {
      write_error_json_ex("invalid_args",
                          "spiceCall(ekop*_c).in[0] must be a non-empty string",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(tag);
      free(callName);
      return false;
    }

    char *ifname = NULL;
    if (!v2_resolve_string_expr(json,
                                tokens,
                                tokenCount,
                                ifnameTok,
                                argsTok,
                                refs,
                                *refCount,
                                "spiceCall(ekop*_c).in[1]",
                                &ifname)) {
      free(tag);
      free(callName);
      return false;
    }

    SpiceInt ncomch = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  ncomchTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ekop*_c).in[2]",
                                  &ncomch)) {
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    if (ncomch < 0) {
      write_error_json_ex("invalid_args",
                          "spiceCall(ekop*_c).in[2] must be >= 0",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    int tempFd = -1;
    char detail[256];
    detail[0] = '\0';
    if (!build_file_io_temp_path(tag,
                                 ".bes",
                                 tempPath,
                                 sizeof(tempPath),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create temporary EK path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    if (tempFd >= 0) {
      close(tempFd);
      tempFd = -1;
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    if (strcmp(callName, "ekopn_c") == 0) {
      ekopn_c(tempPath, ifname, ncomch, &handle);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        unlink(tempPath);
        free(ifname);
        free(tag);
        free(callName);
        write_error_json("SPICE error in ekopn", shortMsg, longMsg, traceMsg);
        return false;
      }
    } else {
      SpiceInt seedHandle = 0;
      ekopn_c(tempPath, ifname, ncomch, &seedHandle);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        unlink(tempPath);
        free(ifname);
        free(tag);
        free(callName);
        write_error_json("SPICE error in ekopn (ekop*_c seed)",
                         shortMsg,
                         longMsg,
                         traceMsg);
        return false;
      }

      ekcls_c(seedHandle);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        unlink(tempPath);
        free(ifname);
        free(tag);
        free(callName);
        write_error_json("SPICE error in ekcls (ekop*_c seed cleanup)",
                         shortMsg,
                         longMsg,
                         traceMsg);
        return false;
      }

      if (strcmp(callName, "ekopr_c") == 0) {
        ekopr_c(tempPath, &handle);
      } else {
        ekopw_c(tempPath, &handle);
      }

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        unlink(tempPath);
        free(ifname);
        free(tag);
        free(callName);
        write_error_json("SPICE error in ekopr/ekopw", shortMsg, longMsg, traceMsg);
        return false;
      }
    }

    ekcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(ifname);
      free(tag);
      free(callName);
      write_error_json("SPICE error in ekcls (ekop*_c cleanup)",
                       shortMsg,
                       longMsg,
                       traceMsg);
      return false;
    }

    unlink(tempPath);

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, handle);
    free(asName);
    free(ifname);
    free(tag);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "ekcls_c") == 0) {
    if (asTok >= 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekcls_c does not allow as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (inputCount != 3) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekcls_c expects [tag, ifname, ncomch]",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    int tagTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    int ifnameTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int ncomchTok = jsmn_get_array_elem(tokens, inTok, 2, tokenCount);

    char *tag = NULL;
    if (!v2_resolve_string_expr(json,
                                tokens,
                                tokenCount,
                                tagTok,
                                argsTok,
                                refs,
                                *refCount,
                                "spiceCall(ekcls_c).in[0]",
                                &tag)) {
      free(callName);
      return false;
    }

    if (tag[0] == '\0') {
      write_error_json_ex("invalid_args",
                          "spiceCall(ekcls_c).in[0] must be a non-empty string",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(tag);
      free(callName);
      return false;
    }

    char *ifname = NULL;
    if (!v2_resolve_string_expr(json,
                                tokens,
                                tokenCount,
                                ifnameTok,
                                argsTok,
                                refs,
                                *refCount,
                                "spiceCall(ekcls_c).in[1]",
                                &ifname)) {
      free(tag);
      free(callName);
      return false;
    }

    SpiceInt ncomch = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  ncomchTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ekcls_c).in[2]",
                                  &ncomch)) {
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    if (ncomch < 0) {
      write_error_json_ex("invalid_args",
                          "spiceCall(ekcls_c).in[2] must be >= 0",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    int tempFd = -1;
    char detail[256];
    detail[0] = '\0';
    if (!build_file_io_temp_path(tag,
                                 ".bes",
                                 tempPath,
                                 sizeof(tempPath),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create temporary EK path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(ifname);
      free(tag);
      free(callName);
      return false;
    }

    if (tempFd >= 0) {
      close(tempFd);
      tempFd = -1;
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    ekopn_c(tempPath, ifname, ncomch, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(ifname);
      free(tag);
      free(callName);
      write_error_json("SPICE error in ekopn", shortMsg, longMsg, traceMsg);
      return false;
    }

    ekcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(ifname);
      free(tag);
      free(callName);
      write_error_json("SPICE error in ekcls", shortMsg, longMsg, traceMsg);
      return false;
    }

    unlink(tempPath);
    free(ifname);
    free(tag);
    free(callName);
    return true;
  }

  if (strcmp(callName, "ekgc_c") == 0 || strcmp(callName, "ekgd_c") == 0 ||
      strcmp(callName, "ekgi_c") == 0) {
    if (inputCount != 4) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekgc_c/ekgd_c/ekgi_c expects [query, selidx, row, elment]",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall ekgc_c/ekgd_c/ekgi_c requires string as",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    int queryTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    char *query = NULL;
    if (!v2_resolve_string_expr(json,
                                tokens,
                                tokenCount,
                                queryTok,
                                argsTok,
                                refs,
                                *refCount,
                                "spiceCall(ek*_c).in[0]",
                                &query)) {
      free(callName);
      return false;
    }

    int selidxTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int rowTok = jsmn_get_array_elem(tokens, inTok, 2, tokenCount);
    int elmentTok = jsmn_get_array_elem(tokens, inTok, 3, tokenCount);

    SpiceInt selidx = 0;
    SpiceInt row = 0;
    SpiceInt elment = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  selidxTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ek*_c).in[1]",
                                  &selidx) ||
        !v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  rowTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ek*_c).in[2]",
                                  &row) ||
        !v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  elmentTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ek*_c).in[3]",
                                  &elment)) {
      free(query);
      free(callName);
      return false;
    }

    if (selidx < 0 || row < 0 || elment < 0) {
      write_error_json_ex("invalid_args",
                          "spiceCall(ek*_c) selidx/row/elment must be >= 0",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(query);
      free(callName);
      return false;
    }

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(query);
      free(callName);
      return false;
    }

    char *foundRefName = v2_join_ref_suffix(asName, ".found");
    char *isNullRefName = v2_join_ref_suffix(asName, ".isNull");
    char *valueRefName = v2_join_ref_suffix(asName, ".value");
    if (foundRefName == NULL || isNullRefName == NULL || valueRefName == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(valueRefName);
      free(isNullRefName);
      free(foundRefName);
      free(asName);
      free(query);
      free(callName);
      return false;
    }

    SpiceInt nmrows = 0;
    SpiceBoolean queryFailed = SPICEFALSE;
    SpiceChar errMsg[1841];
    errMsg[0] = '\0';
    ekfind_c(query, (SpiceInt)sizeof(errMsg), &nmrows, &queryFailed, errMsg);
    (void)nmrows;

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(valueRefName);
      free(isNullRefName);
      free(foundRefName);
      free(asName);
      free(query);
      free(callName);
      write_error_json("SPICE error in ekfind (spiceCall prequery)",
                       shortMsg,
                       longMsg,
                       traceMsg);
      return false;
    }

    if (queryFailed == SPICETRUE) {
      write_error_json_ex("invalid_request",
                          "spiceCall query failed in ekfind",
                          errMsg[0] ? errMsg : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(valueRefName);
      free(isNullRefName);
      free(foundRefName);
      free(asName);
      free(query);
      free(callName);
      return false;
    }

    SpiceBoolean found = SPICEFALSE;
    SpiceBoolean isNull = SPICEFALSE;
    SpiceInt intValue = 0;
    SpiceDouble doubleValue = 0.0;
    SpiceChar charValue[1841];
    charValue[0] = '\0';

    if (strcmp(callName, "ekgc_c") == 0) {
      ekgc_c(selidx,
             row,
             elment,
             (SpiceInt)sizeof(charValue),
             charValue,
             &isNull,
             &found);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        free(valueRefName);
        free(isNullRefName);
        free(foundRefName);
        free(asName);
        free(query);
        free(callName);
        write_error_json("SPICE error in ekgc", shortMsg, longMsg, traceMsg);
        return false;
      }
    } else if (strcmp(callName, "ekgd_c") == 0) {
      ekgd_c(selidx, row, elment, &doubleValue, &isNull, &found);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        free(valueRefName);
        free(isNullRefName);
        free(foundRefName);
        free(asName);
        free(query);
        free(callName);
        write_error_json("SPICE error in ekgd", shortMsg, longMsg, traceMsg);
        return false;
      }
    } else {
      ekgi_c(selidx, row, elment, &intValue, &isNull, &found);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        free(valueRefName);
        free(isNullRefName);
        free(foundRefName);
        free(asName);
        free(query);
        free(callName);
        write_error_json("SPICE error in ekgi", shortMsg, longMsg, traceMsg);
        return false;
      }
    }

    bool ok = v2_add_ref_bool(refs, refCount, foundRefName, found);
    if (ok) {
      if (found == SPICETRUE) {
        ok = v2_add_ref_bool(refs, refCount, isNullRefName, isNull);
      } else {
        ok = v2_add_ref_null(refs, refCount, isNullRefName);
      }
    }

    if (ok) {
      if (found != SPICETRUE || isNull == SPICETRUE) {
        ok = v2_add_ref_null(refs, refCount, valueRefName);
      } else if (strcmp(callName, "ekgc_c") == 0) {
        ok = v2_add_ref_string(refs, refCount, valueRefName, charValue);
      } else if (strcmp(callName, "ekgd_c") == 0) {
        ok = v2_add_ref_double(refs, refCount, valueRefName, doubleValue);
      } else {
        ok = v2_add_ref_int(refs, refCount, valueRefName, intValue);
      }
    }

    free(valueRefName);
    free(isNullRefName);
    free(foundRefName);
    free(asName);
    free(query);
    free(callName);
    return ok;
  }

  if (asTok >= 0) {
    write_error_json_ex("invalid_request",
                        "spiceCall scard_c/ssize_c/valid_c/dskobj_c/dsksrf_c/dskmi2_c/dskopn_c/dskw02_c/readVirtualOutput does not allow as",
                        NULL, NULL, NULL, NULL);
    free(callName);
    return false;
  }

  if (strcmp(callName, "scard_c") == 0) {
    if (inputCount != 2) {
      write_error_json_ex("invalid_request",
                          "spiceCall scard_c expects [card, cellOrWindow]",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int cardTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    SpiceInt card = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  cardTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(scard_c).in[0]",
                                  &card)) {
      free(callName);
      return false;
    }

    if (card < 0) {
      write_error_json_ex("invalid_args", "spiceCall(scard_c).in[0] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int targetTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       targetTok,
                                       refs,
                                       *refCount,
                                       "spiceCall(scard_c).in[1]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    scard_c(card, &refs[refIndex].cell);
  } else if (strcmp(callName, "ssize_c") == 0) {
    if (inputCount != 2) {
      write_error_json_ex("invalid_request",
                          "spiceCall ssize_c expects [size, cellOrWindow]",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int sizeTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    SpiceInt newSize = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  sizeTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ssize_c).in[0]",
                                  &newSize)) {
      free(callName);
      return false;
    }

    if (newSize < 0) {
      write_error_json_ex("invalid_args", "spiceCall(ssize_c).in[0] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int targetTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       targetTok,
                                       refs,
                                       *refCount,
                                       "spiceCall(ssize_c).in[1]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    ssize_c(newSize, &refs[refIndex].cell);
  } else if (strcmp(callName, "valid_c") == 0) {
    if (inputCount != 3) {
      write_error_json_ex("invalid_request",
                          "spiceCall valid_c expects [size, n, cellOrWindow]",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int sizeTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    int nTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    SpiceInt sizeArg = 0;
    SpiceInt nArg = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  sizeTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(valid_c).in[0]",
                                  &sizeArg) ||
        !v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  nTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(valid_c).in[1]",
                                  &nArg)) {
      free(callName);
      return false;
    }

    if (sizeArg < 0) {
      write_error_json_ex("invalid_args", "spiceCall(valid_c).in[0] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }
    if (nArg < 0) {
      write_error_json_ex("invalid_args", "spiceCall(valid_c).in[1] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int targetTok = jsmn_get_array_elem(tokens, inTok, 2, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       targetTok,
                                       refs,
                                       *refCount,
                                       "spiceCall(valid_c).in[2]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    valid_c(sizeArg, nArg, &refs[refIndex].cell);
  } else if (strcmp(callName, "dskopn_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskopn_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char tempPath[PATH_MAX];
    int tempFd = -1;
    if (!build_file_io_temp_path("v2-dskopn",
                                 ".bds",
                                 tempPath,
                                 sizeof(tempPath),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create temporary DSK path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (tempFd >= 0) {
      close(tempFd);
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    dskopn_c(tempPath, "TSPICE", 0, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dskopn", shortMsg, longMsg, traceMsg);
      return false;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "dskmi2_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskmi2_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    if ((size_t)DSK_MINIMAL_WORKSZ > SIZE_MAX / sizeof(SpiceInt[2])) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(callName);
      return false;
    }

    SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) *
                                                (size_t)DSK_MINIMAL_WORKSZ);
    if (work == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(callName);
      return false;
    }

    SpiceDouble spaixd[SPICE_DSK02_IXDFIX];
    SpiceInt spaixi[DSK_MINIMAL_SPXISZ];

    dskmi2_c((SpiceInt)DSK_MINIMAL_NV,
             (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
             (SpiceInt)DSK_MINIMAL_NP,
             (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
             0.2,
             5,
             (SpiceInt)DSK_MINIMAL_WORKSZ,
             (SpiceInt)DSK_MINIMAL_VOXPSZ,
             (SpiceInt)DSK_MINIMAL_VOXLSZ,
             SPICETRUE,
             (SpiceInt)DSK_MINIMAL_SPXISZ,
             work,
             spaixd,
             spaixi);

    free(work);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(callName);
      write_error_json("SPICE error in dskmi2", shortMsg, longMsg, traceMsg);
      return false;
    }

    free(callName);
    return true;
  } else if (strcmp(callName, "dskw02_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskw02_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file("v2-dskw02", tempPath, sizeof(tempPath))) {
      free(callName);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "dskobj_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskobj_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file("v2-dskobj", tempPath, sizeof(tempPath))) {
      free(callName);
      return false;
    }

    SPICEINT_CELL(bodids, 100);
    dskobj_c(tempPath, &bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dskobj", shortMsg, longMsg, traceMsg);
      return false;
    }

    const SpiceInt bodyCount = card_c(&bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in card_c (dskobj)", shortMsg, longMsg,
                       traceMsg);
      return false;
    }

    if (bodyCount < 1) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "spiceCall(dskobj_c) expected at least one body id",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "dsksrf_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dsksrf_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file("v2-dsksrf", tempPath, sizeof(tempPath))) {
      free(callName);
      return false;
    }

    SPICEINT_CELL(bodids, 100);
    SPICEINT_CELL(srfids, 100);

    dskobj_c(tempPath, &bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dskobj (dsksrf setup)", shortMsg, longMsg,
                       traceMsg);
      return false;
    }

    const SpiceInt bodyCount = card_c(&bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in card_c (dsksrf body ids)", shortMsg,
                       longMsg, traceMsg);
      return false;
    }

    if (bodyCount < 1) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "spiceCall(dsksrf_c) expected at least one body id",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    const SpiceInt *bodyValues = (const SpiceInt *)bodids.data;
    const SpiceInt bodyid = bodyValues[0];

    dsksrf_c(tempPath, bodyid, &srfids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dsksrf", shortMsg, longMsg, traceMsg);
      return false;
    }

    const SpiceInt surfaceCount = card_c(&srfids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in card_c (dsksrf surface ids)", shortMsg,
                       longMsg, traceMsg);
      return false;
    }

    if (surfaceCount < 1) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "spiceCall(dsksrf_c) expected at least one surface id",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "readVirtualOutput") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall readVirtualOutput expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char tempPath[PATH_MAX];
    int tempFd = -1;
    if (!build_file_io_temp_path("v2-read-virtual-output",
                                 ".bsp",
                                 tempPath,
                                 sizeof(tempPath),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create temporary SPK path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (tempFd >= 0) {
      close(tempFd);
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    spkopn_c(tempPath, "TSPICE", 0, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in spkopn", shortMsg, longMsg, traceMsg);
      return false;
    }

    spkw08_c(handle,
             1000,
             0,
             "J2000",
             0,
             60,
             "TSPICE_V2_READ_VO",
             1,
             2,
             READ_VIRTUAL_OUTPUT_STATES,
             0,
             60);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      spkcls_c(handle);
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in spkw08", shortMsg, longMsg, traceMsg);
      return false;
    }

    spkcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in spkcls", shortMsg, longMsg, traceMsg);
      return false;
    }

    FILE *fp = fopen(tempPath, "rb");
    if (fp == NULL) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput could not open temporary output file",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    if (fseek(fp, 0, SEEK_END) != 0) {
      fclose(fp);
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput could not seek temporary output file",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    errno = 0;
    long fileBytes = ftell(fp);
    int ftellErrno = errno;
    fclose(fp);
    unlink(tempPath);

    if (fileBytes < 0) {
      char detail[256];
      if (ftellErrno != 0) {
        snprintf(detail, sizeof(detail), "ftell failed: %s", strerror(ftellErrno));
      } else {
        snprintf(detail, sizeof(detail), "ftell failed: unknown error");
      }

      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput could not determine temporary output file size",
                          detail,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    if (fileBytes == 0) {
      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput expected non-empty output bytes",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    free(callName);
    return true;
  } else {
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", callName,
                        NULL, NULL, NULL);
    free(callName);
    return false;
  }

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json_ex("spice_error", "SPICE error in spiceCall", callName,
                        shortMsg, longMsg, traceMsg);
    free(callName);
    return false;
  }

  free(callName);
  return true;
}

static bool v2_execute_free_cell_step(const char *json, const jsmntok_t *tokens,
                                      const int tokenCount, const int stepTok,
                                      const int argsTok, V2RefEntry *refs,
                                      const int refCount) {
  int targetTok =
      jsmn_find_object_key(json, tokens, stepTok, "target", tokenCount);
  if (targetTok < 0) {
    write_error_json_ex("invalid_request", "freeCell requires target", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  int refIndex = -1;
  if (!v2_resolve_cell_ref(json, tokens, tokenCount, targetTok, refs, refCount,
                           "freeCell.target", &refIndex)) {
    return false;
  }

  (void)argsTok;

  v2_free_ref_entry(&refs[refIndex]);
  return true;
}

static bool v2_execute_free_window_step(const char *json,
                                        const jsmntok_t *tokens,
                                        const int tokenCount,
                                        const int stepTok,
                                        const int argsTok,
                                        V2RefEntry *refs,
                                        const int refCount) {
  int targetTok =
      jsmn_find_object_key(json, tokens, stepTok, "target", tokenCount);
  if (targetTok < 0) {
    write_error_json_ex("invalid_request", "freeWindow requires target", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int refIndex = -1;
  if (!v2_resolve_window_ref(json,
                             tokens,
                             tokenCount,
                             targetTok,
                             refs,
                             refCount,
                             "freeWindow.target",
                             &refIndex)) {
    return false;
  }

  (void)argsTok;

  v2_free_ref_entry(&refs[refIndex]);
  return true;
}

typedef struct {
  char *data;
  size_t len;
  size_t cap;
} V2JsonBuffer;

static void v2_json_buffer_init(V2JsonBuffer *buf) {
  if (buf == NULL) {
    return;
  }

  buf->data = NULL;
  buf->len = 0;
  buf->cap = 0;
}

static void v2_json_buffer_free(V2JsonBuffer *buf) {
  if (buf == NULL) {
    return;
  }

  free(buf->data);
  buf->data = NULL;
  buf->len = 0;
  buf->cap = 0;
}

static bool v2_json_buffer_reserve(V2JsonBuffer *buf, const size_t extraBytes) {
  if (buf == NULL) {
    return false;
  }

  if (extraBytes > SIZE_MAX - buf->len - 1U) {
    return false;
  }

  const size_t need = buf->len + extraBytes + 1U;
  if (need <= buf->cap) {
    return true;
  }

  size_t nextCap = (buf->cap > 0) ? buf->cap : 128U;
  while (nextCap < need) {
    if (nextCap > (SIZE_MAX / 2U)) {
      nextCap = need;
      break;
    }
    nextCap *= 2U;
  }

  char *nextData = (char *)realloc(buf->data, nextCap);
  if (nextData == NULL) {
    return false;
  }

  buf->data = nextData;
  buf->cap = nextCap;
  return true;
}

static bool v2_json_buffer_append_bytes(V2JsonBuffer *buf, const char *src,
                                        const size_t srcLen) {
  if (srcLen == 0) {
    return true;
  }

  if (src == NULL) {
    return false;
  }

  if (!v2_json_buffer_reserve(buf, srcLen)) {
    return false;
  }

  memcpy(buf->data + buf->len, src, srcLen);
  buf->len += srcLen;
  buf->data[buf->len] = '\0';
  return true;
}

static bool v2_json_buffer_append_cstr(V2JsonBuffer *buf, const char *src) {
  if (src == NULL) {
    return false;
  }

  return v2_json_buffer_append_bytes(buf, src, strlen(src));
}

static bool v2_json_buffer_append_char(V2JsonBuffer *buf, const char c) {
  return v2_json_buffer_append_bytes(buf, &c, 1U);
}

static bool v2_json_buffer_append_int(V2JsonBuffer *buf, const SpiceInt value) {
  char tmp[64];
  const int written = snprintf(tmp, sizeof(tmp), "%" PRIdMAX, (intmax_t)value);
  if (written < 0 || (size_t)written >= sizeof(tmp)) {
    return false;
  }

  return v2_json_buffer_append_bytes(buf, tmp, (size_t)written);
}

static bool v2_json_buffer_append_double(V2JsonBuffer *buf,
                                         const SpiceDouble value) {
  if (!isfinite((double)value)) {
    return false;
  }

  char tmp[64];
  const int written = snprintf(tmp, sizeof(tmp), "%.17g", (double)value);
  if (written < 0 || (size_t)written >= sizeof(tmp)) {
    return false;
  }

  return v2_json_buffer_append_bytes(buf, tmp, (size_t)written);
}

static bool v2_json_buffer_append_escaped(V2JsonBuffer *buf, const char *s) {
  if (s == NULL) {
    return false;
  }

  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    const unsigned char c = *p;
    switch (c) {
    case '"':
      if (!v2_json_buffer_append_cstr(buf, "\\\"")) {
        return false;
      }
      break;
    case '\\':
      if (!v2_json_buffer_append_cstr(buf, "\\\\")) {
        return false;
      }
      break;
    case '\b':
      if (!v2_json_buffer_append_cstr(buf, "\\b")) {
        return false;
      }
      break;
    case '\f':
      if (!v2_json_buffer_append_cstr(buf, "\\f")) {
        return false;
      }
      break;
    case '\n':
      if (!v2_json_buffer_append_cstr(buf, "\\n")) {
        return false;
      }
      break;
    case '\r':
      if (!v2_json_buffer_append_cstr(buf, "\\r")) {
        return false;
      }
      break;
    case '\t':
      if (!v2_json_buffer_append_cstr(buf, "\\t")) {
        return false;
      }
      break;
    default:
      if (c < 0x20U) {
        char escape[7];
        const int escLen = snprintf(escape, sizeof(escape), "\\u%04x",
                                    (unsigned int)c);
        if (escLen != 6 || !v2_json_buffer_append_bytes(buf, escape, 6U)) {
          return false;
        }
      } else {
        if (!v2_json_buffer_append_char(buf, (char)c)) {
          return false;
        }
      }
      break;
    }
  }

  return true;
}

static bool v2_append_project_value_json(V2JsonBuffer *out, const char *json,
                                         const jsmntok_t *tokens,
                                         const int tokenCount,
                                         const int valueTok, const int argsTok,
                                         const V2RefEntry *refs,
                                         const int refCount) {
  const jsmntok_t *tok = &tokens[valueTok];
  if (tok->type == JSMN_PRIMITIVE) {
    if (!v2_json_buffer_append_bytes(out, json + tok->start,
                                     (size_t)(tok->end - tok->start))) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
    return true;
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "projectResult.out values must be primitive or string",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *value = NULL;
  jsmn_strdup_err_t valueErr =
      jsmn_strdup(json, tok, &value, detail, sizeof(detail));
  if (valueErr != JSMN_STRDUP_OK) {
    if (valueErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;
  if (v2_parse_ref_name(value, "$args.", &argName)) {
    int argTok = jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (argTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(value);
      return false;
    }

    SpiceInt argVal = 0;
    if (!v2_parse_int_token_or_error(json, &tokens[argTok], &argVal,
                                     "projectResult argument")) {
      free(value);
      return false;
    }

    if (!v2_json_buffer_append_int(out, argVal)) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(value);
      return false;
    }

    free(value);
    return true;
  }

  if (v2_parse_ref_name(value, "$refs.", &refName)) {
    int refIndex = v2_find_ref_index(refs, refCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(value);
      return false;
    }

    bool appendOk = false;
    switch (refs[refIndex].type) {
    case V2_REF_INT:
      appendOk = v2_json_buffer_append_int(out, refs[refIndex].intValue);
      break;
    case V2_REF_BOOL:
      appendOk = v2_json_buffer_append_cstr(
          out,
          refs[refIndex].boolValue == SPICETRUE ? "true" : "false");
      break;
    case V2_REF_DOUBLE:
      appendOk = v2_json_buffer_append_double(out, refs[refIndex].doubleValue);
      if (!appendOk) {
        write_error_json_ex("invalid_request",
                            "projectResult ref contains a non-finite double",
                            refName,
                            NULL,
                            NULL,
                            NULL);
        free(value);
        return false;
      }
      break;
    case V2_REF_STRING:
      appendOk = v2_json_buffer_append_char(out, '"') &&
                 v2_json_buffer_append_escaped(
                     out,
                     refs[refIndex].stringValue != NULL
                         ? refs[refIndex].stringValue
                         : "") &&
                 v2_json_buffer_append_char(out, '"');
      break;
    case V2_REF_NULL:
      appendOk = v2_json_buffer_append_cstr(out, "null");
      break;
    default:
      write_error_json_ex("invalid_args",
                          "projectResult ref must be a scalar value",
                          refName,
                          NULL,
                          NULL,
                          NULL);
      free(value);
      return false;
    }

    if (!appendOk) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(value);
      return false;
    }

    free(value);
    return true;
  }

  bool ok = v2_json_buffer_append_char(out, '"') &&
            v2_json_buffer_append_escaped(out, value) &&
            v2_json_buffer_append_char(out, '"');
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    free(value);
    return false;
  }

  free(value);
  return true;
}

static bool v2_materialize_project_result_object_json(
    const char *json, const jsmntok_t *tokens, const int tokenCount,
    const int outTok, const int argsTok, const V2RefEntry *refs,
    const int refCount, char **outJsonObject) {
  if (outJsonObject == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  *outJsonObject = NULL;

  if (outTok < 0 || outTok >= tokenCount || tokens[outTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "projectResult.out must be an object",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int pairCount = jsmn_object_pair_count(&tokens[outTok]);
  if (pairCount < 0) {
    write_error_json_ex("invalid_request", "projectResult.out parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  V2JsonBuffer out;
  v2_json_buffer_init(&out);
  if (!v2_json_buffer_append_char(&out, '{')) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  int idx = outTok + 1;
  bool first = true;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "projectResult.out parse error", NULL,
                          NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char *key = NULL;
    jsmn_strdup_err_t keyErr =
        jsmn_strdup(json, &tokens[keyTok], &key, detail, sizeof(detail));
    if (keyErr != JSMN_STRDUP_OK) {
      if (keyErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            detail[0] ? detail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      v2_json_buffer_free(&out);
      return false;
    }

    bool appendOk = true;
    if (!first) {
      appendOk = v2_json_buffer_append_char(&out, ',');
    }
    first = false;

    appendOk = appendOk && v2_json_buffer_append_char(&out, '"') &&
               v2_json_buffer_append_escaped(&out, key) &&
               v2_json_buffer_append_cstr(&out, "\":");
    free(key);

    if (!appendOk) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    if (!v2_append_project_value_json(&out, json, tokens, tokenCount, valueTok,
                                      argsTok, refs, refCount)) {
      v2_json_buffer_free(&out);
      return false;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
  }

  if (!v2_json_buffer_append_char(&out, '}')) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  *outJsonObject = out.data;
  return true;
}

static bool v2_dispatch_workflow_step(
    const char *json, const jsmntok_t *tokens, const int tokenCount,
    const int stepTok, const int opTok, const int argsTok, V2RefEntry *refs,
    int *refCount, const bool captureProjectResult,
    char **projectResultObjectJson, const char *unsupportedOpMessage) {
  if (jsmn_token_streq(json, &tokens[opTok], "allocCell")) {
    return v2_execute_alloc_cell_step(json, tokens, tokenCount, stepTok, argsTok,
                                      refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "allocWindow")) {
    return v2_execute_alloc_window_step(json, tokens, tokenCount, stepTok,
                                        argsTok, refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "spiceCall")) {
    return v2_execute_spice_call_step(json, tokens, tokenCount, stepTok, argsTok,
                                      refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "projectResult")) {
    int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
    char *nextProjectResult = NULL;
    if (!v2_materialize_project_result_object_json(
            json, tokens, tokenCount, outTok, argsTok, refs, *refCount,
            &nextProjectResult)) {
      return false;
    }

    if (captureProjectResult && projectResultObjectJson != NULL) {
      free(*projectResultObjectJson);
      *projectResultObjectJson = nextProjectResult;
    } else {
      free(nextProjectResult);
    }

    return true;
  }

  if (jsmn_token_streq(json, &tokens[opTok], "freeCell")) {
    return v2_execute_free_cell_step(json, tokens, tokenCount, stepTok, argsTok,
                                     refs, *refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "freeWindow")) {
    return v2_execute_free_window_step(json, tokens, tokenCount, stepTok,
                                       argsTok, refs, *refCount);
  }

  write_error_json_ex("unsupported_call", unsupportedOpMessage, NULL, NULL, NULL,
                      NULL);
  return false;
}

static bool v2_write_project_result_success_json(
    const char *projectResultObjectJson) {
  if (projectResultObjectJson == NULL) {
    write_error_json_ex("invalid_request",
                        "v2 workflow must include projectResult", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  fputs("{\"ok\":true,\"result\":", stdout);
  fputs(projectResultObjectJson, stdout);
  fputs("}\n", stdout);
  return true;
}

static bool v2_execute_workflow_request(const char *json, const jsmntok_t *tokens,
                                        const int tokenCount) {
  int argsTok = jsmn_find_object_key(json, tokens, 0, "args", tokenCount);
  if (argsTok < 0 || tokens[argsTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "v2 request requires object args", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int workflowTok =
      jsmn_find_object_key(json, tokens, 0, "workflow", tokenCount);
  if (workflowTok < 0 || tokens[workflowTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "v2 request requires workflow object",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int stepsTok =
      jsmn_find_object_key(json, tokens, workflowTok, "steps", tokenCount);
  if (stepsTok < 0 || tokens[stepsTok].type != JSMN_ARRAY ||
      tokens[stepsTok].size <= 0) {
    write_error_json_ex("invalid_request",
                        "v2 workflow.steps must be a non-empty array", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int cleanupTok =
      jsmn_find_object_key(json, tokens, workflowTok, "cleanup", tokenCount);
  if (cleanupTok >= 0 && tokens[cleanupTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "v2 workflow.cleanup must be an array",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  V2RefEntry refs[V2_MAX_REFS];
  memset(refs, 0, sizeof(refs));
  int refCount = 0;

  char *projectResultObjectJson = NULL;
  bool ok = true;

  for (int i = 0; i < tokens[stepsTok].size; i++) {
    int stepTok = jsmn_get_array_elem(tokens, stepsTok, i, tokenCount);
    if (stepTok < 0 || tokens[stepTok].type != JSMN_OBJECT) {
      write_error_json_ex("invalid_request", "v2 workflow step must be an object",
                          NULL, NULL, NULL, NULL);
      ok = false;
      break;
    }

    int opTok = jsmn_find_object_key(json, tokens, stepTok, "op", tokenCount);
    if (opTok < 0 || tokens[opTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "v2 workflow step missing string op",
                          NULL, NULL, NULL, NULL);
      ok = false;
      break;
    }

    if (!v2_dispatch_workflow_step(
            json, tokens, tokenCount, stepTok, opTok, argsTok, refs, &refCount,
            true, &projectResultObjectJson, "Unsupported v2 workflow op")) {
      ok = false;
      break;
    }
  }

  if (ok && projectResultObjectJson == NULL) {
    write_error_json_ex("invalid_request",
                        "v2 workflow must include projectResult", NULL, NULL,
                        NULL, NULL);
    ok = false;
  }

  if (ok && cleanupTok >= 0) {
    for (int i = 0; i < tokens[cleanupTok].size; i++) {
      int stepTok = jsmn_get_array_elem(tokens, cleanupTok, i, tokenCount);
      if (stepTok < 0 || tokens[stepTok].type != JSMN_OBJECT) {
        write_error_json_ex("invalid_request",
                            "v2 cleanup step must be an object", NULL, NULL,
                            NULL, NULL);
        ok = false;
        break;
      }

      int opTok = jsmn_find_object_key(json, tokens, stepTok, "op", tokenCount);
      if (opTok < 0 || tokens[opTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_request", "v2 cleanup step missing op", NULL,
                            NULL, NULL, NULL);
        ok = false;
        break;
      }

      if (!v2_dispatch_workflow_step(
              json, tokens, tokenCount, stepTok, opTok, argsTok, refs,
              &refCount, false, NULL, "Unsupported v2 cleanup op")) {
        ok = false;
        break;
      }
    }
  }

  if (ok) {
    ok = v2_write_project_result_success_json(projectResultObjectJson);
  }

  free(projectResultObjectJson);
  v2_free_all_refs(refs, refCount);
  return ok;
}

static bool apply_setup_kernels(const char *input, const jsmntok_t *tokens,
                                const int tokenCount, const int setupTok,
                                int *exitCode) {
  if (setupTok < 0 || tokens[setupTok].type != JSMN_OBJECT) {
    return true;
  }

  int kernelsTok =
      jsmn_find_object_key(input, tokens, setupTok, "kernels", tokenCount);
  if (kernelsTok < 0) {
    return true;
  }

  if (tokens[kernelsTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "setup.kernels must be an array", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int nKernels = tokens[kernelsTok].size;
  int idx = kernelsTok + 1;
  char strDetail[256];

  for (int i = 0; i < nKernels; i++) {
    if (idx >= tokenCount) {
      write_error_json_ex("invalid_request", "setup.kernels parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char *kernelPath = NULL;
    char *restrictToDir = NULL;

    if (tokens[idx].type == JSMN_STRING) {
      strDetail[0] = '\0';
      jsmn_strdup_err_t kErr =
          jsmn_strdup(input, &tokens[idx], &kernelPath, strDetail,
                      sizeof(strDetail));
      if (kErr != JSMN_STRDUP_OK) {
        if (kErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL,
                              NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        return false;
      }
    } else if (tokens[idx].type == JSMN_OBJECT) {
      int pathTok =
          jsmn_find_object_key(input, tokens, idx, "path", tokenCount);
      if (pathTok < 0 || tokens[pathTok].type != JSMN_STRING) {
        write_error_json_ex(
            "invalid_request",
            "setup.kernels entries must have a string 'path' field", NULL,
            NULL, NULL, NULL);
        return false;
      }

      strDetail[0] = '\0';
      jsmn_strdup_err_t pathErr =
          jsmn_strdup(input, &tokens[pathTok], &kernelPath, strDetail,
                      sizeof(strDetail));
      if (pathErr != JSMN_STRDUP_OK) {
        if (pathErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL,
                              NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        return false;
      }

      int restrictTok = jsmn_find_object_key(input, tokens, idx, "restrictToDir",
                                             tokenCount);
      if (restrictTok >= 0) {
        if (tokens[restrictTok].type != JSMN_STRING) {
          write_error_json_ex("invalid_request",
                              "setup.kernels[].restrictToDir must be a string",
                              NULL, NULL, NULL, NULL);
          free(kernelPath);
          return false;
        }

        strDetail[0] = '\0';
        jsmn_strdup_err_t restrictErr =
            jsmn_strdup(input, &tokens[restrictTok], &restrictToDir, strDetail,
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
          return false;
        }
      }
    } else {
      write_error_json_ex("invalid_request",
                          "setup.kernels entries must be strings or objects",
                          NULL, NULL, NULL, NULL);
      return false;
    }

    char *prevCwd = NULL;
    if (restrictToDir != NULL) {
      prevCwd = getcwd(NULL, 0);
      if (prevCwd == NULL) {
        write_error_json("Failed to getcwd before kernel load", NULL, NULL, NULL);
        *exitCode = 1;
        free(kernelPath);
        free(restrictToDir);
        return false;
      }

      if (chdir(restrictToDir) != 0) {
        char msg[512];
        snprintf(msg, sizeof(msg),
                 "Failed to chdir to restrictToDir: %s (dir=%s)",
                 strerror(errno), restrictToDir);
        write_error_json(msg, NULL, NULL, NULL);
        *exitCode = 1;
        free(prevCwd);
        free(kernelPath);
        free(restrictToDir);
        return false;
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
        *exitCode = 1;
        free(prevCwd);
        free(kernelPath);
        free(restrictToDir);
        return false;
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
      return false;
    }

    idx = jsmn_skip_subtree(tokens, idx, tokenCount);
  }

  return true;
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
  jsmn_parser parser;

  while (1) {
    tokens = (jsmntok_t *)malloc(sizeof(jsmntok_t) * (size_t)tokenCap);
    if (tokens == NULL) {
      free(input);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return 1;
    }

    jsmn_init(&parser);
    tokenCount = jsmn_parse(&parser, input, inputLen, tokens, (unsigned int)tokenCap);
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

  size_t firstNonWs = 0;
  while (firstNonWs < inputLen &&
         isspace((unsigned char)input[firstNonWs])) {
    firstNonWs++;
  }

  size_t endNonWs = inputLen;
  while (endNonWs > firstNonWs &&
         isspace((unsigned char)input[endNonWs - 1])) {
    endNonWs--;
  }

  // Enforce strict top-level parsing: exactly one JSON object spanning the
  // full non-whitespace payload. This rejects trailing bytes like
  // '{"call":"time.str2et"}garbage'.
  if (tokenCount >= 1 &&
      (tokens[0].start < 0 || tokens[0].end < 0 ||
       (size_t)tokens[0].start != firstNonWs ||
       (size_t)tokens[0].end != endNonWs ||
       parser.toksuper != -1)) {
    free(tokens);
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
  int schemaVersionTok =
      jsmn_find_object_key(input, tokens, 0, "schemaVersion", tokenCount);

  char *call = NULL;

  bool isV2Request = false;
  if (schemaVersionTok >= 0) {
    SpiceInt schemaVersion = 0;
    if (!v2_parse_int_token_or_error(input, &tokens[schemaVersionTok],
                                     &schemaVersion, "schemaVersion")) {
      goto done;
    }

    if (schemaVersion == 2) {
      isV2Request = true;
    } else if (schemaVersion != 1) {
      write_error_json_ex("invalid_request", "Unsupported schemaVersion", NULL,
                          NULL, NULL, NULL);
      goto done;
    }
  }

  // --- Per-case isolation + error policy.
  kclear_c();
  reset_c();
  erract_c("SET", 0, "RETURN");
  errprt_c("SET", 0, "NONE");

  if (!apply_setup_kernels(input, tokens, tokenCount, setupTok, &exitCode)) {
    goto done;
  }

  if (isV2Request) {
    (void)argsTok;
    (void)callTok;
    if (!v2_execute_workflow_request(input, tokens, tokenCount)) {
      goto done;
    }

    goto done;
  }

  if (callTok < 0) {
    write_error_json_ex("invalid_request", "Missing required field: call", NULL,
                        NULL, NULL, NULL);
    goto done;
  }

  if (tokens[callTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "call must be a string", NULL, NULL,
                        NULL, NULL);
    goto done;
  }

  char strDetail[256];
  strDetail[0] = '\0';
  jsmn_strdup_err_t callErr =
      jsmn_strdup(input, &tokens[callTok], &call, strDetail, sizeof(strDetail));
  if (callErr != JSMN_STRDUP_OK) {
    if (callErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    goto done;
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

  const CallId callId = parse_call_id(call);
  if (callId == CALL_NONE) {
    write_error_json_ex_with_call("unsupported_call", "Unsupported call", NULL,
                                  NULL, NULL, NULL, call);
    goto done;
  }

  switch (callId) {
  case CALL_TIME_STR2ET: {
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

  case CALL_TIME_ET2UTC: {
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

  case CALL_TIME_SPICE_VERSION: {
    const char *v = tkvrsn_c("TOOLKIT");

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spiceVersion", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(v);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_TKVRSN: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "time.tkvrsn expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tkvrsn expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *item = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &item, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (strcmp(item, "TOOLKIT") != 0) {
      write_error_json_ex("invalid_args", "time.tkvrsn expects args[0] to be \"TOOLKIT\"",
                          NULL, NULL, NULL, NULL);
      free(item);
      goto done;
    }

    const char *v = tkvrsn_c(item);
    free(item);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in tkvrsn", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(v);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_TIMOUT: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args",
                          "time.timout expects args[0]=number args[1]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int etTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int pictTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble et = 0.0;
    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }
    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex("invalid_args", "time.timout expects args[0] to be a number",
                          etParse == PARSE_TOO_LONG
                              ? "numeric literal too long"
                              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
                          NULL, NULL, NULL);
      goto done;
    }

    if (pictTok < 0 || pictTok >= tokenCount || tokens[pictTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.timout expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *picture = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pictErr =
        jsmn_strdup(input, &tokens[pictTok], &picture, strDetail, sizeof(strDetail));
    if (pictErr != JSMN_STRDUP_OK) {
      if (pictErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceChar out[4096];
    out[0] = '\0';
    timout_c(et, picture, (SpiceInt)sizeof(out), out);
    free(picture);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in timout", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(out);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_DELTET: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args",
                          "time.deltet expects args[0]=number args[1]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int epochTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int typeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble epoch = 0.0;
    parse_result epochParse = PARSE_INVALID;
    if (epochTok >= 0 && epochTok < tokenCount) {
      epochParse = jsmn_parse_double(input, &tokens[epochTok], &epoch);
    }
    if (epochTok < 0 || epochTok >= tokenCount || epochParse != PARSE_OK) {
      write_error_json_ex("invalid_args", "time.deltet expects args[0] to be a number",
                          epochParse == PARSE_TOO_LONG
                              ? "numeric literal too long"
                              : (epochParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
                          NULL, NULL, NULL);
      goto done;
    }

    if (typeTok < 0 || typeTok >= tokenCount || tokens[typeTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.deltet expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *eptype = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t typeErr =
        jsmn_strdup(input, &tokens[typeTok], &eptype, strDetail, sizeof(strDetail));
    if (typeErr != JSMN_STRDUP_OK) {
      if (typeErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (strcmp(eptype, "ET") != 0 && strcmp(eptype, "UTC") != 0) {
      write_error_json_ex("invalid_args",
                          "time.deltet expects args[1] to be \"ET\" or \"UTC\"",
                          NULL, NULL, NULL, NULL);
      free(eptype);
      goto done;
    }

    SpiceDouble delta = 0.0;
    deltet_c(epoch, eptype, &delta);
    free(eptype);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in deltet", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)delta);
    goto done;
  }

  case CALL_TIME_UNITIM: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args",
                          "time.unitim expects args[0]=number args[1]=string args[2]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int epochTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int inTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int outTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble epoch = 0.0;
    parse_result epochParse = PARSE_INVALID;
    if (epochTok >= 0 && epochTok < tokenCount) {
      epochParse = jsmn_parse_double(input, &tokens[epochTok], &epoch);
    }
    if (epochTok < 0 || epochTok >= tokenCount || epochParse != PARSE_OK) {
      write_error_json_ex("invalid_args", "time.unitim expects args[0] to be a number",
                          epochParse == PARSE_TOO_LONG
                              ? "numeric literal too long"
                              : (epochParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
                          NULL, NULL, NULL);
      goto done;
    }

    if (inTok < 0 || inTok >= tokenCount || tokens[inTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.unitim expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (outTok < 0 || outTok >= tokenCount || tokens[outTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.unitim expects args[2] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *insys = NULL;
    char *outsys = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t inErr =
        jsmn_strdup(input, &tokens[inTok], &insys, strDetail, sizeof(strDetail));
    if (inErr != JSMN_STRDUP_OK) {
      if (inErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t outErr =
        jsmn_strdup(input, &tokens[outTok], &outsys, strDetail, sizeof(strDetail));
    if (outErr != JSMN_STRDUP_OK) {
      if (outErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(insys);
      goto done;
    }

    if ((strcmp(insys, "TAI") != 0 && strcmp(insys, "UTC") != 0 && strcmp(insys, "TDB") != 0 &&
         strcmp(insys, "TDT") != 0 && strcmp(insys, "ET") != 0) ||
        (strcmp(outsys, "TAI") != 0 && strcmp(outsys, "UTC") != 0 && strcmp(outsys, "TDB") != 0 &&
         strcmp(outsys, "TDT") != 0 && strcmp(outsys, "ET") != 0)) {
      write_error_json_ex("invalid_args",
                          "time.unitim expects args[1]/args[2] to be valid time systems",
                          NULL, NULL, NULL, NULL);
      free(insys);
      free(outsys);
      goto done;
    }

    const SpiceDouble outEpoch = unitim_c(epoch, insys, outsys);
    free(insys);
    free(outsys);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in unitim", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)outEpoch);
    goto done;
  }

  case CALL_TIME_TPARSE: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "time.tparse expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int strTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (strTok < 0 || strTok >= tokenCount || tokens[strTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tparse expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *timstr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t strErr =
        jsmn_strdup(input, &tokens[strTok], &timstr, strDetail, sizeof(strDetail));
    if (strErr != JSMN_STRDUP_OK) {
      if (strErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble sp2000 = 0.0;
    SpiceChar errmsg[1024];
    errmsg[0] = '\0';
    tparse_c(timstr, (SpiceInt)sizeof(errmsg), &sp2000, errmsg);
    free(timstr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in tparse", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (errmsg[0] != '\0') {
      write_error_json_ex("invalid_args", errmsg, NULL, NULL, NULL, NULL);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)sp2000);
    goto done;
  }

  case CALL_TIME_TPICTR: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "time.tpictr expects args[0]=string args[1]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int sampleTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int templTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (sampleTok < 0 || sampleTok >= tokenCount || tokens[sampleTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tpictr expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (templTok < 0 || templTok >= tokenCount || tokens[templTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tpictr expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *sample = NULL;
    char *templ = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t sampleErr =
        jsmn_strdup(input, &tokens[sampleTok], &sample, strDetail, sizeof(strDetail));
    if (sampleErr != JSMN_STRDUP_OK) {
      if (sampleErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t templErr =
        jsmn_strdup(input, &tokens[templTok], &templ, strDetail, sizeof(strDetail));
    if (templErr != JSMN_STRDUP_OK) {
      if (templErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(sample);
      goto done;
    }

    SpiceChar pictur[4096];
    pictur[0] = '\0';
    snprintf(pictur, sizeof(pictur), "%s", templ);

    SpiceBoolean ok = SPICEFALSE;
    SpiceChar errmsg[4096];
    errmsg[0] = '\0';
    tpictr_c(sample, (SpiceInt)sizeof(pictur), (SpiceInt)sizeof(errmsg), pictur, &ok, errmsg);

    free(sample);
    free(templ);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in tpictr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (ok != SPICETRUE) {
      write_error_json(errmsg[0] ? errmsg : "tpictr failed", NULL, NULL, NULL);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(pictur);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_TIMDEF: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "time.timdef expects args[0]=string args[1]=string (and optional args[2]=string for SET)",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    int actionTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int itemTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (actionTok < 0 || actionTok >= tokenCount || tokens[actionTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.timdef expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.timdef expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *action = NULL;
    char *item = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t actionErr =
        jsmn_strdup(input, &tokens[actionTok], &action, strDetail, sizeof(strDetail));
    if (actionErr != JSMN_STRDUP_OK) {
      if (actionErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &item, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(action);
      goto done;
    }

    if (strcmp(action, "GET") == 0) {
      SpiceChar value[256];
      value[0] = '\0';
      timdef_c("GET", item, (SpiceInt)sizeof(value), value);

      free(action);
      free(item);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                            sizeof(traceMsg));
        write_error_json("SPICE error in timdef(GET)", shortMsg, longMsg, traceMsg);
        goto done;
      }

      fputs("{\"ok\":true,\"result\":\"", stdout);
      json_print_escaped(value);
      fputs("\"}\n", stdout);
      goto done;
    }

    if (strcmp(action, "SET") == 0) {
      if (tokens[argsTok].size < 3) {
        write_error_json_ex("invalid_args", "time.timdef SET expects args[2] to be a string",
                            NULL, NULL, NULL, NULL);
        free(action);
        free(item);
        goto done;
      }

      int valueTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
      if (valueTok < 0 || valueTok >= tokenCount || tokens[valueTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_args", "time.timdef SET expects args[2] to be a string",
                            NULL, NULL, NULL, NULL);
        free(action);
        free(item);
        goto done;
      }

      char *value = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t valErr =
          jsmn_strdup(input, &tokens[valueTok], &value, strDetail, sizeof(strDetail));
      if (valErr != JSMN_STRDUP_OK) {
        if (valErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        free(action);
        free(item);
        goto done;
      }

      timdef_c("SET", item, (SpiceInt)(strlen(value) + 1), value);

      free(action);
      free(item);
      free(value);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                            sizeof(traceMsg));
        write_error_json("SPICE error in timdef(SET)", shortMsg, longMsg, traceMsg);
        goto done;
      }

      fputs("{\"ok\":true,\"result\":null}\n", stdout);
      goto done;
    }

    write_error_json_ex("invalid_args", "time.timdef expects args[0] to be \"GET\" or \"SET\"",
                        NULL, NULL, NULL, NULL);
    free(action);
    free(item);
    goto done;
  }


  case CALL_BODN2C: {
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

  case CALL_BODC2N: {
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

  case CALL_BODC2S: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodc2s expects args[0] to be an integer (SpiceInt range)",
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
            "ids-names.bodc2s expects args[0] to be an integer (SpiceInt range)",
            codeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceChar name[64];
    name[0] = '\0';
    bodc2s_c(code, (SpiceInt)sizeof(name), name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodc2s", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(name);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_BODS2C: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bods2c expects args[0] to be a string",
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
          "ids-names.bods2c expects args[0] to be a string",
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
    bods2c_c(name, &code, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bods2c", shortMsg, longMsg, traceMsg);
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

  case CALL_BODDEF: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.boddef expects args[0]=string args[1]=integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int codeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.boddef expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

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
            "ids-names.boddef expects args[1] to be an integer (SpiceInt range)",
            codeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
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

    boddef_c(name, code);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in boddef", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_BODFND: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodfnd expects args[0]=integer (SpiceInt range) args[1]=string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int itemTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodfnd expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodfnd expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *itemRaw = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &itemRaw, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *item = NULL;
    const size_t itemRawLen = strlen(itemRaw);
    normalize_bod_item_err_t itemNorm = normalize_bod_item(itemRaw, &item);
    free(itemRaw);
    if (itemNorm != NORMALIZE_BOD_ITEM_OK) {
      if (itemNorm == NORMALIZE_BOD_ITEM_OOM) {
        write_error_json("Out of memory", NULL, NULL, NULL);
      } else if (itemNorm == NORMALIZE_BOD_ITEM_TOO_LONG) {
        char detail[128];
        snprintf(detail, sizeof(detail), "bod item too long (len=%zu, max=%zu bytes)", itemRawLen,
                 (size_t)MAX_BOD_ITEM_BYTES);
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodfnd expects args[1] to be a short string",
            detail,
            NULL,
            NULL,
            NULL);
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodfnd expects args[1] to be a string",
            NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char poolVar[2048];
    int poolLen = snprintf(poolVar, sizeof(poolVar), "BODY%" PRIdMAX "_%s", (intmax_t)body, item);
    if (poolLen < 0 || (size_t)poolLen >= sizeof(poolVar)) {
      free(item);
      write_error_json_ex("invalid_args", "bodfnd: pool var name too long", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceBoolean foundC = SPICEFALSE;
    SpiceInt nC = 0;
    SpiceChar typeC = 0;
    dtpool_c(poolVar, &foundC, &nC, &typeC);
    free(item);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodfnd", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // NAIF `bodfnd_c` is an existence check; it does not care whether the pool
    // var is numeric ('N') vs character ('C') typed.
    const bool out = (foundC == SPICETRUE);
    fprintf(stdout, "{\"ok\":true,\"result\":%s}\n", out ? "true" : "false");
    goto done;
  }

  case CALL_BODVAR: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodvar expects args[0]=integer (SpiceInt range) args[1]=string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int itemTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodvar expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodvar expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *itemRaw = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &itemRaw, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *item = NULL;
    const size_t itemRawLen = strlen(itemRaw);
    normalize_bod_item_err_t itemNorm = normalize_bod_item(itemRaw, &item);
    free(itemRaw);
    if (itemNorm != NORMALIZE_BOD_ITEM_OK) {
      if (itemNorm == NORMALIZE_BOD_ITEM_OOM) {
        write_error_json("Out of memory", NULL, NULL, NULL);
      } else if (itemNorm == NORMALIZE_BOD_ITEM_TOO_LONG) {
        char detail[128];
        snprintf(detail, sizeof(detail), "bod item too long (len=%zu, max=%zu bytes)", itemRawLen,
                 (size_t)MAX_BOD_ITEM_BYTES);
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodvar expects args[1] to be a short string",
            detail,
            NULL,
            NULL,
            NULL);
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodvar expects args[1] to be a string",
            NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char poolVar[2048];
    int poolLen = snprintf(poolVar, sizeof(poolVar), "BODY%" PRIdMAX "_%s", (intmax_t)body, item);
    if (poolLen < 0 || (size_t)poolLen >= sizeof(poolVar)) {
      free(item);
      write_error_json_ex("invalid_args", "bodvar: pool var name too long", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceBoolean foundC = SPICEFALSE;
    SpiceInt nC = 0;
    SpiceChar typeC = 0;
    dtpool_c(poolVar, &foundC, &nC, &typeC);

    if (failed_c() == SPICETRUE) {
      free(item);
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodvar (dtpool)", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (foundC != SPICETRUE || typeC != 'N' || nC <= 0) {
      free(item);
      fputs("{\"ok\":true,\"result\":[]}\n", stdout);
      goto done;
    }

    if (nC > (SpiceInt)BODY_CONST_MAX_VALUES) {
      free(item);
      write_error_json_ex(
          "invalid_args",
          "bodvar(): BODY constant has too many values",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    const SpiceInt maxn = nC;
    SpiceDouble *values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)maxn);
    if (values == NULL) {
      free(item);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt dim = 0;
    bodvcd_c(body, item, maxn, &dim, values);
    free(item);

    if (failed_c() == SPICETRUE) {
      free(values);
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodvar", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (dim < 0) {
      dim = 0;
    }
    if (dim > maxn) {
      dim = maxn;
    }

    fputs("{\"ok\":true,\"result\":[", stdout);
    for (SpiceInt i = 0; i < dim; i++) {
      if (i != 0) {
        fputc(',', stdout);
      }
      fprintf(stdout, "%.17g", (double)values[i]);
    }
    fputs("]}\n", stdout);
    free(values);
    goto done;
  }


  case CALL_NAMFRM: {
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

  case CALL_FRMNAM: {
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

  case CALL_CIDFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.cidfrm expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int centerTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt center = 0;
    parse_result centerParse = PARSE_INVALID;
    if (centerTok >= 0 && centerTok < tokenCount) {
      centerParse = jsmn_parse_int(input, &tokens[centerTok], &center);
    }

    if (centerTok < 0 || centerTok >= tokenCount || centerParse != PARSE_OK) {
      if (centerParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.cidfrm expects args[0] to be an integer (SpiceInt range)",
            centerParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    SpiceChar frname[64];
    frname[0] = '\0';
    SpiceBoolean found = SPICEFALSE;
    cidfrm_c(center, (SpiceInt)sizeof(frname), &frcode, frname, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in cidfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"frcode\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frcode);
    fputs(",\"frname\":\"", stdout);
    json_print_escaped(frname);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_CNMFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.cnmfrm expects args[0] to be a string",
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
          "frames.cnmfrm expects args[0] to be a string",
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
    SpiceChar frname[64];
    frname[0] = '\0';
    SpiceBoolean found = SPICEFALSE;
    cnmfrm_c(name, (SpiceInt)sizeof(frname), &frcode, frname, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in cnmfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"frcode\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frcode);
    fputs(",\"frname\":\"", stdout);
    json_print_escaped(frname);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_FRINFO: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.frinfo expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int idTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt frameId = 0;
    parse_result idParse = PARSE_INVALID;
    if (idTok >= 0 && idTok < tokenCount) {
      idParse = jsmn_parse_int(input, &tokens[idTok], &frameId);
    }

    if (idTok < 0 || idTok >= tokenCount || idParse != PARSE_OK) {
      if (idParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.frinfo expects args[0] to be an integer (SpiceInt range)",
            idParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt center = 0;
    SpiceInt frameClass = 0;
    SpiceInt classId = 0;
    SpiceBoolean found = SPICEFALSE;
    frinfo_c(frameId, &center, &frameClass, &classId, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in frinfo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"center\":%" PRIdMAX ",\"frameClass\":%" PRIdMAX ",\"classId\":%" PRIdMAX "}}\n",
            (intmax_t)center, (intmax_t)frameClass, (intmax_t)classId);
    goto done;
  }

  case CALL_CCIFRM: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "frames.ccifrm expects args[0]=integer (SpiceInt range) args[1]=integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int frClassTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int classIdTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt frClass = 0;
    parse_result frClassParse = PARSE_INVALID;
    if (frClassTok >= 0 && frClassTok < tokenCount) {
      frClassParse = jsmn_parse_int(input, &tokens[frClassTok], &frClass);
    }

    if (frClassTok < 0 || frClassTok >= tokenCount || frClassParse != PARSE_OK) {
      if (frClassParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.ccifrm expects args[0] to be an integer (SpiceInt range)",
            frClassParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt clssid = 0;
    parse_result clssidParse = PARSE_INVALID;
    if (classIdTok >= 0 && classIdTok < tokenCount) {
      clssidParse = jsmn_parse_int(input, &tokens[classIdTok], &clssid);
    }

    if (classIdTok < 0 || classIdTok >= tokenCount || clssidParse != PARSE_OK) {
      if (clssidParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.ccifrm expects args[1] to be an integer (SpiceInt range)",
            clssidParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    SpiceChar frname[64];
    frname[0] = '\0';
    SpiceInt center = 0;
    SpiceBoolean found = SPICEFALSE;

    ccifrm_c(frClass, clssid, (SpiceInt)sizeof(frname), &frcode, frname, &center, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in ccifrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"frcode\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frcode);
    fputs(",\"frname\":\"", stdout);
    json_print_escaped(frname);
    fputs("\",\"center\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)center);
    fputs("}}\n", stdout);
    goto done;
  }


  case CALL_PXFORM: {
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

  case CALL_SXFORM: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "frames.sxform expects args[0]=string args[1]=string args[2]=number",
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
          "frames.sxform expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    if (toTok < 0 || toTok >= tokenCount || tokens[toTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.sxform expects args[1] to be a string",
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
          "frames.sxform expects args[2] to be a number",
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

    SpiceDouble x[6][6];
    sxform_c(from, to, et, x);
    free(from);
    free(to);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in sxform", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // Success: row-major matrix.
    fputs("{\"ok\":true,\"result\":[", stdout);
    for (int r = 0; r < 6; r++) {
      for (int c = 0; c < 6; c++) {
        const int i = r * 6 + c;
        if (i != 0) {
          fputc(',', stdout);
        }
        fprintf(stdout, "%.17g", (double)x[r][c]);
      }
    }
    fputs("]}\n", stdout);
    goto done;
  }



  // coords-vectors
  case CALL_AXISAR: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.axisar expects args[0]=vec3 args[1]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int axisTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int angleTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble axis[3];
    if (!jsmn_parse_vec3(input, tokens, axisTok, tokenCount, axis)) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.axisar expects args[0] to be a length-3 array of numbers",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble angle = 0.0;
    parse_result angleParse = PARSE_INVALID;
    if (angleTok >= 0 && angleTok < tokenCount) {
      angleParse = jsmn_parse_double(input, &tokens[angleTok], &angle);
    }
    if (angleTok < 0 || angleTok >= tokenCount || angleParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.axisar expects args[1] to be a number",
          angleParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (angleParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble m[3][3];
    axisar_c(axis, angle, m);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in axisar", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(m);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_GEOREC: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.georec expects args[0]=lon args[1]=lat args[2]=alt args[3]=re args[4]=f",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int lonTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int latTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int altTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int reTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int fTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    SpiceDouble alt = 0.0;
    SpiceDouble re = 0.0;
    SpiceDouble f = 0.0;

    if (lonTok < 0 || lonTok >= tokenCount || jsmn_parse_double(input, &tokens[lonTok], &lon) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (latTok < 0 || latTok >= tokenCount || jsmn_parse_double(input, &tokens[latTok], &lat) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (altTok < 0 || altTok >= tokenCount || jsmn_parse_double(input, &tokens[altTok], &alt) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (reTok < 0 || reTok >= tokenCount || jsmn_parse_double(input, &tokens[reTok], &re) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[3] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (fTok < 0 || fTok >= tokenCount || jsmn_parse_double(input, &tokens[fTok], &f) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[4] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble rect[3];
    georec_c(lon, lat, alt, re, f, rect);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in georec", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(rect, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_LATREC: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.latrec expects args[0]=radius args[1]=lon args[2]=lat",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int lonTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int latTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble radius = 0.0;
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;

    if (rTok < 0 || rTok >= tokenCount || jsmn_parse_double(input, &tokens[rTok], &radius) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.latrec expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (lonTok < 0 || lonTok >= tokenCount || jsmn_parse_double(input, &tokens[lonTok], &lon) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.latrec expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (latTok < 0 || latTok >= tokenCount || jsmn_parse_double(input, &tokens[latTok], &lat) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.latrec expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble rect[3];
    latrec_c(radius, lon, lat, rect);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in latrec", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(rect, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_MTXV: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mtxv expects args[0]=mat3 args[1]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int mTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int vTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble m[3][3];
    if (!jsmn_parse_mat3_rowmajor(input, tokens, mTok, tokenCount, m)) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mtxv expects args[0] to be a length-9 array of numbers",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mtxv expects args[1] to be a length-3 array of numbers",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble out[3];
    mtxv_c(m, v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in mtxv", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_MXM: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mxm expects args[0]=mat3 args[1]=mat3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3][3];
    SpiceDouble b[3][3];

    if (!jsmn_parse_mat3_rowmajor(input, tokens, aTok, tokenCount, a)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxm expects args[0] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!jsmn_parse_mat3_rowmajor(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxm expects args[1] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3][3];
    mxm_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in mxm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(out);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_MXV: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mxv expects args[0]=mat3 args[1]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int mTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int vTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble m[3][3];
    if (!jsmn_parse_mat3_rowmajor(input, tokens, mTok, tokenCount, m)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxv expects args[0] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxv expects args[1] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    mxv_c(m, v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in mxv", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_RECGEO: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.recgeo expects args[0]=vec3 args[1]=re args[2]=f",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rectTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int reTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int fTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble rect[3];
    if (!jsmn_parse_vec3(input, tokens, rectTok, tokenCount, rect)) {
      write_error_json_ex("invalid_args", "coords-vectors.recgeo expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble re = 0.0;
    SpiceDouble f = 0.0;
    if (reTok < 0 || reTok >= tokenCount || jsmn_parse_double(input, &tokens[reTok], &re) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.recgeo expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (fTok < 0 || fTok >= tokenCount || jsmn_parse_double(input, &tokens[fTok], &f) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.recgeo expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    SpiceDouble alt = 0.0;
    recgeo_c(rect, re, f, &lon, &lat, &alt);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in recgeo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"lon\":%.17g,\"lat\":%.17g,\"alt\":%.17g}}\n",
            (double)lon, (double)lat, (double)alt);
    goto done;
  }

  case CALL_RECLAT: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.reclat expects args[0]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rectTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble rect[3];
    if (!jsmn_parse_vec3(input, tokens, rectTok, tokenCount, rect)) {
      write_error_json_ex("invalid_args", "coords-vectors.reclat expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble radius = 0.0;
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    reclat_c(rect, &radius, &lon, &lat);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in reclat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"radius\":%.17g,\"lon\":%.17g,\"lat\":%.17g}}\n",
            (double)radius, (double)lon, (double)lat);
    goto done;
  }

  case CALL_RECSPH: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.recsph expects args[0]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rectTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble rect[3];
    if (!jsmn_parse_vec3(input, tokens, rectTok, tokenCount, rect)) {
      write_error_json_ex("invalid_args", "coords-vectors.recsph expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble radius = 0.0;
    SpiceDouble colat = 0.0;
    SpiceDouble lon = 0.0;
    recsph_c(rect, &radius, &colat, &lon);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in recsph", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"radius\":%.17g,\"colat\":%.17g,\"lon\":%.17g}}\n",
            (double)radius, (double)colat, (double)lon);
    goto done;
  }

  case CALL_ROTATE: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.rotate expects args[0]=angle args[1]=axis",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int angTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int axisTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble angle = 0.0;
    if (angTok < 0 || angTok >= tokenCount || jsmn_parse_double(input, &tokens[angTok], &angle) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.rotate expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt axis = 0;
    parse_result axisParse = PARSE_INVALID;
    if (axisTok >= 0 && axisTok < tokenCount) {
      axisParse = jsmn_parse_int(input, &tokens[axisTok], &axis);
    }

    if (axisTok < 0 || axisTok >= tokenCount || axisParse != PARSE_OK) {
      if (axisParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "coords-vectors.rotate expects args[1] to be an integer (SpiceInt range)",
            axisParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble m[3][3];
    rotate_c(angle, axis, m);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in rotate", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(m);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_ROTMAT: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.rotmat expects args[0]=mat3 args[1]=angle args[2]=axis",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int mTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int angTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int axisTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble m[3][3];
    if (!jsmn_parse_mat3_rowmajor(input, tokens, mTok, tokenCount, m)) {
      write_error_json_ex("invalid_args", "coords-vectors.rotmat expects args[0] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble angle = 0.0;
    if (angTok < 0 || angTok >= tokenCount || jsmn_parse_double(input, &tokens[angTok], &angle) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.rotmat expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt axis = 0;
    parse_result axisParse = PARSE_INVALID;
    if (axisTok >= 0 && axisTok < tokenCount) {
      axisParse = jsmn_parse_int(input, &tokens[axisTok], &axis);
    }

    if (axisTok < 0 || axisTok >= tokenCount || axisParse != PARSE_OK) {
      if (axisParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "coords-vectors.rotmat expects args[2] to be an integer (SpiceInt range)",
            axisParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble out[3][3];
    rotmat_c(m, angle, axis, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in rotmat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(out);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_SPHREC: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.sphrec expects args[0]=radius args[1]=colat args[2]=lon",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int cTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int lTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble radius = 0.0;
    SpiceDouble colat = 0.0;
    SpiceDouble lon = 0.0;

    if (rTok < 0 || rTok >= tokenCount || jsmn_parse_double(input, &tokens[rTok], &radius) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.sphrec expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (cTok < 0 || cTok >= tokenCount || jsmn_parse_double(input, &tokens[cTok], &colat) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.sphrec expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (lTok < 0 || lTok >= tokenCount || jsmn_parse_double(input, &tokens[lTok], &lon) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.sphrec expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble rect[3];
    sphrec_c(radius, colat, lon, rect);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in sphrec", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(rect, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VADD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vadd expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vadd expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vadd_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vadd", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VCRSS: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vcrss expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vcrss expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vcrss_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vcrss", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VDOT: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vdot expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vdot expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    const SpiceDouble out = vdot_c(a, b);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vdot", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)out);
    goto done;
  }

  case CALL_VHAT: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "coords-vectors.vhat expects args[0]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int vTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vhat expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vhat_c(v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vhat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VMINUS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "coords-vectors.vminus expects args[0]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int vTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vminus expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vminus_c(v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vminus", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VNORM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "coords-vectors.vnorm expects args[0]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int vTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vnorm expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    const SpiceDouble out = vnorm_c(v);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vnorm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)out);
    goto done;
  }

  case CALL_VSCL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vscl expects args[0]=number args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int sTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int vTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble s = 0.0;
    if (sTok < 0 || sTok >= tokenCount || jsmn_parse_double(input, &tokens[sTok], &s) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.vscl expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vscl expects args[1] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vscl_c(s, v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vscl", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VSUB: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vsub expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vsub expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vsub_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vsub", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }




  // --- ephemeris --------------------------------------------------------

  case CALL_SPKEZR: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[0]=string args[1]=number args[2]=string args[3]=string args[4]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targetTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int observerTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    if (targetTok < 0 || targetTok >= tokenCount || tokens[targetTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (observerTok < 0 || observerTok >= tokenCount || tokens[observerTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[4] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *target = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t targetErr =
        jsmn_strdup(input, &tokens[targetTok], &target, strDetail, sizeof(strDetail));
    if (targetErr != JSMN_STRDUP_OK) {
      if (targetErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      free(target);
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *observer = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t obsErr =
        jsmn_strdup(input, &tokens[observerTok], &observer, strDetail, sizeof(strDetail));
    if (obsErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      free(abcorr);
      if (obsErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkezr_c(target, et, ref, abcorr, observer, state, &lt);

    free(target);
    free(ref);
    free(abcorr);
    free(observer);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkezr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"state\":", stdout);
    json_print_double_array(state, 6);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKPOS: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[0]=string args[1]=number args[2]=string args[3]=string args[4]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targetTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int observerTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    if (targetTok < 0 || targetTok >= tokenCount || tokens[targetTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (observerTok < 0 || observerTok >= tokenCount || tokens[observerTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[4] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *target = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t targetErr =
        jsmn_strdup(input, &tokens[targetTok], &target, strDetail, sizeof(strDetail));
    if (targetErr != JSMN_STRDUP_OK) {
      if (targetErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      free(target);
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *observer = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t obsErr =
        jsmn_strdup(input, &tokens[observerTok], &observer, strDetail, sizeof(strDetail));
    if (obsErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      free(abcorr);
      if (obsErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkpos_c(target, et, ref, abcorr, observer, pos, &lt);

    free(target);
    free(ref);
    free(abcorr);
    free(observer);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkpos", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"pos\":", stdout);
    json_print_double_array(pos, 3);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKEZ: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[0]=int args[1]=number args[2]=string args[3]=string args[4]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkez expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkez expects args[4] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkez_c(targ, et, ref, abcorr, obs, state, &lt);

    free(ref);
    free(abcorr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkez", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"state\":", stdout);
    json_print_double_array(state, 6);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKEZP: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[0]=int args[1]=number args[2]=string args[3]=string args[4]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkezp expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkezp expects args[4] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkezp_c(targ, et, ref, abcorr, obs, pos, &lt);

    free(ref);
    free(abcorr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkezp", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"pos\":", stdout);
    json_print_double_array(pos, 3);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKGEO: {
    if (tokens[argsTok].size < 4) {
      write_error_json_ex("invalid_args", "ephemeris.spkgeo expects args[0]=int args[1]=number args[2]=string args[3]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgeo expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkgeo expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkgeo expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgeo expects args[3] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkgeo_c(targ, et, ref, obs, state, &lt);

    free(ref);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkgeo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"state\":", stdout);
    json_print_double_array(state, 6);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKGPS: {
    if (tokens[argsTok].size < 4) {
      write_error_json_ex("invalid_args", "ephemeris.spkgps expects args[0]=int args[1]=number args[2]=string args[3]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgps expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkgps expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkgps expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgps expects args[3] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkgps_c(targ, et, ref, obs, pos, &lt);

    free(ref);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkgps", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"pos\":", stdout);
    json_print_double_array(pos, 3);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKSSB: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "ephemeris.spkssb expects args[0]=int args[1]=number args[2]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkssb expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkssb expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkssb expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    spkssb_c(targ, et, ref, state);

    free(ref);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkssb", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(state, 6);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_SPKPDS: {
    if (tokens[argsTok].size < 6) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[0]=int args[1]=int args[2]=string args[3]=int args[4]=number args[5]=number", NULL, NULL, NULL, NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int centerTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int frameTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int typeTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int firstTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);
    int lastTok = jsmn_get_array_elem(tokens, argsTok, 5, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkpds expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt center = 0;
    parse_result centerParse = PARSE_INVALID;
    if (centerTok >= 0 && centerTok < tokenCount) {
      centerParse = jsmn_parse_int(input, &tokens[centerTok], &center);
    }

    if (centerTok < 0 || centerTok >= tokenCount || centerParse != PARSE_OK) {
      if (centerParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkpds expects args[1] to be an integer (SpiceInt range)",
            centerParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    if (frameTok < 0 || frameTok >= tokenCount || tokens[frameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt type = 0;
    parse_result typeParse = PARSE_INVALID;
    if (typeTok >= 0 && typeTok < tokenCount) {
      typeParse = jsmn_parse_int(input, &tokens[typeTok], &type);
    }

    if (typeTok < 0 || typeTok >= tokenCount || typeParse != PARSE_OK) {
      if (typeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkpds expects args[3] to be an integer (SpiceInt range)",
            typeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble first = 0.0;
    if (firstTok < 0 || firstTok >= tokenCount || jsmn_parse_double(input, &tokens[firstTok], &first) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[4] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble last = 0.0;
    if (lastTok < 0 || lastTok >= tokenCount || jsmn_parse_double(input, &tokens[lastTok], &last) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[5] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *frame = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t frameErr =
        jsmn_strdup(input, &tokens[frameTok], &frame, strDetail, sizeof(strDetail));
    if (frameErr != JSMN_STRDUP_OK) {
      if (frameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble descr[5] = {0};
    spkpds_c(body, center, frame, type, first, last, descr);

    free(frame);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkpds", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(descr, 5);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_SPKUDS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "ephemeris.spkuds expects args[0]=descr5", NULL, NULL, NULL, NULL);
      goto done;
    }

    int descrTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble descr[5] = {0};
    if (!jsmn_parse_double_array_fixed(input, tokens, descrTok, tokenCount, 5, descr)) {
      write_error_json_ex("invalid_args", "ephemeris.spkuds expects args[0] to be a length-5 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt body = 0;
    SpiceInt center = 0;
    SpiceInt frame = 0;
    SpiceInt type = 0;
    SpiceDouble first = 0.0;
    SpiceDouble last = 0.0;
    SpiceInt baddr = 0;
    SpiceInt eaddr = 0;

    spkuds_c(descr, &body, &center, &frame, &type, &first, &last, &baddr, &eaddr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkuds", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"body\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)body);
    fputs(",\"center\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)center);
    fputs(",\"frame\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frame);
    fputs(",\"type\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)type);
    fputs(",\"first\":", stdout);
    fprintf(stdout, "%.17g", (double)first);
    fputs(",\"last\":", stdout);
    fprintf(stdout, "%.17g", (double)last);
    fputs(",\"baddr\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)baddr);
    fputs(",\"eaddr\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)eaddr);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKSFS: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "ephemeris.spksfs expects args[0]=int args[1]=number", NULL, NULL, NULL, NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spksfs expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spksfs expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt handle = 0;
    SpiceDouble descr[5] = {0};
    SpiceChar ident[41];
    ident[0] = '\0';
    SpiceBoolean found = SPICEFALSE;

    spksfs_c(body, et, (SpiceInt)sizeof(ident), &handle, descr, ident, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spksfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    trim_fixed_width_c_string_end(ident, sizeof(ident));

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"handle\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)handle);
    fputs(",\"descr\":", stdout);
    json_print_double_array(descr, 5);
    fputs(",\"ident\":\"", stdout);
    json_print_escaped(ident);
    fputs("\"}}\n", stdout);
    goto done;
  }


  case CALL_FILE_IO_EXISTS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.exists expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.exists expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.exists expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    const SpiceBoolean fileExists = exists_c(filePath);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in exists", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"exists\":", stdout);
    fputs(fileExists == SPICETRUE ? "true" : "false", stdout);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_GETFAT: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.getfat expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.getfat expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.getfat expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceChar arch[32];
    SpiceChar type[32];
    arch[0] = '\0';
    type[0] = '\0';

    getfat_c(filePath, (SpiceInt)sizeof(arch), (SpiceInt)sizeof(type), arch, type);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in getfat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    trim_fixed_width_c_string_end(arch, sizeof(arch));
    trim_fixed_width_c_string_end(type, sizeof(type));

    fputs("{\"ok\":true,\"result\":{\"arch\":\"", stdout);
    json_print_escaped(arch);
    fputs("\",\"type\":\"", stdout);
    json_print_escaped(type);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFOPR: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dafopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dafopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dafopr expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"opened\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFCLS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dafcls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dafcls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dafcls expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"closed\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFBFS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dafbfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dafbfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dafbfs expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafbfs_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafbfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"searchStarted\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFFNA: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.daffna expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.daffna expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.daffna expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafbfs_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafbfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceBoolean found = SPICEFALSE;
    daffna_c(&found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in daffna", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":", stdout);
    fputs(found == SPICETRUE ? "true" : "false", stdout);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DASOPR: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dasopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dasopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dasopr expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"opened\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DASCLS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dascls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dascls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dascls expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"closed\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DLAOPN: {
    if (tokens[argsTok].size < 4) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[0]=string args[1]=string args[2]=string args[3]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int tagTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int ftypeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    const int ifnameTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    const int ncomchTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);

    if (tagTok < 0 || tagTok >= tokenCount || tokens[tagTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (ftypeTok < 0 || ftypeTok >= tokenCount || tokens[ftypeTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[1] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (ifnameTok < 0 || ifnameTok >= tokenCount || tokens[ifnameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt ncomch = 0;
    char detail[256] = {0};
    if (!parse_spiceint_arg(input, tokens, tokenCount, ncomchTok,
                            "file-io.dlaopn args[3]", &ncomch,
                            detail, sizeof(detail))) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[3] to be an integer (SpiceInt range)", detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (ncomch < 0) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[3] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *tag = NULL;
    char *ftype = NULL;
    char *ifname = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t tagErr =
        jsmn_strdup(input, &tokens[tagTok], &tag, strDetail, sizeof(strDetail));
    if (tagErr != JSMN_STRDUP_OK) {
      if (tagErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t ftypeErr =
        jsmn_strdup(input, &tokens[ftypeTok], &ftype, strDetail, sizeof(strDetail));
    if (ftypeErr != JSMN_STRDUP_OK) {
      if (ftypeErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(tag);
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t ifnameErr =
        jsmn_strdup(input, &tokens[ifnameTok], &ifname, strDetail, sizeof(strDetail));
    if (ifnameErr != JSMN_STRDUP_OK) {
      if (ifnameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(tag);
      free(ftype);
      goto done;
    }

    if (tag[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(tag);
      free(ftype);
      free(ifname);
      goto done;
    }

    char tempPath[PATH_MAX];
    int tempFd = -1;
    if (!build_file_io_temp_path(tag, ".dla", tempPath, sizeof(tempPath), &tempFd,
                                 detail, sizeof(detail))) {
      write_error_json_ex("invalid_request", "Failed to create temporary DLA path",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
      free(tag);
      free(ftype);
      free(ifname);
      goto done;
    }

    if (tempFd >= 0) {
      close(tempFd);
      tempFd = -1;
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    dlaopn_c(tempPath, ftype, ifname, ncomch, &handle);

    free(tag);
    free(ftype);
    free(ifname);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(tempPath);
      write_error_json("SPICE error in dlaopn", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr descr;
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &descr, &found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(tempPath);
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dlacls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(tempPath);
      write_error_json("SPICE error in dlacls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (tempFd >= 0) {
      close(tempFd);
    }
    unlink(tempPath);

    write_found_dla_descriptor_json(&descr, found);
    goto done;
  }

  case CALL_FILE_IO_DLABFS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dlabfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlabfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlabfs expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr descr;
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &descr, &found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    write_found_dla_descriptor_json(&descr, found);
    goto done;
  }

  case CALL_FILE_IO_DLAFNS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dlafns expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlafns expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlafns expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr firstDescr;
    SpiceBoolean firstFound = SPICEFALSE;
    dlabfs_c(handle, &firstDescr, &firstFound);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr nextDescr = {0};
    SpiceBoolean nextFound = SPICEFALSE;
    if (firstFound == SPICETRUE) {
      dlafns_c(handle, &firstDescr, &nextFound, &nextDescr);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                            sizeof(traceMsg));
        write_error_json("SPICE error in dlafns", shortMsg, longMsg, traceMsg);
        goto done;
      }
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    write_found_dla_descriptor_json(&nextDescr, nextFound);
    goto done;
  }

  case CALL_FILE_IO_DLACLS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dlacls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlacls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlacls expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dlacls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dlacls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"closed\":true}}\n", stdout);
    goto done;
  }

  case CALL_CELLS_WINDOWS_INSRTI: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[0]=integer item args[1]=int recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt item = 0;
    RunnerCellRecipe recipe;
    char detail[256] = {0};

    if (!parse_spiceint_arg(input, tokens, tokenCount, itemTok,
                            "cells-windows.insrti args[0]", &item,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[0] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[1] to be an int recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_INT) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[1] to be [\"int\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.insrti setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.insrti could not allocate transient int cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrti_c(item, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in insrti_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outCard = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.insrti)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outSize = size_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.insrti)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_INSRTD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[0]=number item args[1]=double recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble item = 0.0;
    parse_result itemParse = PARSE_INVALID;
    if (itemTok >= 0 && itemTok < tokenCount) {
      itemParse = jsmn_parse_double(input, &tokens[itemTok], &item);
    }
    if (itemTok < 0 || itemTok >= tokenCount || itemParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[0] to be a number",
          itemParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (itemParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL, NULL, NULL);
      goto done;
    }

    RunnerCellRecipe recipe;
    char detail[256] = {0};
    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[1] to be a double recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_DOUBLE) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[1] to be [\"double\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.insrtd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.insrtd could not allocate transient double cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrtd_c(item, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in insrtd_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outCard = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.insrtd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outSize = size_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.insrtd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_INSRTC: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtc expects args[0]=string item args[1]=char recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args",
                          "cells-windows.insrtc expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *item = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &item, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    RunnerCellRecipe recipe;
    char detail[256] = {0};
    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtc expects args[1] to be a char recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      free(item);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_CHAR) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtc expects args[1] to be [\"char\",size,length]",
          NULL, NULL, NULL, NULL);
      free(item);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.insrtc setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.insrtc could not allocate transient char cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      free(item);
      goto done;
    }

    insrtc_c(item, cell);
    free(item);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in insrtc_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outCard = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.insrtc)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outSize = size_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.insrtc)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_CELL_GETI: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[0]=int recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[0] to be an int recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_INT) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[0] to be [\"int\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.cellGeti args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.cellGeti setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.cellGeti could not allocate transient int cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrti_c(3, cell);
    insrti_c(1, cell);
    insrti_c(2, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.cellGeti", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt card = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.cellGeti)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.cellGeti index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(cell);
      goto done;
    }

    SpiceInt item = 0;
    SPICE_CELL_GET_I(cell, index, &item);

    fputs("{\"ok\":true,\"result\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)item);
    fputs("}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_CELL_GETD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[0]=double recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[0] to be a double recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_DOUBLE) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[0] to be [\"double\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.cellGetd args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.cellGetd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.cellGetd could not allocate transient double cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrtd_c(3.25, cell);
    insrtd_c(-1.0, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.cellGetd", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt card = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.cellGetd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.cellGetd index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(cell);
      goto done;
    }

    SpiceDouble item = 0.0;
    SPICE_CELL_GET_D(cell, index, &item);

    fputs("{\"ok\":true,\"result\":", stdout);
    fprintf(stdout, "%.17g", (double)item);
    fputs("}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_CELL_GETC: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[0]=char recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[0] to be a char recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_CHAR) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[0] to be [\"char\",size,length]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.cellGetc args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.cellGetc setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.cellGetc could not allocate transient char cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrtc_c("b", cell);
    insrtc_c("a", cell);
    insrtc_c("c", cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.cellGetc", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt card = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.cellGetc)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.cellGetc index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(cell);
      goto done;
    }

    SpiceChar item[4096];
    item[0] = '\0';
    SPICE_CELL_GET_C(cell, index, (SpiceInt)sizeof(item), item);

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(item);
    fputs("\"}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNINSD: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[0]=number left args[1]=number right args[2]=window recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int leftTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int rightTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble left = 0.0;
    SpiceDouble right = 0.0;
    parse_result leftParse = PARSE_INVALID;
    parse_result rightParse = PARSE_INVALID;

    if (leftTok >= 0 && leftTok < tokenCount) {
      leftParse = jsmn_parse_double(input, &tokens[leftTok], &left);
    }
    if (leftTok < 0 || leftTok >= tokenCount || leftParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[0] to be a number",
          leftParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (leftParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL, NULL, NULL);
      goto done;
    }

    if (rightTok >= 0 && rightTok < tokenCount) {
      rightParse = jsmn_parse_double(input, &tokens[rightTok], &right);
    }
    if (rightTok < 0 || rightTok >= tokenCount || rightParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[1] to be a number",
          rightParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (rightParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL, NULL, NULL);
      goto done;
    }

    RunnerCellRecipe recipe;
    char detail[256] = {0};
    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[2] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[2] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wninsd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wninsd could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wninsd_c(left, right, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wninsd_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt card = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wninsd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    if (card > 0) {
      SpiceDouble firstLeft = 0.0;
      SpiceDouble firstRight = 0.0;
      wnfetd_c(window, 0, &firstLeft, &firstRight);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in wnfetd_c (cells-windows.wninsd)", shortMsg,
                         longMsg, traceMsg);
        runner_free_allocated_cell(window);
        goto done;
      }

      fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
      fprintf(stdout, "%" PRIdMAX, (intmax_t)card);
      fputs(",\"first\":[", stdout);
      fprintf(stdout, "%.17g", (double)firstLeft);
      fputs(",", stdout);
      fprintf(stdout, "%.17g", (double)firstRight);
      fputs("]}}\n", stdout);
    } else {
      fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
      fprintf(stdout, "%" PRIdMAX, (intmax_t)card);
      fputs("}}\n", stdout);
    }

    runner_free_allocated_cell(window);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNCARD: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wncard expects args[0]=window recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    RunnerCellRecipe recipe;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wncard expects args[0] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wncard expects args[0] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wncard setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wncard could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wninsd_c(0.0, 1.0, window);
    wninsd_c(2.0, 3.0, window);
    wninsd_c(0.5, 2.5, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.wncard", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt card = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wncard)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)card);
    fputs("}\n", stdout);

    runner_free_allocated_cell(window);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNFETD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[0]=window recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[0] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[0] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.wnfetd args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wnfetd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wnfetd could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wninsd_c(0.0, 1.0, window);
    wninsd_c(2.0, 3.0, window);
    wninsd_c(0.5, 2.5, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.wnfetd", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt card = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wnfetd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.wnfetd index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(window);
      goto done;
    }

    SpiceDouble left = 0.0;
    SpiceDouble right = 0.0;
    wnfetd_c(window, index, &left, &right);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wnfetd_c (cells-windows.wnfetd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":[", stdout);
    fprintf(stdout, "%.17g", (double)left);
    fputs(",", stdout);
    fprintf(stdout, "%.17g", (double)right);
    fputs("]}\n", stdout);

    runner_free_allocated_cell(window);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNVALD: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[0]=integer size args[1]=integer n args[2]=window recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int sizeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int nTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceInt size = 0;
    SpiceInt n = 0;
    RunnerCellRecipe recipe;
    char detail[256] = {0};

    if (!parse_spiceint_arg(input, tokens, tokenCount, sizeTok,
                            "cells-windows.wnvald args[0]", &size,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[0] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, nTok,
                            "cells-windows.wnvald args[1]", &n,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[2] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[2] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wnvald setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wnvald could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wnvald_c(size, n, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wnvald_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt outCard = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wnvald)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt outSize = size_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.wnvald)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(window);
    goto done;
  }


  // --- kernels ----------------------------------------------------------

  case CALL_KERNELS_FURNSH: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.furnsh expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.furnsh expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *path = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &path, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    furnsh_c(path);
    free(path);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in furnsh", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_KERNELS_UNLOAD: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.unload expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.unload expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *path = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &path, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    unload_c(path);
    free(path);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in unload", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_KERNELS_KCLEAR: {
    if (tokens[argsTok].size > 0) {
      write_error_json_ex("invalid_args", "kernels.kclear expects no arguments", NULL, NULL, NULL, NULL);
      goto done;
    }

    kclear_c();

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kclear", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_KERNELS_KTOTAL: {
    const char *kind = "ALL";
    char *kindAlloc = NULL;

    if (tokens[argsTok].size >= 1) {
      int kindTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
      if (kindTok < 0 || kindTok >= tokenCount || tokens[kindTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_args", "kernels.ktotal expects args[0] to be a string", NULL, NULL, NULL, NULL);
        goto done;
      }

      strDetail[0] = '\0';
      jsmn_strdup_err_t kindErr =
          jsmn_strdup(input, &tokens[kindTok], &kindAlloc, strDetail, sizeof(strDetail));
      if (kindErr != JSMN_STRDUP_OK) {
        if (kindErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }
      kind = kindAlloc;
    }

    SpiceInt count = 0;
    ktotal_c(kind, &count);
    free(kindAlloc);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in ktotal", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%" PRIdMAX "}\n", (intmax_t)count);
    goto done;
  }

  case CALL_KERNELS_KDATA: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "kernels.kdata expects args[0]=integer (SpiceInt range) args[1]=string?",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int whichTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);

    SpiceInt which = 0;
    parse_result whichParse = PARSE_INVALID;
    if (whichTok >= 0 && whichTok < tokenCount) {
      whichParse = jsmn_parse_int(input, &tokens[whichTok], &which);
    }

    if (whichTok < 0 || whichTok >= tokenCount || whichParse != PARSE_OK) {
      if (whichParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "kernels.kdata expects args[0] to be an integer (SpiceInt range)",
            whichParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    const char *kind = "ALL";
    char *kindAlloc = NULL;
    if (tokens[argsTok].size >= 2) {
      int kindTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
      if (kindTok < 0 || kindTok >= tokenCount || tokens[kindTok].type != JSMN_STRING) {
        write_error_json_ex(
            "invalid_args",
            "kernels.kdata expects args[1] to be a string",
            NULL,
            NULL,
            NULL,
            NULL);
        goto done;
      }

      strDetail[0] = '\0';
      jsmn_strdup_err_t kindErr =
          jsmn_strdup(input, &tokens[kindTok], &kindAlloc, strDetail, sizeof(strDetail));
      if (kindErr != JSMN_STRDUP_OK) {
        if (kindErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }
      kind = kindAlloc;
    }

    char file[2048];
    char filtyp[2048];
    char source[2048];
    file[0] = '\0';
    filtyp[0] = '\0';
    source[0] = '\0';

    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;

    kdata_c(
        which,
        kind,
        (SpiceInt)sizeof(file),
        (SpiceInt)sizeof(filtyp),
        (SpiceInt)sizeof(source),
        file,
        filtyp,
        source,
        &handle,
        &found);

    free(kindAlloc);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kdata", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    trim_fixed_width_c_string_end(file, sizeof(file));
    trim_fixed_width_c_string_end(filtyp, sizeof(filtyp));
    trim_fixed_width_c_string_end(source, sizeof(source));

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"file\":\"", stdout);
    json_print_escaped(file);
    fputs("\",\"filtyp\":\"", stdout);
    json_print_escaped(filtyp);
    fputs("\",\"source\":\"", stdout);
    json_print_escaped(source);
    fprintf(stdout, "\",\"handle\":%" PRIdMAX "}}\n", (intmax_t)handle);
    goto done;
  }

  case CALL_KERNELS_KINFO: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.kinfo expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.kinfo expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *path = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &path, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char filtyp[2048];
    char source[2048];
    filtyp[0] = '\0';
    source[0] = '\0';

    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;

    kinfo_c(
        path,
        (SpiceInt)sizeof(filtyp),
        (SpiceInt)sizeof(source),
        filtyp,
        source,
        &handle,
        &found);

    free(path);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kinfo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    trim_fixed_width_c_string_end(filtyp, sizeof(filtyp));
    trim_fixed_width_c_string_end(source, sizeof(source));

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"filtyp\":\"", stdout);
    json_print_escaped(filtyp);
    fputs("\",\"source\":\"", stdout);
    json_print_escaped(source);
    fprintf(stdout, "\",\"handle\":%" PRIdMAX "}}\n", (intmax_t)handle);
    goto done;
  }

  case CALL_KERNELS_KXTRCT: {
    // Single cleanup path to avoid leaks across early exits.
    char *keywdRaw = NULL;
    char *wordsqRaw = NULL;
    char *keywd = NULL;
    char **terms = NULL;
    int nTermsRaw = 0;
    int nTerms = 0;
    int termlen = 2;
    char *termsBuf = NULL;
    char *wordsqOut = NULL;
    char *substr = NULL;

    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "kernels.kxtrct expects args[0]=string args[1]=string[] args[2]=string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto kxtrct_cleanup;
    }

    int keywdTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int termsTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int wordsqTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (keywdTok < 0 || keywdTok >= tokenCount || tokens[keywdTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }
    if (termsTok < 0 || termsTok >= tokenCount || tokens[termsTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }
    if (wordsqTok < 0 || wordsqTok >= tokenCount || tokens[wordsqTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t keywdErr =
        jsmn_strdup(input, &tokens[keywdTok], &keywdRaw, strDetail, sizeof(strDetail));
    if (keywdErr != JSMN_STRDUP_OK) {
      if (keywdErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto kxtrct_cleanup;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t wordsqErr =
        jsmn_strdup(input, &tokens[wordsqTok], &wordsqRaw, strDetail, sizeof(strDetail));
    if (wordsqErr != JSMN_STRDUP_OK) {
      if (wordsqErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto kxtrct_cleanup;
    }

    // Trim keywd.
    size_t keyStart = 0;
    size_t keyLen = strlen(keywdRaw);
    while (keyStart < keyLen && is_ascii_whitespace((unsigned char)keywdRaw[keyStart])) {
      keyStart++;
    }
    size_t keyEnd = keyLen;
    while (keyEnd > keyStart && is_ascii_whitespace((unsigned char)keywdRaw[keyEnd - 1])) {
      keyEnd--;
    }

    const size_t keyOutLen = keyEnd - keyStart;
    if (keyOutLen == 0) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }

    keywd = (char *)malloc(keyOutLen + 1);
    if (keywd == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }
    memcpy(keywd, keywdRaw + keyStart, keyOutLen);
    keywd[keyOutLen] = '\0';

    // Terms are an array of strings; trim each entry and ignore whitespace-only terms.
    nTermsRaw = tokens[termsTok].size;
    if (nTermsRaw > 0) {
      terms = (char **)calloc((size_t)nTermsRaw, sizeof(char *));
      if (terms == NULL) {
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }
    }

    for (int i = 0; i < nTermsRaw; i++) {
      int tTok = jsmn_get_array_elem(tokens, termsTok, i, tokenCount);
      if (tTok < 0 || tTok >= tokenCount || tokens[tTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_args", "kernels.kxtrct expects args[1] to contain only strings", NULL, NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }

      char *tRaw = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t tErr =
          jsmn_strdup(input, &tokens[tTok], &tRaw, strDetail, sizeof(strDetail));
      if (tErr != JSMN_STRDUP_OK) {
        if (tErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto kxtrct_cleanup;
      }

      // Trim term.
      size_t tLen = strlen(tRaw);
      size_t tStart = 0;
      while (tStart < tLen && is_ascii_whitespace((unsigned char)tRaw[tStart])) {
        tStart++;
      }
      size_t tEnd = tLen;
      while (tEnd > tStart && is_ascii_whitespace((unsigned char)tRaw[tEnd - 1])) {
        tEnd--;
      }

      const size_t tOutLen = tEnd - tStart;
      if (tOutLen == 0) {
        free(tRaw);
        continue;
      }

      char *t = (char *)malloc(tOutLen + 1);
      if (t == NULL) {
        free(tRaw);
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }
      memcpy(t, tRaw + tStart, tOutLen);
      t[tOutLen] = '\0';
      free(tRaw);

      terms[nTerms++] = t;
      if (tOutLen + 1 > (size_t)termlen) {
        termlen = (int)(tOutLen + 1);
      }
    }

    if (nTerms > 0) {
      termsBuf = (char *)calloc((size_t)nTerms * (size_t)termlen, 1);
      if (termsBuf == NULL) {
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }
      for (int i = 0; i < nTerms; i++) {
        // Each term occupies a fixed-width slice of length `termlen` (NUL padded).
        strncpy(termsBuf + (size_t)i * (size_t)termlen, terms[i], (size_t)termlen - 1);
      }
    }

    const int wordsqLen = (int)strlen(wordsqRaw);
    const int wordsqOutMaxBytes = wordsqLen + 1 < 2 ? 2 : wordsqLen + 1;
    const int substrMaxBytes = wordsqLen + 1 < 2 ? 2 : wordsqLen + 1;

    wordsqOut = (char *)calloc((size_t)wordsqOutMaxBytes, 1);
    substr = (char *)calloc((size_t)substrMaxBytes, 1);
    if (wordsqOut == NULL || substr == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }

    strncpy(wordsqOut, wordsqRaw, (size_t)wordsqOutMaxBytes - 1);

    SpiceBoolean found = SPICEFALSE;
    kxtrct_c(
        keywd,
        (SpiceInt)termlen,
        (ConstSpiceChar *)termsBuf,
        (SpiceInt)nTerms,
        (SpiceInt)wordsqOutMaxBytes,
        (SpiceInt)substrMaxBytes,
        wordsqOut,
        &found,
        substr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kxtrct", shortMsg, longMsg, traceMsg);
      goto kxtrct_cleanup;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto kxtrct_cleanup;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"wordsq\":\"", stdout);
    json_print_escaped(wordsqOut);
    fputs("\",\"substr\":\"", stdout);
    json_print_escaped(substr);
    fputs("\"}}\n", stdout);
    goto kxtrct_cleanup;

  kxtrct_cleanup:
    if (terms != NULL) {
      for (int j = 0; j < nTerms; j++) {
        free(terms[j]);
      }
      free(terms);
    }
    free(keywdRaw);
    free(wordsqRaw);
    free(keywd);
    free(termsBuf);
    free(wordsqOut);
    free(substr);
    goto done;
  }

  case CALL_KERNELS_KPLFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.kplfrm expects args[0]=integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      goto done;
    }

    int frmclsTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);

    SpiceInt frmcls = 0;
    parse_result frmclsParse = PARSE_INVALID;
    if (frmclsTok >= 0 && frmclsTok < tokenCount) {
      frmclsParse = jsmn_parse_int(input, &tokens[frmclsTok], &frmcls);
    }

    if (frmclsTok < 0 || frmclsTok >= tokenCount || frmclsParse != PARSE_OK) {
      if (frmclsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "kernels.kplfrm expects args[0] to be an integer (SpiceInt range)",
            frmclsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    // Use a fixed-capacity set cell for parity comparisons.
    SPICEINT_CELL(idset, 1024);
    kplfrm_c(frmcls, &idset);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kplfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    const SpiceInt n = card_c(&idset);
    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_spiceint_array((const SpiceInt *)idset.data, (int)n);
    fputs("}\n", stdout);
    goto done;
  }
  // --- kernel-pool ------------------------------------------------------

  case CALL_GDPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / sizeof(SpiceDouble));
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gdpool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    SpiceDouble *values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)room);
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gdpool_c(name, start, room, &nOut, values, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gdpool", shortMsg, longMsg, traceMsg);
      free(values);
      goto done;
    }

    if (found != SPICETRUE) {
      free(values);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":", stdout);
    json_print_double_array(values, (int)nOut);
    fputs("}}\n", stdout);
    free(values);
    goto done;
  }

  case CALL_GIPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / sizeof(SpiceInt));
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gipool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    SpiceInt *values = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)room);
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gipool_c(name, start, room, &nOut, values, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gipool", shortMsg, longMsg, traceMsg);
      free(values);
      goto done;
    }

    if (found != SPICETRUE) {
      free(values);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":", stdout);
    json_print_spiceint_array(values, (int)nOut);
    fputs("}}\n", stdout);
    free(values);
    goto done;
  }

  case CALL_GCPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / (size_t)KPOOL_STRING_MAX_BYTES);
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gcpool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    char *cvals = (char *)calloc((size_t)room, (size_t)KPOOL_STRING_MAX_BYTES);
    if (cvals == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gcpool_c(name, start, room, (SpiceInt)KPOOL_STRING_MAX_BYTES, &nOut, cvals, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gcpool", shortMsg, longMsg, traceMsg);
      free(cvals);
      goto done;
    }

    if (found != SPICETRUE) {
      free(cvals);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":[", stdout);
    for (SpiceInt i = 0; i < nOut; i++) {
      if (i != 0) {
        fputc(',', stdout);
      }
      char *s = cvals + (size_t)i * (size_t)KPOOL_STRING_MAX_BYTES;
      trim_fixed_width_c_string_end(s, (size_t)KPOOL_STRING_MAX_BYTES);
      fputc('"', stdout);
      json_print_escaped(s);
      fputc('"', stdout);
    }
    fputs("]}}\n", stdout);
    free(cvals);
    goto done;
  }

  case CALL_GNPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int templTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (templTok < 0 || templTok >= tokenCount || tokens[templTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / (size_t)KPOOL_NAME_MAX_BYTES);
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gnpool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *templ = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t templErr =
        jsmn_strdup(input, &tokens[templTok], &templ, strDetail, sizeof(strDetail));
    if (templErr != JSMN_STRDUP_OK) {
      if (templErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *cvals = (char *)calloc((size_t)room, (size_t)KPOOL_NAME_MAX_BYTES);
    if (cvals == NULL) {
      free(templ);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gnpool_c(templ, start, room, (SpiceInt)KPOOL_NAME_MAX_BYTES, &nOut, cvals, &found);
    free(templ);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gnpool", shortMsg, longMsg, traceMsg);
      free(cvals);
      goto done;
    }

    if (found != SPICETRUE) {
      free(cvals);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":[", stdout);
    for (SpiceInt i = 0; i < nOut; i++) {
      if (i != 0) {
        fputc(',', stdout);
      }
      char *s = cvals + (size_t)i * (size_t)KPOOL_NAME_MAX_BYTES;
      trim_fixed_width_c_string_end(s, (size_t)KPOOL_NAME_MAX_BYTES);
      fputc('"', stdout);
      json_print_escaped(s);
      fputc('"', stdout);
    }
    fputs("]}}\n", stdout);
    free(cvals);
    goto done;
  }

  case CALL_DTPOOL: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernel-pool.dtpool expects args[0]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.dtpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    SpiceBoolean found = SPICEFALSE;
    SpiceInt nOut = 0;
    SpiceChar typeOut[2];
    typeOut[0] = 'X';
    typeOut[1] = '\0';

    dtpool_c(name, &found, &nOut, typeOut);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dtpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"n\":%" PRIdMAX ",\"type\":\"%c\"}}\n",
            (intmax_t)nOut,
            (char)typeOut[0]);
    goto done;
  }

  case CALL_PDPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[0]=string args[1]=number[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int valuesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (valuesTok < 0 || valuesTok >= tokenCount || tokens[valuesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    const int nVals = tokens[valuesTok].size;
    SpiceDouble *values = NULL;
    if (nVals > 0) {
      values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)nVals);
      if (values == NULL) {
        free(name);
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto done;
      }

      for (int i = 0; i < nVals; i++) {
        int vTok = jsmn_get_array_elem(tokens, valuesTok, i, tokenCount);
        SpiceDouble v = 0.0;
        if (vTok < 0 || vTok >= tokenCount || jsmn_parse_double(input, &tokens[vTok], &v) != PARSE_OK) {
          free(name);
          free(values);
          write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[1] to contain only numbers", NULL, NULL, NULL, NULL);
          goto done;
        }
        values[i] = v;
      }
    }

    pdpool_c(name, (SpiceInt)nVals, (ConstSpiceDouble *)values);
    free(name);
    free(values);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pdpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_PIPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[0]=string args[1]=integer[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int valuesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (valuesTok < 0 || valuesTok >= tokenCount || tokens[valuesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    const int nVals = tokens[valuesTok].size;
    SpiceInt *values = NULL;
    if (nVals > 0) {
      values = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)nVals);
      if (values == NULL) {
        free(name);
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto done;
      }

      for (int i = 0; i < nVals; i++) {
        int vTok = jsmn_get_array_elem(tokens, valuesTok, i, tokenCount);
        SpiceInt v = 0;
        parse_result vParse = PARSE_INVALID;
        if (vTok >= 0 && vTok < tokenCount) {
          vParse = jsmn_parse_int(input, &tokens[vTok], &v);
        }
        if (vTok < 0 || vTok >= tokenCount || vParse != PARSE_OK) {
          free(name);
          free(values);
          if (vParse == PARSE_UNSUPPORTED) {
            write_unsupported_spiceint_width_error();
          } else {
            write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[1] to contain only integers", NULL, NULL, NULL, NULL);
          }
          goto done;
        }
        if (v < -2147483648 || v > 2147483647) {
          free(name);
          free(values);
          write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[1] to contain only 32-bit integers", NULL, NULL, NULL, NULL);
          goto done;
        }
        values[i] = v;
      }
    }

    pipool_c(name, (SpiceInt)nVals, (ConstSpiceInt *)values);
    free(name);
    free(values);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pipool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_PCPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[0]=string args[1]=string[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int valuesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (valuesTok < 0 || valuesTok >= tokenCount || tokens[valuesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    const int nVals = tokens[valuesTok].size;
    // Allocate at least one element so we never pass NULL to CSPICE.
    const int allocN = nVals > 0 ? nVals : 1;
    char *cvals = (char *)calloc((size_t)allocN, (size_t)KPOOL_STRING_MAX_BYTES);
    if (cvals == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    for (int i = 0; i < nVals; i++) {
      int sTok = jsmn_get_array_elem(tokens, valuesTok, i, tokenCount);
      if (sTok < 0 || sTok >= tokenCount || tokens[sTok].type != JSMN_STRING) {
        free(name);
        free(cvals);
        write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[1] to contain only strings", NULL, NULL, NULL, NULL);
        goto done;
      }

      char *s = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t sErr =
          jsmn_strdup(input, &tokens[sTok], &s, strDetail, sizeof(strDetail));
      if (sErr != JSMN_STRDUP_OK) {
        free(name);
        free(cvals);
        if (sErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }

      const size_t sLen = strlen(s);
      if (sLen >= (size_t)KPOOL_STRING_MAX_BYTES) {
        char msg[256];
        snprintf(msg, sizeof(msg),
                 "kernel-pool.pcpool expects args[1][%d] to be <= %d bytes",
                 i, (int)KPOOL_STRING_MAX_BYTES - 1);
        free(s);
        free(name);
        free(cvals);
        write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
        goto done;
      }

      char *slot = cvals + (size_t)i * (size_t)KPOOL_STRING_MAX_BYTES;
      memcpy(slot, s, sLen + 1);
      free(s);
    }

    pcpool_c(name, (SpiceInt)nVals, (SpiceInt)KPOOL_STRING_MAX_BYTES, cvals);
    free(name);
    free(cvals);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pcpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_SWPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[0]=string args[1]=string[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int agentTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int namesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (agentTok < 0 || agentTok >= tokenCount || tokens[agentTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (namesTok < 0 || namesTok >= tokenCount || tokens[namesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *agent = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t agentErr =
        jsmn_strdup(input, &tokens[agentTok], &agent, strDetail, sizeof(strDetail));
    if (agentErr != JSMN_STRDUP_OK) {
      if (agentErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    const int nNames = tokens[namesTok].size;
    const int allocN = nNames > 0 ? nNames : 1;
    char *names = (char *)calloc((size_t)allocN, (size_t)KPOOL_NAME_MAX_BYTES);
    if (names == NULL) {
      free(agent);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    for (int i = 0; i < nNames; i++) {
      int sTok = jsmn_get_array_elem(tokens, namesTok, i, tokenCount);
      if (sTok < 0 || sTok >= tokenCount || tokens[sTok].type != JSMN_STRING) {
        free(agent);
        free(names);
        write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[1] to contain only strings", NULL, NULL, NULL, NULL);
        goto done;
      }

      char *s = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t sErr =
          jsmn_strdup(input, &tokens[sTok], &s, strDetail, sizeof(strDetail));
      if (sErr != JSMN_STRDUP_OK) {
        free(agent);
        free(names);
        if (sErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }

      const size_t sLen = strlen(s);
      if (sLen >= (size_t)KPOOL_NAME_MAX_BYTES) {
        char msg[256];
        snprintf(msg, sizeof(msg),
                 "kernel-pool.swpool expects args[1][%d] to be <= %d bytes",
                 i, (int)KPOOL_NAME_MAX_BYTES - 1);
        free(s);
        free(agent);
        free(names);
        write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
        goto done;
      }

      char *slot = names + (size_t)i * (size_t)KPOOL_NAME_MAX_BYTES;
      memcpy(slot, s, sLen + 1);
      free(s);
    }

    swpool_c(agent, (SpiceInt)nNames, (SpiceInt)KPOOL_NAME_MAX_BYTES, names);
    free(agent);
    free(names);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in swpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_CVPOOL: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernel-pool.cvpool expects args[0]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int agentTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (agentTok < 0 || agentTok >= tokenCount || tokens[agentTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.cvpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *agent = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t agentErr =
        jsmn_strdup(input, &tokens[agentTok], &agent, strDetail, sizeof(strDetail));
    if (agentErr != JSMN_STRDUP_OK) {
      if (agentErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    // Prime the agent with an empty watch list (see tspiceRunner).
    // CSPICE requires a non-null `names` pointer even when nnames==0.
    char dummyNames[KPOOL_NAME_MAX_BYTES];
    memset(dummyNames, 0, sizeof(dummyNames));
    swpool_c(agent, 0, (SpiceInt)KPOOL_NAME_MAX_BYTES, dummyNames);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in swpool (cvpool prime)", shortMsg, longMsg, traceMsg);
      free(agent);
      goto done;
    }

    SpiceBoolean update = SPICEFALSE;
    cvpool_c(agent, &update);
    free(agent);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in cvpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    fputs(update == SPICETRUE ? "true" : "false", stdout);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_EXPOOL: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernel-pool.expool expects args[0]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.expool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
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

    SpiceBoolean found = SPICEFALSE;
    expool_c(name, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in expool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    fputs(found == SPICETRUE ? "true" : "false", stdout);
    fputs("}\n", stdout);
    goto done;
  }

  default:
    write_error_json_ex("unsupported_call", "Unsupported call", NULL, NULL,
                        NULL, NULL);
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
