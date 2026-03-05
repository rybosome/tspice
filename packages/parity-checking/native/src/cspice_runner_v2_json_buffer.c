#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_json_buffer.h"

void v2_json_buffer_init(V2JsonBuffer *buf) {
  if (buf == NULL) {
    return;
  }

  buf->data = NULL;
  buf->len = 0;
  buf->cap = 0;
}

void v2_json_buffer_free(V2JsonBuffer *buf) {
  if (buf == NULL) {
    return;
  }

  free(buf->data);
  buf->data = NULL;
  buf->len = 0;
  buf->cap = 0;
}

bool v2_json_buffer_reserve(V2JsonBuffer *buf, const size_t extraBytes) {
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

bool v2_json_buffer_append_bytes(V2JsonBuffer *buf, const char *src,
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

bool v2_json_buffer_append_cstr(V2JsonBuffer *buf, const char *src) {
  if (src == NULL) {
    return false;
  }

  return v2_json_buffer_append_bytes(buf, src, strlen(src));
}

bool v2_json_buffer_append_char(V2JsonBuffer *buf, const char c) {
  return v2_json_buffer_append_bytes(buf, &c, 1U);
}

bool v2_json_buffer_append_int(V2JsonBuffer *buf, const SpiceInt value) {
  char tmp[64];
  const int written = snprintf(tmp, sizeof(tmp), "%" PRIdMAX, (intmax_t)value);
  if (written < 0 || (size_t)written >= sizeof(tmp)) {
    return false;
  }

  return v2_json_buffer_append_bytes(buf, tmp, (size_t)written);
}

bool v2_json_buffer_append_escaped(V2JsonBuffer *buf, const char *s) {
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

bool v2_append_project_value_json(V2JsonBuffer *out, const char *json,
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
    int argTok =
        v2_find_arg_value_token(json, tokens, tokenCount, argsTok, argName);
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

    if (refs[refIndex].type != V2_REF_INT) {
      write_error_json_ex("invalid_args", "projectResult ref must be integer",
                          refName, NULL, NULL, NULL);
      free(value);
      return false;
    }

    if (!v2_json_buffer_append_int(out, refs[refIndex].intValue)) {
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

bool v2_materialize_project_result_object_json(
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
