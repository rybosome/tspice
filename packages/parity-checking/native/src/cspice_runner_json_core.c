#include "cspice_runner_json_core.h"

void jsmn_init(jsmn_parser *parser) {
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

int jsmn_parse(jsmn_parser *parser, const char *js, const size_t len,
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

bool jsmn_token_streq(const char *json, const jsmntok_t *tok,
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
int jsmn_object_pair_count(const jsmntok_t *t) {
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
int jsmn_skip_subtree(const jsmntok_t *tokens, const int index,
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

int jsmn_find_object_key(const char *json, const jsmntok_t *tokens,
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
int jsmn_get_array_elem(const jsmntok_t *tokens, const int arrayIndex,
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

jsmn_strdup_err_t jsmn_strdup(const char *json, const jsmntok_t *tok,
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

parse_result jsmn_parse_double(const char *json, const jsmntok_t *tok,
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

parse_result jsmn_parse_int(const char *json, const jsmntok_t *tok,
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


bool jsmn_parse_double_array_fixed(const char *json, jsmntok_t *tokens,
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

bool jsmn_parse_vec3(const char *json, jsmntok_t *tokens,
                            int vecTok, int tokenCount,
                            SpiceDouble out[3]) {
  return jsmn_parse_double_array_fixed(json, tokens, vecTok, tokenCount, 3, out);
}

bool jsmn_parse_mat3_rowmajor(const char *json, jsmntok_t *tokens,
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
