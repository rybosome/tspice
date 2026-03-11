#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_cells.h"
#include "cspice_runner_v2_call_invoke.h"
#include "cspice_runner_v2_json_buffer.h"
#include "generated/native_as_spice_int_bindings.h"
#include "generated/native_call_dispatch.h"
#include "generated/native_return_bindings.h"

#include <limits.h>
#include <string.h>

#ifndef dlacls_c
#define dlacls_c dascls_c
#endif

static bool v2_resolve_expr_double_value(const V2CallInvokeContext *context,
                                         int exprTok,
                                         const char *label,
                                         SpiceDouble *outValue);
static bool v2_resolve_expr_spiceint_value(const V2CallInvokeContext *context,
                                           int exprTok,
                                           const char *label,
                                           SpiceInt *outValue);

static bool v2_strdup_json_token(const char *json, const jsmntok_t *tok,
                                 char **out) {
  char detail[256];
  detail[0] = '\0';
  jsmn_strdup_err_t err = jsmn_strdup(json, tok, out, detail, sizeof(detail));
  if (err == JSMN_STRDUP_OK) {
    return true;
  }

  if (err == JSMN_STRDUP_INVALID) {
    write_error_json_ex("invalid_request", "Invalid JSON string escape",
                        detail[0] ? detail : NULL, NULL, NULL, NULL);
  } else {
    write_error_json("Out of memory", NULL, NULL, NULL);
  }

  return false;
}

static bool v2_write_spice_failure(const char *messagePrefix) {
  char shortMsg[1841];
  char longMsg[1841];
  char traceMsg[1841];
  capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                      traceMsg, sizeof(traceMsg));
  write_error_json_ex("spice_error", messagePrefix, NULL, shortMsg, longMsg,
                      traceMsg);
  return false;
}

static bool v2_resolve_expr_string_value(const V2CallInvokeContext *context,
                                         int exprTok,
                                         const char *label,
                                         char **outValue) {
  if (outValue == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  if (exprTok < 0 || exprTok >= context->tokenCount ||
      context->tokens[exprTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to string", label,
                        NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(context->json, &context->tokens[exprTok], &expr)) {
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok = v2_find_arg_value_token(context->json,
                                           context->tokens,
                                           context->tokenCount,
                                           context->argsTok,
                                           argName);
    if (valueTok < 0 || context->tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args",
                          "Missing or invalid v2 string argument",
                          argName,
                          NULL,
                          NULL,
                          NULL);
      free(expr);
      return false;
    }

    char *resolved = NULL;
    bool ok =
        v2_strdup_json_token(context->json, &context->tokens[valueTok], &resolved);
    free(expr);
    if (!ok) {
      return false;
    }

    *outValue = resolved;
    return true;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    if (strchr(refName, '.') != NULL) {
      write_error_json_ex("invalid_args", "Ref must use $refs.<name>", refName,
                          NULL, NULL, NULL);
      free(expr);
      return false;
    }

    if (context->refCount == NULL) {
      write_error_json_ex("invalid_request", "Missing ref context", NULL, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    int refIndex = v2_find_ref_index(context->refs, *context->refCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    const V2RefEntry *entry = &context->refs[refIndex];
    if (entry->type != V2_REF_PATH || entry->pathValue == NULL) {
      write_error_json_ex("invalid_args", "v2 ref is not a string-compatible ref",
                          refName, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    char *resolved = strdup(entry->pathValue);
    free(expr);
    if (resolved == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    *outValue = resolved;
    return true;
  }

  *outValue = expr;
  return true;
}

static char *v2_quote_json_string(const char *value) {
  const char *src = value == NULL ? "" : value;

  size_t needed = 2U;
  for (const unsigned char *p = (const unsigned char *)src; *p != '\0'; p++) {
    const unsigned char c = *p;
    switch (c) {
    case '"':
    case '\\':
    case '\b':
    case '\f':
    case '\n':
    case '\r':
    case '\t':
      needed += 2U;
      break;
    default:
      needed += (c < 0x20) ? 6U : 1U;
      break;
    }
  }

  char *out = (char *)malloc(needed + 1U);
  if (out == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return NULL;
  }

  static const char hex[] = "0123456789abcdef";

  char *dst = out;
  *dst++ = '"';

  for (const unsigned char *p = (const unsigned char *)src; *p != '\0'; p++) {
    const unsigned char c = *p;
    switch (c) {
    case '"':
      *dst++ = '\\';
      *dst++ = '"';
      break;
    case '\\':
      *dst++ = '\\';
      *dst++ = '\\';
      break;
    case '\b':
      *dst++ = '\\';
      *dst++ = 'b';
      break;
    case '\f':
      *dst++ = '\\';
      *dst++ = 'f';
      break;
    case '\n':
      *dst++ = '\\';
      *dst++ = 'n';
      break;
    case '\r':
      *dst++ = '\\';
      *dst++ = 'r';
      break;
    case '\t':
      *dst++ = '\\';
      *dst++ = 't';
      break;
    default:
      if (c < 0x20) {
        *dst++ = '\\';
        *dst++ = 'u';
        *dst++ = '0';
        *dst++ = '0';
        *dst++ = hex[(c >> 4) & 0x0F];
        *dst++ = hex[c & 0x0F];
      } else {
        *dst++ = (char)c;
      }
      break;
    }
  }

  *dst++ = '"';
  *dst = '\0';
  return out;
}

static bool v2_parse_double_token_or_error(const char *json,
                                           const jsmntok_t *tok,
                                           SpiceDouble *out,
                                           const char *label) {
  parse_result pr = jsmn_parse_double(json, tok, out);
  if (pr == PARSE_OK) {
    return true;
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
  case PARSE_UNSUPPORTED:
  default:
    snprintf(msg, sizeof(msg), "%s must be a number", label);
    break;
  }

  write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
  return false;
}

static bool v2_resolve_expr_value_token(const V2CallInvokeContext *context,
                                        int exprTok,
                                        const char *label,
                                        int *outValueTok) {
  if (outValueTok == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  if (exprTok < 0 || exprTok >= context->tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", label,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &context->tokens[exprTok];
  if (tok->type != JSMN_STRING) {
    *outValueTok = exprTok;
    return true;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(context->json, tok, &expr)) {
    return false;
  }

  const char *argName = NULL;
  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    const int argTok = v2_find_arg_value_token(context->json,
                                                context->tokens,
                                                context->tokenCount,
                                                context->argsTok,
                                                argName);
    if (argTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    *outValueTok = argTok;
    free(expr);
    return true;
  }

  const char *refName = NULL;
  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    write_error_json_ex(
        "invalid_args",
        "Generated return binding expression does not support $refs references",
        refName,
        NULL,
        NULL,
        NULL);
    free(expr);
    return false;
  }

  *outValueTok = exprTok;
  free(expr);
  return true;
}

static bool v2_is_ascii_whitespace(char c) {
  switch (c) {
  case ' ':
  case '\t':
  case '\n':
  case '\r':
  case '\f':
  case '\v':
    return true;
  default:
    return false;
  }
}

static void v2_trim_ascii_trailing_whitespace(char *value) {
  if (value == NULL) {
    return;
  }

  size_t len = strlen(value);
  while (len > 0 && v2_is_ascii_whitespace(value[len - 1])) {
    value[len - 1] = '\0';
    len--;
  }
}

static bool v2_json_buffer_append_json_key(V2JsonBuffer *out,
                                           const char *key) {
  return v2_json_buffer_append_char(out, '"') &&
         v2_json_buffer_append_escaped(out, key != NULL ? key : "") &&
         v2_json_buffer_append_cstr(out, "\":");
}

static bool v2_json_buffer_append_json_string(V2JsonBuffer *out,
                                              const char *value) {
  return v2_json_buffer_append_char(out, '"') &&
         v2_json_buffer_append_escaped(out, value != NULL ? value : "") &&
         v2_json_buffer_append_char(out, '"');
}

static bool v2_json_buffer_append_double_array(V2JsonBuffer *out,
                                               const SpiceDouble *values,
                                               int len) {
  bool ok = v2_json_buffer_append_char(out, '[');
  for (int i = 0; ok && i < len; i++) {
    if (i > 0) {
      ok = v2_json_buffer_append_char(out, ',');
    }
    if (ok) {
      ok = v2_json_buffer_append_double(out, values[i]);
    }
  }
  if (ok) {
    ok = v2_json_buffer_append_char(out, ']');
  }
  return ok;
}

static bool v2_json_buffer_append_spiceint_array(V2JsonBuffer *out,
                                                 const SpiceInt *values,
                                                 int len) {
  bool ok = v2_json_buffer_append_char(out, '[');
  for (int i = 0; ok && i < len; i++) {
    if (i > 0) {
      ok = v2_json_buffer_append_char(out, ',');
    }
    if (ok) {
      ok = v2_json_buffer_append_int(out, values[i]);
    }
  }
  if (ok) {
    ok = v2_json_buffer_append_char(out, ']');
  }
  return ok;
}

static bool v2_json_buffer_append_string_array(V2JsonBuffer *out,
                                               char *const *values,
                                               int len) {
  bool ok = v2_json_buffer_append_char(out, '[');
  for (int i = 0; ok && i < len; i++) {
    if (i > 0) {
      ok = v2_json_buffer_append_char(out, ',');
    }
    if (ok) {
      ok = v2_json_buffer_append_json_string(out, values[i]);
    }
  }
  if (ok) {
    ok = v2_json_buffer_append_char(out, ']');
  }
  return ok;
}

static bool v2_resolve_expr_array_token(const V2CallInvokeContext *context,
                                        int exprTok,
                                        const char *label,
                                        int *outArrayTok,
                                        int *outLength) {
  if (outArrayTok == NULL || outLength == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  int valueTok = -1;
  if (!v2_resolve_expr_value_token(context, exprTok, label, &valueTok)) {
    return false;
  }

  if (valueTok < 0 || valueTok >= context->tokenCount ||
      context->tokens[valueTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_args", "Expression must resolve to array", label,
                        NULL, NULL, NULL);
    return false;
  }

  *outArrayTok = valueTok;
  *outLength = context->tokens[valueTok].size;
  return true;
}

static bool v2_resolve_expr_object_token(const V2CallInvokeContext *context,
                                         int exprTok,
                                         const char *label,
                                         int *outObjectTok) {
  if (outObjectTok == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  int valueTok = -1;
  if (!v2_resolve_expr_value_token(context, exprTok, label, &valueTok)) {
    return false;
  }

  if (valueTok < 0 || valueTok >= context->tokenCount ||
      context->tokens[valueTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_args", "Expression must resolve to object", label,
                        NULL, NULL, NULL);
    return false;
  }

  *outObjectTok = valueTok;
  return true;
}

static bool v2_resolve_expr_double_array_values(const V2CallInvokeContext *context,
                                                int exprTok,
                                                const char *label,
                                                SpiceDouble **outValues,
                                                int *outLength) {
  if (outValues == NULL || outLength == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  int arrayTok = -1;
  int length = 0;
  if (!v2_resolve_expr_array_token(context, exprTok, label, &arrayTok, &length)) {
    return false;
  }

  SpiceDouble *values = NULL;
  if (length > 0) {
    values = (SpiceDouble *)calloc((size_t)length, sizeof(SpiceDouble));
    if (values == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
  }

  for (int i = 0; i < length; i++) {
    const int elemTok =
        jsmn_get_array_elem((jsmntok_t *)context->tokens,
                            arrayTok,
                            context->tokenCount,
                            i);
    if (elemTok < 0) {
      free(values);
      write_error_json_ex("invalid_args", "Array element is missing", label,
                          NULL, NULL, NULL);
      return false;
    }

    if (!v2_resolve_expr_double_value(context, elemTok, label, &values[i])) {
      free(values);
      return false;
    }
  }

  *outValues = values;
  *outLength = length;
  return true;
}

static bool v2_resolve_expr_spiceint_array_values(
    const V2CallInvokeContext *context,
    int exprTok,
    const char *label,
    SpiceInt **outValues,
    int *outLength) {
  if (outValues == NULL || outLength == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  int arrayTok = -1;
  int length = 0;
  if (!v2_resolve_expr_array_token(context, exprTok, label, &arrayTok, &length)) {
    return false;
  }

  SpiceInt *values = NULL;
  if (length > 0) {
    values = (SpiceInt *)calloc((size_t)length, sizeof(SpiceInt));
    if (values == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
  }

  for (int i = 0; i < length; i++) {
    const int elemTok =
        jsmn_get_array_elem((jsmntok_t *)context->tokens,
                            arrayTok,
                            context->tokenCount,
                            i);
    if (elemTok < 0) {
      free(values);
      write_error_json_ex("invalid_args", "Array element is missing", label,
                          NULL, NULL, NULL);
      return false;
    }

    if (!v2_resolve_expr_spiceint_value(context, elemTok, label, &values[i])) {
      free(values);
      return false;
    }
  }

  *outValues = values;
  *outLength = length;
  return true;
}

static void v2_free_string_array_values(char **values, int length) {
  if (values == NULL) {
    return;
  }

  for (int i = 0; i < length; i++) {
    free(values[i]);
  }
  free(values);
}

static bool v2_resolve_expr_string_array_values(const V2CallInvokeContext *context,
                                                int exprTok,
                                                const char *label,
                                                char ***outValues,
                                                int *outLength) {
  if (outValues == NULL || outLength == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  int arrayTok = -1;
  int length = 0;
  if (!v2_resolve_expr_array_token(context, exprTok, label, &arrayTok, &length)) {
    return false;
  }

  char **values = NULL;
  if (length > 0) {
    values = (char **)calloc((size_t)length, sizeof(char *));
    if (values == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
  }

  for (int i = 0; i < length; i++) {
    const int elemTok =
        jsmn_get_array_elem((jsmntok_t *)context->tokens,
                            arrayTok,
                            context->tokenCount,
                            i);
    if (elemTok < 0) {
      v2_free_string_array_values(values, length);
      write_error_json_ex("invalid_args", "Array element is missing", label,
                          NULL, NULL, NULL);
      return false;
    }

    if (!v2_resolve_expr_string_value(context, elemTok, label, &values[i])) {
      v2_free_string_array_values(values, length);
      return false;
    }
  }

  *outValues = values;
  *outLength = length;
  return true;
}

static bool v2_build_fixed_width_string_matrix(char *const *values,
                                               int count,
                                               SpiceInt minWidth,
                                               char **outMatrix,
                                               SpiceInt *outWidth) {
  if (outMatrix == NULL || outWidth == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  if (count < 0 || minWidth <= 0) {
    write_error_json_ex("invalid_request", "Invalid matrix dimensions", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  SpiceInt width = minWidth;
  for (int i = 0; i < count; i++) {
    const size_t valueLen = strlen(values[i] != NULL ? values[i] : "");
    const size_t needed = valueLen + 1U;
    if (needed > (size_t)INT_MAX) {
      write_error_json_ex("invalid_args", "String value is too long", NULL, NULL,
                          NULL, NULL);
      return false;
    }
    if ((SpiceInt)needed > width) {
      width = (SpiceInt)needed;
    }
  }

  const int slotCount = count > 0 ? count : 1;
  char *matrix = (char *)calloc((size_t)slotCount, (size_t)width);
  if (matrix == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  for (int i = 0; i < count; i++) {
    const char *value = values[i] != NULL ? values[i] : "";
    strncpy(matrix + ((size_t)i * (size_t)width), value, (size_t)width - 1U);
  }

  *outMatrix = matrix;
  *outWidth = width;
  return true;
}

static bool v2_parse_object_spiceint_field(const V2CallInvokeContext *context,
                                           int objectTok,
                                           const char *fieldName,
                                           const char *label,
                                           SpiceInt *outValue) {
  if (outValue == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  const int fieldTok = jsmn_find_object_key(context->json,
                                            (jsmntok_t *)context->tokens,
                                            objectTok,
                                            context->tokenCount,
                                            fieldName);
  if (fieldTok < 0) {
    write_error_json_ex("invalid_args", "Missing required object field",
                        fieldName, NULL, NULL, NULL);
    return false;
  }

  if (!v2_resolve_expr_spiceint_value(context, fieldTok, label, outValue)) {
    return false;
  }

  return true;
}

static bool v2_parse_dla_descriptor_from_expr(const V2CallInvokeContext *context,
                                              int exprTok,
                                              const char *label,
                                              SpiceDLADescr *outDescr) {
  if (outDescr == NULL) {
    write_error_json_ex("invalid_request", "Missing output storage", label,
                        NULL, NULL, NULL);
    return false;
  }

  int objectTok = -1;
  if (!v2_resolve_expr_object_token(context, exprTok, label, &objectTok)) {
    return false;
  }

  SpiceInt bwdptr = 0;
  SpiceInt fwdptr = 0;
  SpiceInt ibase = 0;
  SpiceInt isize = 0;
  SpiceInt dbase = 0;
  SpiceInt dsize = 0;
  SpiceInt cbase = 0;
  SpiceInt csize = 0;

  if (!v2_parse_object_spiceint_field(context, objectTok, "bwdptr", label,
                                      &bwdptr) ||
      !v2_parse_object_spiceint_field(context, objectTok, "fwdptr", label,
                                      &fwdptr) ||
      !v2_parse_object_spiceint_field(context, objectTok, "ibase", label,
                                      &ibase) ||
      !v2_parse_object_spiceint_field(context, objectTok, "isize", label,
                                      &isize) ||
      !v2_parse_object_spiceint_field(context, objectTok, "dbase", label,
                                      &dbase) ||
      !v2_parse_object_spiceint_field(context, objectTok, "dsize", label,
                                      &dsize) ||
      !v2_parse_object_spiceint_field(context, objectTok, "cbase", label,
                                      &cbase) ||
      !v2_parse_object_spiceint_field(context, objectTok, "csize", label,
                                      &csize)) {
    return false;
  }

  outDescr->bwdptr = bwdptr;
  outDescr->fwdptr = fwdptr;
  outDescr->ibase = ibase;
  outDescr->isize = isize;
  outDescr->dbase = dbase;
  outDescr->dsize = dsize;
  outDescr->cbase = cbase;
  outDescr->csize = csize;
  return true;
}

static bool v2_json_buffer_append_dla_descriptor(V2JsonBuffer *out,
                                                 const SpiceDLADescr *descr) {
  bool ok = v2_json_buffer_append_char(out, '{');

  if (ok) {
    ok = v2_json_buffer_append_json_key(out, "bwdptr") &&
         v2_json_buffer_append_int(out, descr->bwdptr);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "fwdptr") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->fwdptr);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "ibase") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->ibase);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "isize") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->isize);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "dbase") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->dbase);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "dsize") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->dsize);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "cbase") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->cbase);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(out, ",\"") &&
         v2_json_buffer_append_escaped(out, "csize") &&
         v2_json_buffer_append_cstr(out, "\":") &&
         v2_json_buffer_append_int(out, descr->csize);
  }
  if (ok) {
    ok = v2_json_buffer_append_char(out, '}');
  }

  return ok;
}

static bool v2_resolve_expr_double_value(const V2CallInvokeContext *context,
                                         int exprTok,
                                         const char *label,
                                         SpiceDouble *outValue) {
  if (context == NULL || outValue == NULL) {
    write_error_json_ex("invalid_request", "Missing expression context", label,
                        NULL, NULL, NULL);
    return false;
  }

  if (exprTok < 0 || exprTok >= context->tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", label,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &context->tokens[exprTok];
  if (tok->type == JSMN_PRIMITIVE) {
    return v2_parse_double_token_or_error(context->json, tok, outValue, label);
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to number", label,
                        NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(context->json, tok, &expr)) {
    return false;
  }

  const char *argName = NULL;
  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    const int argTok = v2_find_arg_value_token(context->json,
                                                context->tokens,
                                                context->tokenCount,
                                                context->argsTok,
                                                argName);
    if (argTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    if (context->tokens[argTok].type != JSMN_PRIMITIVE) {
      write_error_json_ex("invalid_args", "Expression must resolve to number",
                          label, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    const bool ok =
        v2_parse_double_token_or_error(context->json, &context->tokens[argTok],
                                       outValue, label);
    free(expr);
    return ok;
  }

  const char *refName = NULL;
  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    if (strchr(refName, '.') != NULL) {
      write_error_json_ex(
          "invalid_args",
          "Generated return binding expression does not support dotted $refs references",
          refName,
          NULL,
          NULL,
          NULL);
      free(expr);
      return false;
    }

    const int resolvedRefCount =
        (context->refCount != NULL) ? *context->refCount : 0;
    const int refIndex = v2_find_ref_index(context->refs, resolvedRefCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    const V2RefEntry *entry = &context->refs[refIndex];
    if (entry->type != V2_REF_INT) {
      write_error_json_ex("invalid_args",
                          "Generated return binding numeric expression expects integer ref",
                          refName,
                          NULL,
                          NULL,
                          NULL);
      free(expr);
      return false;
    }

    *outValue = (SpiceDouble)entry->intValue;
    free(expr);
    return true;
  }

  write_error_json_ex("invalid_args", "Expression must resolve to number", label,
                      NULL, NULL, NULL);
  free(expr);
  return false;
}

static bool v2_resolve_expr_vec3_value(const V2CallInvokeContext *context,
                                       int exprTok,
                                       const char *label,
                                       SpiceDouble outVec[3]) {
  int valueTok = -1;
  if (!v2_resolve_expr_value_token(context, exprTok, label, &valueTok)) {
    return false;
  }

  if (!jsmn_parse_vec3(context->json,
                       (jsmntok_t *)context->tokens,
                       valueTok,
                       context->tokenCount,
                       outVec)) {
    write_error_json_ex("invalid_args", "Expression must resolve to vec3", label,
                        NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_resolve_expr_mat3_value(const V2CallInvokeContext *context,
                                       int exprTok,
                                       const char *label,
                                       SpiceDouble outMat[3][3]) {
  int valueTok = -1;
  if (!v2_resolve_expr_value_token(context, exprTok, label, &valueTok)) {
    return false;
  }

  if (!jsmn_parse_mat3_rowmajor(context->json,
                                (jsmntok_t *)context->tokens,
                                valueTok,
                                context->tokenCount,
                                outMat)) {
    write_error_json_ex("invalid_args",
                        "Expression must resolve to row-major 3x3 matrix", label,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  return true;
}

static bool v2_json_buffer_append_double(V2JsonBuffer *buf,
                                         SpiceDouble value) {
  if (!isfinite(value)) {
    write_error_json_ex("invalid_request",
                        "Generated return binding produced non-finite number",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char tmp[64];
  const int written = snprintf(tmp, sizeof(tmp), "%.17g", (double)value);
  if (written < 0 || (size_t)written >= sizeof(tmp)) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  if (!v2_json_buffer_append_bytes(buf, tmp, (size_t)written)) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_set_return_json_from_buffer(const V2CallInvokeContext *context,
                                           V2JsonBuffer *buf) {
  if (context == NULL || context->returnValueJson == NULL) {
    write_error_json_ex("invalid_request",
                        "call result.mode=return requires return capture",
                        context != NULL ? context->fnName : NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char *result = buf->data;
  if (result == NULL) {
    result = strdup("null");
    if (result == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
  }

  *context->returnValueJson = result;
  buf->data = NULL;
  buf->len = 0;
  buf->cap = 0;
  return true;
}

static bool v2_set_return_json_from_double(const V2CallInvokeContext *context,
                                           SpiceDouble value) {
  V2JsonBuffer out;
  v2_json_buffer_init(&out);

  bool ok = v2_json_buffer_append_double(&out, value) &&
            v2_set_return_json_from_buffer(context, &out);
  v2_json_buffer_free(&out);
  return ok;
}

static bool v2_set_return_json_from_vec(const V2CallInvokeContext *context,
                                        const SpiceDouble *values,
                                        int len) {
  V2JsonBuffer out;
  v2_json_buffer_init(&out);

  bool ok = v2_json_buffer_append_char(&out, '[');
  for (int i = 0; ok && i < len; i++) {
    if (i > 0) {
      ok = v2_json_buffer_append_char(&out, ',');
    }
    if (ok) {
      ok = v2_json_buffer_append_double(&out, values[i]);
    }
  }
  if (ok) {
    ok = v2_json_buffer_append_char(&out, ']');
  }
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  ok = v2_set_return_json_from_buffer(context, &out);
  v2_json_buffer_free(&out);
  return ok;
}

static bool v2_set_return_json_from_spiceint_array(
    const V2CallInvokeContext *context,
    const SpiceInt *values,
    int len) {
  V2JsonBuffer out;
  v2_json_buffer_init(&out);

  bool ok = v2_json_buffer_append_spiceint_array(&out, values, len);
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  ok = v2_set_return_json_from_buffer(context, &out);
  v2_json_buffer_free(&out);
  return ok;
}

static bool v2_set_return_json_from_string_array(const V2CallInvokeContext *context,
                                                 char *const *values,
                                                 int len) {
  V2JsonBuffer out;
  v2_json_buffer_init(&out);

  bool ok = v2_json_buffer_append_string_array(&out, values, len);
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  ok = v2_set_return_json_from_buffer(context, &out);
  v2_json_buffer_free(&out);
  return ok;
}

static bool v2_set_return_json_from_named_triple(const V2CallInvokeContext *context,
                                                 const char *nameA,
                                                 SpiceDouble valueA,
                                                 const char *nameB,
                                                 SpiceDouble valueB,
                                                 const char *nameC,
                                                 SpiceDouble valueC) {
  V2JsonBuffer out;
  v2_json_buffer_init(&out);

  bool ok = v2_json_buffer_append_char(&out, '{');

  if (ok) {
    ok = v2_json_buffer_append_char(&out, '"') &&
         v2_json_buffer_append_escaped(&out, nameA) &&
         v2_json_buffer_append_cstr(&out, "\":") &&
         v2_json_buffer_append_double(&out, valueA);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(&out, ",\"") &&
         v2_json_buffer_append_escaped(&out, nameB) &&
         v2_json_buffer_append_cstr(&out, "\":") &&
         v2_json_buffer_append_double(&out, valueB);
  }
  if (ok) {
    ok = v2_json_buffer_append_cstr(&out, ",\"") &&
         v2_json_buffer_append_escaped(&out, nameC) &&
         v2_json_buffer_append_cstr(&out, "\":") &&
         v2_json_buffer_append_double(&out, valueC);
  }
  if (ok) {
    ok = v2_json_buffer_append_char(&out, '}');
  }

  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  ok = v2_set_return_json_from_buffer(context, &out);
  v2_json_buffer_free(&out);
  return ok;
}

static bool v2_set_return_json_from_literal(const V2CallInvokeContext *context,
                                            const char *jsonLiteral) {
  if (context == NULL || context->returnValueJson == NULL) {
    write_error_json_ex("invalid_request",
                        "call result.mode=return requires return capture",
                        context != NULL ? context->fnName : NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char *jsonValue = strdup(jsonLiteral != NULL ? jsonLiteral : "null");
  if (jsonValue == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  *context->returnValueJson = jsonValue;
  return true;
}

static bool v2_set_return_json_from_bool(const V2CallInvokeContext *context,
                                         SpiceBoolean value) {
  return v2_set_return_json_from_literal(
      context, value == SPICETRUE ? "true" : "false");
}

static bool v2_set_return_json_from_spiceint(const V2CallInvokeContext *context,
                                             SpiceInt value) {
  V2JsonBuffer out;
  v2_json_buffer_init(&out);

  bool ok = v2_json_buffer_append_int(&out, value);
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    v2_json_buffer_free(&out);
    return false;
  }

  ok = v2_set_return_json_from_buffer(context, &out);
  v2_json_buffer_free(&out);
  return ok;
}

static bool v2_set_return_json_from_string(const V2CallInvokeContext *context,
                                           const char *value) {
  if (context == NULL || context->returnValueJson == NULL) {
    write_error_json_ex("invalid_request",
                        "call result.mode=return requires return capture",
                        context != NULL ? context->fnName : NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char *jsonValue = v2_quote_json_string(value != NULL ? value : "");
  if (jsonValue == NULL) {
    return false;
  }

  *context->returnValueJson = jsonValue;
  return true;
}

static void v2_build_call_arg_label(const V2CallInvokeContext *context,
                                    int argIndex,
                                    char *out,
                                    size_t outBytes) {
  if (out == NULL || outBytes == 0U) {
    return;
  }

  snprintf(out,
           outBytes,
           "call(%s).in[%d]",
           context != NULL && context->fnName != NULL ? context->fnName
                                                       : "<unknown>",
           argIndex);
}

static bool v2_resolve_expr_spiceint_value(const V2CallInvokeContext *context,
                                           int exprTok,
                                           const char *label,
                                           SpiceInt *outValue) {
  const int resolvedRefCount =
      (context->refCount != NULL) ? *context->refCount : 0;

  return v2_resolve_spiceint_expr(context->json,
                                  context->tokens,
                                  context->tokenCount,
                                  exprTok,
                                  context->argsTok,
                                  context->refs,
                                  resolvedRefCount,
                                  label,
                                  outValue);
}

static bool v2_resolve_expr_cell_or_window_ref_index(
    const V2CallInvokeContext *context,
    int exprTok,
    const char *label,
    int *outRefIndex) {
  const int resolvedRefCount =
      (context->refCount != NULL) ? *context->refCount : 0;

  return v2_resolve_cell_or_window_ref(context->json,
                                       context->tokens,
                                       context->tokenCount,
                                       exprTok,
                                       context->refs,
                                       resolvedRefCount,
                                       label,
                                       outRefIndex);
}

static void v2_flatten_mat3_rowmajor(const SpiceDouble in[3][3],
                                     SpiceDouble out[9]) {
  int k = 0;
  for (int r = 0; r < 3; r++) {
    for (int c = 0; c < 3; c++) {
      out[k++] = in[r][c];
    }
  }
}

// DSK-specific named-out whitelist lane intentionally remains bespoke for PR #582.
// TODO(parity-struct-capture): replace with generated generic struct output mapping.
static bool v2_try_resolve_named_dskb02_value(const char *name,
                                               SpiceInt nv,
                                               SpiceInt np,
                                               SpiceInt nvxtot,
                                               SpiceInt cgscal,
                                               SpiceInt vtxnpl,
                                               SpiceInt voxnpt,
                                               SpiceInt voxnpl,
                                               SpiceInt *out) {
  if (strcmp(name, "nv") == 0) {
    *out = nv;
    return true;
  }
  if (strcmp(name, "np") == 0) {
    *out = np;
    return true;
  }
  if (strcmp(name, "nvxtot") == 0) {
    *out = nvxtot;
    return true;
  }
  if (strcmp(name, "cgscal") == 0) {
    *out = cgscal;
    return true;
  }
  if (strcmp(name, "vtxnpl") == 0) {
    *out = vtxnpl;
    return true;
  }
  if (strcmp(name, "voxnpt") == 0) {
    *out = voxnpt;
    return true;
  }
  if (strcmp(name, "voxnpl") == 0) {
    *out = voxnpl;
    return true;
  }

  return false;
}

static bool v2_emit_named_dskb02_outputs(const char *json,
                                         const jsmntok_t *tokens,
                                         int tokenCount,
                                         int outMapTok,
                                         V2RefEntry *refs,
                                         int *refCount,
                                         SpiceInt nv,
                                         SpiceInt np,
                                         SpiceInt nvxtot,
                                         SpiceInt cgscal,
                                         SpiceInt vtxnpl,
                                         SpiceInt voxnpt,
                                         SpiceInt voxnpl) {
  const int pairCount = jsmn_object_pair_count(&tokens[outMapTok]);
  if (pairCount < 0) {
    write_error_json_ex("invalid_request", "call out map parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = outMapTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING ||
        tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "call out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char *outName = NULL;
    char *refName = NULL;
    if (!v2_strdup_json_token(json, &tokens[keyTok], &outName) ||
        !v2_strdup_json_token(json, &tokens[valueTok], &refName)) {
      free(outName);
      free(refName);
      return false;
    }

    SpiceInt value = 0;
    if (!v2_try_resolve_named_dskb02_value(outName,
                                            nv,
                                            np,
                                            nvxtot,
                                            cgscal,
                                            vtxnpl,
                                            voxnpt,
                                            voxnpl,
                                            &value)) {
      write_error_json_ex("invalid_args",
                          "Unsupported dskb02 named out param",
                          outName,
                          NULL,
                          NULL,
                          NULL);
      free(outName);
      free(refName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, refName, value);
    free(outName);
    free(refName);
    if (!ok) {
      return false;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "call out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

static bool v2_invoke_contract_as_spice_int(
    const V2CallInvokeContext *context) {
  const V2NativeAsSpiceIntBindingEntry *binding =
      v2_lookup_native_as_spice_int_binding(context->spec->id);

  if (binding == NULL || binding->invokeFn == NULL || binding->cSymbol == NULL ||
      strcmp(binding->cSymbol, context->spec->cSymbol) != 0) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  SpiceInt value =
      binding->invokeFn(&context->refs[context->resolved->refIndices[0]].cell);

  if (failed_c() == SPICETRUE) {
    char msg[96];
    snprintf(msg,
             sizeof(msg),
             "SPICE error in %s",
             binding->cSymbol[0] != '\0' ? binding->cSymbol
                                          : "generated call binding");
    return v2_write_spice_failure(msg);
  }

  return v2_add_ref_int(context->refs,
                        context->refCount,
                        context->asRefName,
                        value);
}

static bool v2_invoke_contract_forbidden(const V2CallInvokeContext *context) {
  const char *symbol = NULL;

  switch (context->spec->id) {
  case V2_FUNCTION_ID_CELLS_WINDOWS_SCARD:
    symbol = "scard_c";
    scard_c(context->resolved->intValues[0],
            &context->refs[context->resolved->refIndices[1]].cell);
    break;
  case V2_FUNCTION_ID_CELLS_WINDOWS_SSIZE:
    symbol = "ssize_c";
    ssize_c(context->resolved->intValues[0],
            &context->refs[context->resolved->refIndices[1]].cell);
    break;
  case V2_FUNCTION_ID_CELLS_WINDOWS_VALID:
    symbol = "valid_c";
    valid_c(context->resolved->intValues[0],
            context->resolved->intValues[1],
            &context->refs[context->resolved->refIndices[2]].cell);
    break;
  case V2_FUNCTION_ID_DSK_DSKOBJ:
    symbol = "dskobj_c";
    dskobj_c(context->resolved->pathValues[0],
             &context->refs[context->resolved->refIndices[1]].cell);
    break;
  case V2_FUNCTION_ID_DSK_DSKSRF:
    symbol = "dsksrf_c";
    dsksrf_c(context->resolved->pathValues[0],
             context->resolved->intValues[1],
             &context->refs[context->resolved->refIndices[2]].cell);
    break;
  default:
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  if (context->spec->cSymbol == NULL || strcmp(context->spec->cSymbol, symbol) != 0) {
    char detail[256];
    detail[0] = '\0';
    snprintf(detail,
             sizeof(detail),
             "resolved.cSymbol=%s spec.cSymbol=%s",
             symbol,
             context->spec->cSymbol != NULL ? context->spec->cSymbol : "<null>");
    write_error_json_ex("invalid_request",
                        "Generated forbidden call symbol mismatch",
                        detail,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (failed_c() == SPICETRUE) {
    char msg[96];
    snprintf(msg,
             sizeof(msg),
             "SPICE error in %s",
             symbol[0] != '\0' ? symbol : "generated call binding");
    return v2_write_spice_failure(msg);
  }

  return true;
}

static bool v2_invoke_sig_das_handle_ref_dla_descriptor_ref_to_as_dsk_descriptor(
    const V2CallInvokeContext *context) {
  // DSK descriptor projection remains isolated pending generic struct capture.
  if (context->spec->id != V2_FUNCTION_ID_DSK_DSKGD) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  SpiceDSKDescr descriptor;
  memset(&descriptor, 0, sizeof(descriptor));

  dskgd_c(context->refs[context->resolved->refIndices[0]].handleValue,
          &context->refs[context->resolved->refIndices[1]].dlaDescrValue,
          &descriptor);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in dskgd_c");
  }

  return v2_add_ref_dsk_descr(context->refs,
                              context->refCount,
                              context->asRefName,
                              &descriptor);
}

static bool v2_invoke_sig_das_handle_ref_dla_descriptor_ref_to_out_named_dskb02(
    const V2CallInvokeContext *context) {
  // Named DSK multi-out remains isolated/deferred; do not expand bespoke paths.
  if (context->spec->id != V2_FUNCTION_ID_DSK_DSKB02) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

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

  dskb02_c(context->refs[context->resolved->refIndices[0]].handleValue,
           &context->refs[context->resolved->refIndices[1]].dlaDescrValue,
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
    return v2_write_spice_failure("SPICE error in dskb02_c");
  }

  return v2_emit_named_dskb02_outputs(context->json,
                                      context->tokens,
                                      context->tokenCount,
                                      context->outMapTok,
                                      context->refs,
                                      context->refCount,
                                      nv,
                                      np,
                                      nvxtot,
                                      cgscal,
                                      vtxnpl,
                                      voxnpt,
                                      voxnpl);
}

static bool v2_invoke_return_expr_string_to_json_string(
    const V2CallInvokeContext *context,
    V2NativeReturnExprStringToJsonStringFn invokeFn) {
  if (context->returnValueJson == NULL) {
    write_error_json_ex("invalid_request",
                        "call result.mode=return requires return capture",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  if (invokeFn == NULL) {
    write_error_json_ex("invalid_request", "Missing native return binding invoker",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  if (context->spec == NULL || context->spec->arity != 1 ||
      context->spec->argKinds[0] != V2_FUNCTION_ARG_EXPR) {
    write_error_json_ex("invalid_request",
                        "Invalid native return binding signature",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  char argLabel[128];
  snprintf(argLabel, sizeof(argLabel), "call(%s).in[0]",
           context->fnName != NULL ? context->fnName : "<unknown>");

  char *item = NULL;
  if (!v2_resolve_expr_string_value(context,
                                    context->resolved->valueTokens[0],
                                    argLabel,
                                    &item)) {
    return false;
  }

  const char *value = invokeFn(item);
  free(item);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in generated return binding call");
  }

  char *valueJson = v2_quote_json_string(value);
  if (valueJson == NULL) {
    return false;
  }

  *context->returnValueJson = valueJson;
  return true;
}

static bool v2_invoke_return_expr_spice_int_to_json_string_via_sized_out_buffer(
    const V2CallInvokeContext *context,
    V2NativeReturnExprSpiceIntToJsonStringViaSizedOutBufferFn invokeFn) {
  if (context->returnValueJson == NULL) {
    write_error_json_ex("invalid_request",
                        "call result.mode=return requires return capture",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  if (invokeFn == NULL) {
    write_error_json_ex("invalid_request", "Missing native return binding invoker",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  if (context->spec == NULL || context->spec->arity != 1 ||
      context->spec->argKinds[0] != V2_FUNCTION_ARG_EXPR) {
    write_error_json_ex("invalid_request",
                        "Invalid native return binding signature",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  char argLabel[128];
  snprintf(argLabel, sizeof(argLabel), "call(%s).in[0]",
           context->fnName != NULL ? context->fnName : "<unknown>");

  const int resolvedRefCount =
      (context->refCount != NULL) ? *context->refCount : 0;

  SpiceInt code = 0;
  if (!v2_resolve_spiceint_expr(context->json,
                                context->tokens,
                                context->tokenCount,
                                context->resolved->valueTokens[0],
                                context->argsTok,
                                context->refs,
                                resolvedRefCount,
                                argLabel,
                                &code)) {
    return false;
  }

  enum { V2_RETURN_STRING_BUFFER_BYTES = 128 };
  SpiceChar value[V2_RETURN_STRING_BUFFER_BYTES];
  memset(value, 0, sizeof(value));

  invokeFn(code, (SpiceInt)V2_RETURN_STRING_BUFFER_BYTES, value);
  value[V2_RETURN_STRING_BUFFER_BYTES - 1] = '\0';

  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in generated return binding call");
  }

  char *valueJson = v2_quote_json_string(value);
  if (valueJson == NULL) {
    return false;
  }

  *context->returnValueJson = valueJson;
  return true;
}

static bool v2_invoke_generated_return_binding_lane(
    const V2CallInvokeContext *context,
    const V2NativeReturnBindingEntry *binding) {
  if (context == NULL || context->spec == NULL || binding == NULL ||
      binding->cSymbol == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context != NULL ? context->fnName : NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char arg0[128];
  char arg1[128];
  char arg2[128];
  char arg3[128];
  char arg4[128];
  char arg5[128];
  v2_build_call_arg_label(context, 0, arg0, sizeof(arg0));
  v2_build_call_arg_label(context, 1, arg1, sizeof(arg1));
  v2_build_call_arg_label(context, 2, arg2, sizeof(arg2));
  v2_build_call_arg_label(context, 3, arg3, sizeof(arg3));
  v2_build_call_arg_label(context, 4, arg4, sizeof(arg4));
  v2_build_call_arg_label(context, 5, arg5, sizeof(arg5));

  if (strcmp(binding->cSymbol, "axisar_c") == 0) {
    SpiceDouble axis[3];
    SpiceDouble angle = 0.0;
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, axis) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &angle)) {
      return false;
    }

    SpiceDouble outMatrix[3][3];
    axisar_c(axis, angle, outMatrix);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in axisar_c");
    }

    SpiceDouble outFlat[9];
    v2_flatten_mat3_rowmajor(outMatrix, outFlat);
    return v2_set_return_json_from_vec(context, outFlat, 9);
  }

  if (strcmp(binding->cSymbol, "georec_c") == 0) {
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    SpiceDouble alt = 0.0;
    SpiceDouble re = 0.0;
    SpiceDouble f = 0.0;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &lon) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &lat) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[2], arg2, &alt) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[3], arg3, &re) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[4], arg4, &f)) {
      return false;
    }

    SpiceDouble rectan[3];
    georec_c(lon, lat, alt, re, f, rectan);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in georec_c");
    }

    return v2_set_return_json_from_vec(context, rectan, 3);
  }

  if (strcmp(binding->cSymbol, "latrec_c") == 0) {
    SpiceDouble radius = 0.0;
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &radius) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &lon) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[2], arg2, &lat)) {
      return false;
    }

    SpiceDouble rectan[3];
    latrec_c(radius, lon, lat, rectan);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in latrec_c");
    }

    return v2_set_return_json_from_vec(context, rectan, 3);
  }

  if (strcmp(binding->cSymbol, "mtxv_c") == 0) {
    SpiceDouble matrix[3][3];
    SpiceDouble vector[3];
    if (!v2_resolve_expr_mat3_value(
            context, context->resolved->valueTokens[0], arg0, matrix) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, vector)) {
      return false;
    }

    SpiceDouble out[3];
    mtxv_c(matrix, vector, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in mtxv_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "mxm_c") == 0) {
    SpiceDouble left[3][3];
    SpiceDouble right[3][3];
    if (!v2_resolve_expr_mat3_value(
            context, context->resolved->valueTokens[0], arg0, left) ||
        !v2_resolve_expr_mat3_value(
            context, context->resolved->valueTokens[1], arg1, right)) {
      return false;
    }

    SpiceDouble outMatrix[3][3];
    mxm_c(left, right, outMatrix);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in mxm_c");
    }

    SpiceDouble outFlat[9];
    v2_flatten_mat3_rowmajor(outMatrix, outFlat);
    return v2_set_return_json_from_vec(context, outFlat, 9);
  }

  if (strcmp(binding->cSymbol, "mxv_c") == 0) {
    SpiceDouble matrix[3][3];
    SpiceDouble vector[3];
    if (!v2_resolve_expr_mat3_value(
            context, context->resolved->valueTokens[0], arg0, matrix) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, vector)) {
      return false;
    }

    SpiceDouble out[3];
    mxv_c(matrix, vector, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in mxv_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "recgeo_c") == 0) {
    SpiceDouble rectan[3];
    SpiceDouble re = 0.0;
    SpiceDouble f = 0.0;
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, rectan) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &re) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[2], arg2, &f)) {
      return false;
    }

    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    SpiceDouble alt = 0.0;
    recgeo_c(rectan, re, f, &lon, &lat, &alt);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in recgeo_c");
    }

    return v2_set_return_json_from_named_triple(
        context, "lon", lon, "lat", lat, "alt", alt);
  }

  if (strcmp(binding->cSymbol, "reclat_c") == 0) {
    SpiceDouble rectan[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, rectan)) {
      return false;
    }

    SpiceDouble radius = 0.0;
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    reclat_c(rectan, &radius, &lon, &lat);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in reclat_c");
    }

    return v2_set_return_json_from_named_triple(
        context, "radius", radius, "lon", lon, "lat", lat);
  }

  if (strcmp(binding->cSymbol, "recsph_c") == 0) {
    SpiceDouble rectan[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, rectan)) {
      return false;
    }

    SpiceDouble radius = 0.0;
    SpiceDouble colat = 0.0;
    SpiceDouble lon = 0.0;
    recsph_c(rectan, &radius, &colat, &lon);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in recsph_c");
    }

    return v2_set_return_json_from_named_triple(
        context, "radius", radius, "colat", colat, "lon", lon);
  }

  if (strcmp(binding->cSymbol, "rotate_c") == 0) {
    SpiceDouble angle = 0.0;
    SpiceInt axis = 0;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &angle) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &axis)) {
      return false;
    }

    SpiceDouble outMatrix[3][3];
    rotate_c(angle, axis, outMatrix);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in rotate_c");
    }

    SpiceDouble outFlat[9];
    v2_flatten_mat3_rowmajor(outMatrix, outFlat);
    return v2_set_return_json_from_vec(context, outFlat, 9);
  }

  if (strcmp(binding->cSymbol, "rotmat_c") == 0) {
    SpiceDouble matrix[3][3];
    SpiceDouble angle = 0.0;
    SpiceInt axis = 0;
    if (!v2_resolve_expr_mat3_value(
            context, context->resolved->valueTokens[0], arg0, matrix) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &angle) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[2], arg2, &axis)) {
      return false;
    }

    SpiceDouble outMatrix[3][3];
    rotmat_c(matrix, angle, axis, outMatrix);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in rotmat_c");
    }

    SpiceDouble outFlat[9];
    v2_flatten_mat3_rowmajor(outMatrix, outFlat);
    return v2_set_return_json_from_vec(context, outFlat, 9);
  }

  if (strcmp(binding->cSymbol, "sphrec_c") == 0) {
    SpiceDouble radius = 0.0;
    SpiceDouble colat = 0.0;
    SpiceDouble lon = 0.0;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &radius) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &colat) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[2], arg2, &lon)) {
      return false;
    }

    SpiceDouble rectan[3];
    sphrec_c(radius, colat, lon, rectan);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in sphrec_c");
    }

    return v2_set_return_json_from_vec(context, rectan, 3);
  }

  if (strcmp(binding->cSymbol, "vadd_c") == 0) {
    SpiceDouble left[3];
    SpiceDouble right[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, left) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, right)) {
      return false;
    }

    SpiceDouble out[3];
    vadd_c(left, right, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vadd_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "vcrss_c") == 0) {
    SpiceDouble left[3];
    SpiceDouble right[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, left) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, right)) {
      return false;
    }

    SpiceDouble out[3];
    vcrss_c(left, right, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vcrss_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "vdot_c") == 0) {
    SpiceDouble left[3];
    SpiceDouble right[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, left) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, right)) {
      return false;
    }

    const SpiceDouble dot = vdot_c(left, right);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vdot_c");
    }

    return v2_set_return_json_from_double(context, dot);
  }

  if (strcmp(binding->cSymbol, "vhat_c") == 0) {
    SpiceDouble input[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, input)) {
      return false;
    }

    SpiceDouble out[3];
    vhat_c(input, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vhat_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "vminus_c") == 0) {
    SpiceDouble input[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, input)) {
      return false;
    }

    SpiceDouble out[3];
    vminus_c(input, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vminus_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "vnorm_c") == 0) {
    SpiceDouble input[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, input)) {
      return false;
    }

    const SpiceDouble norm = vnorm_c(input);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vnorm_c");
    }

    return v2_set_return_json_from_double(context, norm);
  }

  if (strcmp(binding->cSymbol, "vscl_c") == 0) {
    SpiceDouble scale = 0.0;
    SpiceDouble input[3];
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &scale) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, input)) {
      return false;
    }

    SpiceDouble out[3];
    vscl_c(scale, input, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vscl_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "vsub_c") == 0) {
    SpiceDouble left[3];
    SpiceDouble right[3];
    if (!v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[0], arg0, left) ||
        !v2_resolve_expr_vec3_value(
            context, context->resolved->valueTokens[1], arg1, right)) {
      return false;
    }

    SpiceDouble out[3];
    vsub_c(left, right, out);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in vsub_c");
    }

    return v2_set_return_json_from_vec(context, out, 3);
  }

  if (strcmp(binding->cSymbol, "kclear_c") == 0) {
    kclear_c();
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in kclear_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "exists_c") == 0) {
    char *path = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path)) {
      return false;
    }

    const SpiceBoolean exists = exists_c(path);
    free(path);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in exists_c");
    }

    return v2_set_return_json_from_bool(context, exists);
  }

  if (strcmp(binding->cSymbol, "expool_c") == 0) {
    char *name = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name)) {
      return false;
    }

    SpiceBoolean found = SPICEFALSE;
    expool_c(name, &found);
    free(name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in expool_c");
    }

    return v2_set_return_json_from_bool(context, found);
  }

  if (strcmp(binding->cSymbol, "bodfnd_c") == 0) {
    SpiceInt body = 0;
    char *item = NULL;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &body) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &item)) {
      free(item);
      return false;
    }

    const SpiceBoolean found = bodfnd_c(body, item);
    free(item);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in bodfnd_c");
    }

    return v2_set_return_json_from_bool(context, found);
  }

  if (strcmp(binding->cSymbol, "str2et_c") == 0) {
    char *time = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &time)) {
      return false;
    }

    SpiceDouble et = 0.0;
    str2et_c(time, &et);
    free(time);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in str2et_c");
    }

    return v2_set_return_json_from_double(context, et);
  }

  if (strcmp(binding->cSymbol, "unitim_c") == 0) {
    SpiceDouble epoch = 0.0;
    char *insys = NULL;
    char *outsys = NULL;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &epoch) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &insys) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &outsys)) {
      free(insys);
      free(outsys);
      return false;
    }

    const SpiceDouble out = unitim_c(epoch, insys, outsys);
    free(insys);
    free(outsys);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in unitim_c");
    }

    return v2_set_return_json_from_double(context, out);
  }

  if (strcmp(binding->cSymbol, "et2utc_c") == 0) {
    SpiceDouble et = 0.0;
    char *format = NULL;
    SpiceInt prec = 0;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &format) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[2], arg2, &prec)) {
      free(format);
      return false;
    }

    enum { V2_ET2UTC_RETURN_BUFFER_BYTES = 16 * 1024 };
    SpiceChar out[V2_ET2UTC_RETURN_BUFFER_BYTES];
    memset(out, 0, sizeof(out));

    et2utc_c(et,
             format,
             prec,
             (SpiceInt)V2_ET2UTC_RETURN_BUFFER_BYTES,
             out);
    free(format);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in et2utc_c");
    }

    out[V2_ET2UTC_RETURN_BUFFER_BYTES - 1] = '\0';
    return v2_set_return_json_from_string(context, out);
  }

  if (strcmp(binding->cSymbol, "spkez_c") == 0) {
    SpiceInt target = 0;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    char *abcorr = NULL;
    SpiceInt observer = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[3], arg3, &abcorr) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[4], arg4, &observer)) {
      free(ref);
      free(abcorr);
      return false;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkez_c(target, et, ref, abcorr, observer, state, &lt);
    free(ref);
    free(abcorr);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkez_c");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "state") &&
              v2_json_buffer_append_double_array(&out, state, 6) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "lt") &&
              v2_json_buffer_append_double(&out, lt) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spkezp_c") == 0) {
    SpiceInt target = 0;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    char *abcorr = NULL;
    SpiceInt observer = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[3], arg3, &abcorr) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[4], arg4, &observer)) {
      free(ref);
      free(abcorr);
      return false;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkezp_c(target, et, ref, abcorr, observer, pos, &lt);
    free(ref);
    free(abcorr);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkezp_c");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "pos") &&
              v2_json_buffer_append_double_array(&out, pos, 3) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "lt") &&
              v2_json_buffer_append_double(&out, lt) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spkezr_c") == 0) {
    char *target = NULL;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    char *abcorr = NULL;
    char *observer = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[3], arg3, &abcorr) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[4], arg4, &observer)) {
      free(target);
      free(ref);
      free(abcorr);
      free(observer);
      return false;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkezr_c(target, et, ref, abcorr, observer, state, &lt);
    free(target);
    free(ref);
    free(abcorr);
    free(observer);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkezr_c");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "state") &&
              v2_json_buffer_append_double_array(&out, state, 6) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "lt") &&
              v2_json_buffer_append_double(&out, lt) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spkgeo_c") == 0) {
    SpiceInt target = 0;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    SpiceInt observer = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[3], arg3, &observer)) {
      free(ref);
      return false;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkgeo_c(target, et, ref, observer, state, &lt);
    free(ref);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkgeo_c");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "state") &&
              v2_json_buffer_append_double_array(&out, state, 6) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "lt") &&
              v2_json_buffer_append_double(&out, lt) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spkgps_c") == 0) {
    SpiceInt target = 0;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    SpiceInt observer = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[3], arg3, &observer)) {
      free(ref);
      return false;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkgps_c(target, et, ref, observer, pos, &lt);
    free(ref);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkgps_c");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "pos") &&
              v2_json_buffer_append_double_array(&out, pos, 3) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "lt") &&
              v2_json_buffer_append_double(&out, lt) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spkpds_c") == 0) {
    SpiceInt body = 0;
    SpiceInt center = 0;
    char *frame = NULL;
    SpiceInt type = 0;
    SpiceDouble first = 0.0;
    SpiceDouble last = 0.0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &body) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &center) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &frame) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[3], arg3, &type) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[4], arg4, &first) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[5], arg5, &last)) {
      free(frame);
      return false;
    }

    SpiceDouble descr[5] = {0};
    spkpds_c(body, center, frame, type, first, last, descr);
    free(frame);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkpds_c");
    }

    return v2_set_return_json_from_vec(context, descr, 5);
  }

  if (strcmp(binding->cSymbol, "spkpos_c") == 0) {
    char *target = NULL;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    char *abcorr = NULL;
    char *observer = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[3], arg3, &abcorr) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[4], arg4, &observer)) {
      free(target);
      free(ref);
      free(abcorr);
      free(observer);
      return false;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkpos_c(target, et, ref, abcorr, observer, pos, &lt);
    free(target);
    free(ref);
    free(abcorr);
    free(observer);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkpos_c");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "pos") &&
              v2_json_buffer_append_double_array(&out, pos, 3) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "lt") &&
              v2_json_buffer_append_double(&out, lt) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spksfs_c") == 0) {
    SpiceInt body = 0;
    SpiceDouble et = 0.0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &body) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et)) {
      return false;
    }

    SpiceInt handle = 0;
    SpiceDouble descr[5] = {0};
    enum { V2_SPKSFS_IDENT_BYTES = 41 };
    SpiceChar ident[V2_SPKSFS_IDENT_BYTES];
    memset(ident, 0, sizeof(ident));
    SpiceBoolean found = SPICEFALSE;

    spksfs_c(body,
             et,
             &handle,
             descr,
             (SpiceInt)V2_SPKSFS_IDENT_BYTES,
             ident,
             &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spksfs_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    ident[V2_SPKSFS_IDENT_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)ident);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "handle") &&
              v2_json_buffer_append_int(&out, handle) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "descr") &&
              v2_json_buffer_append_double_array(&out, descr, 5) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "ident") &&
              v2_json_buffer_append_json_string(&out, ident) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "spkssb_c") == 0) {
    SpiceInt target = 0;
    SpiceDouble et = 0.0;
    char *ref = NULL;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &target) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ref)) {
      free(ref);
      return false;
    }

    SpiceDouble state[6] = {0};
    spkssb_c(target, et, ref, state);
    free(ref);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in spkssb_c");
    }

    return v2_set_return_json_from_vec(context, state, 6);
  }

  if (strcmp(binding->cSymbol, "dafbfs_c") == 0) {
    SpiceInt handle = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle)) {
      return false;
    }

    dafbfs_c(handle);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dafbfs_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "dafcls_c") == 0) {
    SpiceInt handle = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle)) {
      return false;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dafcls_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "daffna_c") == 0) {
    SpiceInt handle = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle)) {
      return false;
    }

    dafbfs_c(handle);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in daffna_c");
    }

    SpiceBoolean found = SPICEFALSE;
    daffna_c(&found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in daffna_c");
    }

    return v2_set_return_json_from_bool(context, found);
  }

  if (strcmp(binding->cSymbol, "dafopr_c") == 0) {
    char *path = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path)) {
      return false;
    }

    SpiceInt handle = 0;
    dafopr_c(path, &handle);
    free(path);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dafopr_c");
    }

    return v2_set_return_json_from_spiceint(context, handle);
  }

  if (strcmp(binding->cSymbol, "dascls_c") == 0) {
    SpiceInt handle = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle)) {
      return false;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dascls_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "dasopr_c") == 0) {
    char *path = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path)) {
      return false;
    }

    SpiceInt handle = 0;
    dasopr_c(path, &handle);
    free(path);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dasopr_c");
    }

    return v2_set_return_json_from_spiceint(context, handle);
  }

  if (strcmp(binding->cSymbol, "dlabfs_c") == 0) {
    SpiceInt handle = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle)) {
      return false;
    }

    SpiceDLADescr descr;
    memset(&descr, 0, sizeof(descr));
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &descr, &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dlabfs_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "descr") &&
              v2_json_buffer_append_dla_descriptor(&out, &descr) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "dlacls_c") == 0) {
    SpiceInt handle = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle)) {
      return false;
    }

    dlacls_c(handle);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dlacls_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "dlafns_c") == 0) {
    if (context->resolved->valueTokens[1] < 0) {
      write_error_json_ex("invalid_request",
                          "call(file-io.dlafns) requires descriptor argument",
                          context->fnName, NULL, NULL, NULL);
      return false;
    }

    SpiceInt handle = 0;
    SpiceDLADescr descr;
    memset(&descr, 0, sizeof(descr));
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &handle) ||
        !v2_parse_dla_descriptor_from_expr(
            context, context->resolved->valueTokens[1], arg1, &descr)) {
      return false;
    }

    SpiceDLADescr next;
    memset(&next, 0, sizeof(next));
    SpiceBoolean found = SPICEFALSE;
    dlafns_c(handle, &descr, &next, &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dlafns_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "descr") &&
              v2_json_buffer_append_dla_descriptor(&out, &next) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "dlaopn_c") == 0) {
    char *path = NULL;
    char *ftype = NULL;
    char *ifname = NULL;
    SpiceInt ncomch = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &ftype) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &ifname) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[3], arg3, &ncomch)) {
      free(path);
      free(ftype);
      free(ifname);
      return false;
    }

    SpiceInt handle = 0;
    dlaopn_c(path, ftype, ifname, ncomch, &handle);
    free(path);
    free(ftype);
    free(ifname);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dlaopn_c");
    }

    return v2_set_return_json_from_spiceint(context, handle);
  }

  if (strcmp(binding->cSymbol, "getfat_c") == 0) {
    char *path = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path)) {
      return false;
    }

    enum { V2_GETFAT_BUF_BYTES = 2048 };
    SpiceChar arch[V2_GETFAT_BUF_BYTES];
    SpiceChar type[V2_GETFAT_BUF_BYTES];
    memset(arch, 0, sizeof(arch));
    memset(type, 0, sizeof(type));

    getfat_c(path,
             (SpiceInt)V2_GETFAT_BUF_BYTES,
             (SpiceInt)V2_GETFAT_BUF_BYTES,
             arch,
             type);
    free(path);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in getfat_c");
    }

    arch[V2_GETFAT_BUF_BYTES - 1] = '\0';
    type[V2_GETFAT_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)arch);
    v2_trim_ascii_trailing_whitespace((char *)type);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "arch") &&
              v2_json_buffer_append_json_string(&out, arch) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "type") &&
              v2_json_buffer_append_json_string(&out, type) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "ccifrm_c") == 0) {
    SpiceInt frameClass = 0;
    SpiceInt classId = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &frameClass) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &classId)) {
      return false;
    }

    enum { V2_FRNAME_BUF_BYTES = 2048 };
    SpiceInt frcode = 0;
    SpiceChar frname[V2_FRNAME_BUF_BYTES];
    SpiceInt center = 0;
    SpiceBoolean found = SPICEFALSE;
    memset(frname, 0, sizeof(frname));

    ccifrm_c(frameClass,
             classId,
             (SpiceInt)V2_FRNAME_BUF_BYTES,
             &frcode,
             frname,
             &center,
             &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in ccifrm_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    frname[V2_FRNAME_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)frname);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frcode") &&
              v2_json_buffer_append_int(&out, frcode) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frname") &&
              v2_json_buffer_append_json_string(&out, frname) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "center") &&
              v2_json_buffer_append_int(&out, center) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "cidfrm_c") == 0) {
    SpiceInt center = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &center)) {
      return false;
    }

    enum { V2_FRNAME_BUF_BYTES = 2048 };
    SpiceInt frcode = 0;
    SpiceChar frname[V2_FRNAME_BUF_BYTES];
    SpiceBoolean found = SPICEFALSE;
    memset(frname, 0, sizeof(frname));

    cidfrm_c(center,
             (SpiceInt)V2_FRNAME_BUF_BYTES,
             &frcode,
             frname,
             &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in cidfrm_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    frname[V2_FRNAME_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)frname);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frcode") &&
              v2_json_buffer_append_int(&out, frcode) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frname") &&
              v2_json_buffer_append_json_string(&out, frname) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "cnmfrm_c") == 0) {
    char *centerName = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &centerName)) {
      return false;
    }

    enum { V2_FRNAME_BUF_BYTES = 2048 };
    SpiceInt frcode = 0;
    SpiceChar frname[V2_FRNAME_BUF_BYTES];
    SpiceBoolean found = SPICEFALSE;
    memset(frname, 0, sizeof(frname));

    cnmfrm_c(centerName,
             (SpiceInt)V2_FRNAME_BUF_BYTES,
             &frcode,
             frname,
             &found);
    free(centerName);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in cnmfrm_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    frname[V2_FRNAME_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)frname);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frcode") &&
              v2_json_buffer_append_int(&out, frcode) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frname") &&
              v2_json_buffer_append_json_string(&out, frname) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "frinfo_c") == 0) {
    SpiceInt frameId = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &frameId)) {
      return false;
    }

    SpiceInt center = 0;
    SpiceInt frameClass = 0;
    SpiceInt classId = 0;
    SpiceBoolean found = SPICEFALSE;
    frinfo_c(frameId, &center, &frameClass, &classId, &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in frinfo_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "center") &&
              v2_json_buffer_append_int(&out, center) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "frameClass") &&
              v2_json_buffer_append_int(&out, frameClass) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "classId") &&
              v2_json_buffer_append_int(&out, classId) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "frmnam_c") == 0) {
    SpiceInt code = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &code)) {
      return false;
    }

    enum { V2_FRNAME_BUF_BYTES = 2048 };
    SpiceChar name[V2_FRNAME_BUF_BYTES];
    memset(name, 0, sizeof(name));
    frmnam_c(code, (SpiceInt)V2_FRNAME_BUF_BYTES, name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in frmnam_c");
    }

    name[V2_FRNAME_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)name);
    if (name[0] == '\0') {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "name") &&
              v2_json_buffer_append_json_string(&out, name) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "namfrm_c") == 0) {
    char *name = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name)) {
      return false;
    }

    SpiceInt code = 0;
    namfrm_c(name, &code);
    free(name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in namfrm_c");
    }

    if (code == 0) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "code") &&
              v2_json_buffer_append_int(&out, code) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "pxform_c") == 0) {
    char *from = NULL;
    char *to = NULL;
    SpiceDouble et = 0.0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &from) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &to) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[2], arg2, &et)) {
      free(from);
      free(to);
      return false;
    }

    SpiceDouble matrix[3][3];
    pxform_c(from, to, et, matrix);
    free(from);
    free(to);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in pxform_c");
    }

    SpiceDouble flat[9];
    v2_flatten_mat3_rowmajor(matrix, flat);
    return v2_set_return_json_from_vec(context, flat, 9);
  }

  if (strcmp(binding->cSymbol, "sxform_c") == 0) {
    char *from = NULL;
    char *to = NULL;
    SpiceDouble et = 0.0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &from) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &to) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[2], arg2, &et)) {
      free(from);
      free(to);
      return false;
    }

    SpiceDouble matrix[6][6];
    sxform_c(from, to, et, matrix);
    free(from);
    free(to);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in sxform_c");
    }

    SpiceDouble flat[36];
    int k = 0;
    for (int r = 0; r < 6; r++) {
      for (int c = 0; c < 6; c++) {
        flat[k++] = matrix[r][c];
      }
    }
    return v2_set_return_json_from_vec(context, flat, 36);
  }

  if (strcmp(binding->cSymbol, "bodc2n_c") == 0) {
    SpiceInt code = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &code)) {
      return false;
    }

    enum { V2_BODY_NAME_BUF_BYTES = 2048 };
    SpiceChar name[V2_BODY_NAME_BUF_BYTES];
    SpiceBoolean found = SPICEFALSE;
    memset(name, 0, sizeof(name));

    bodc2n_c(code, (SpiceInt)V2_BODY_NAME_BUF_BYTES, name, &found);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in bodc2n_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    name[V2_BODY_NAME_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)name);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "name") &&
              v2_json_buffer_append_json_string(&out, name) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "boddef_c") == 0) {
    char *name = NULL;
    SpiceInt code = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &code)) {
      free(name);
      return false;
    }

    boddef_c(name, code);
    free(name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in boddef_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "bodn2c_c") == 0) {
    char *name = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name)) {
      return false;
    }

    SpiceInt code = 0;
    SpiceBoolean found = SPICEFALSE;
    bodn2c_c(name, &code, &found);
    free(name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in bodn2c_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "code") &&
              v2_json_buffer_append_int(&out, code) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "bods2c_c") == 0) {
    char *name = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name)) {
      return false;
    }

    SpiceInt code = 0;
    SpiceBoolean found = SPICEFALSE;
    bods2c_c(name, &code, &found);
    free(name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in bods2c_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "code") &&
              v2_json_buffer_append_int(&out, code) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "bodvcd_c") == 0) {
    SpiceInt body = 0;
    char *item = NULL;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &body) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &item)) {
      free(item);
      return false;
    }

    char poolVar[256];
    const int poolVarLen =
        snprintf(poolVar, sizeof(poolVar), "BODY%ld_%s", (long)body, item);
    if (poolVarLen < 0 || (size_t)poolVarLen >= sizeof(poolVar)) {
      free(item);
      write_error_json_ex("invalid_args", "Kernel pool variable name is too long",
                          arg1, NULL, NULL, NULL);
      return false;
    }

    SpiceBoolean found = SPICEFALSE;
    SpiceInt itemCount = 0;
    SpiceChar itemType[2] = {'\0', '\0'};
    dtpool_c(poolVar, &found, &itemCount, itemType);
    if (failed_c() == SPICETRUE) {
      free(item);
      return v2_write_spice_failure("SPICE error in bodvcd_c");
    }

    if (found != SPICETRUE || itemType[0] != 'N' || itemCount <= 0) {
      free(item);
      return v2_set_return_json_from_literal(context, "[]");
    }

    SpiceDouble *values = (SpiceDouble *)calloc((size_t)itemCount,
                                                sizeof(SpiceDouble));
    if (values == NULL) {
      free(item);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    SpiceInt dim = 0;
    bodvcd_c(body, item, itemCount, &dim, values);
    free(item);
    if (failed_c() == SPICETRUE) {
      free(values);
      return v2_write_spice_failure("SPICE error in bodvcd_c");
    }

    if (dim < 0) {
      dim = 0;
    } else if (dim > itemCount) {
      dim = itemCount;
    }

    const bool ok = v2_set_return_json_from_vec(context, values, (int)dim);
    free(values);
    return ok;
  }

  if (strcmp(binding->cSymbol, "cvpool_c") == 0) {
    char *agent = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &agent)) {
      return false;
    }

    SpiceBoolean update = SPICEFALSE;
    cvpool_c(agent, &update);
    free(agent);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in cvpool_c");
    }

    return v2_set_return_json_from_bool(context, update);
  }

  if (strcmp(binding->cSymbol, "dtpool_c") == 0) {
    char *name = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name)) {
      return false;
    }

    SpiceBoolean found = SPICEFALSE;
    SpiceInt n = 0;
    SpiceChar type[2] = {'\0', '\0'};
    dtpool_c(name, &found, &n, type);
    free(name);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in dtpool_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    const char t = type[0];
    if (t != 'C' && t != 'N') {
      write_error_json_ex("invalid_request", "dtpool() returned unexpected type",
                          context->fnName, NULL, NULL, NULL);
      return false;
    }

    char typeStr[2] = {t, '\0'};
    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "n") &&
              v2_json_buffer_append_int(&out, n) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "type") &&
              v2_json_buffer_append_json_string(&out, typeStr) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "gcpool_c") == 0) {
    char *name = NULL;
    SpiceInt start = 0;
    SpiceInt room = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &start) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[2], arg2, &room)) {
      free(name);
      return false;
    }

    if (start < 0 || room <= 0) {
      free(name);
      write_error_json_ex("invalid_args", "gcpool expects start>=0 and room>0",
                          context->fnName, NULL, NULL, NULL);
      return false;
    }

    enum { V2_POOL_STRING_BYTES = 2048 };
    char *values = (char *)calloc((size_t)room, (size_t)V2_POOL_STRING_BYTES);
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    SpiceInt n = 0;
    SpiceBoolean found = SPICEFALSE;
    gcpool_c(name,
             start,
             room,
             (SpiceInt)V2_POOL_STRING_BYTES,
             &n,
             values,
             &found);
    free(name);
    if (failed_c() == SPICETRUE) {
      free(values);
      return v2_write_spice_failure("SPICE error in gcpool_c");
    }

    if (found != SPICETRUE) {
      free(values);
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    if (n < 0) {
      n = 0;
    } else if (n > room) {
      n = room;
    }

    char **strings = NULL;
    if (n > 0) {
      strings = (char **)calloc((size_t)n, sizeof(char *));
      if (strings == NULL) {
        free(values);
        write_error_json("Out of memory", NULL, NULL, NULL);
        return false;
      }
    }

    for (SpiceInt i = 0; i < n; i++) {
      char *slot = values + ((size_t)i * (size_t)V2_POOL_STRING_BYTES);
      slot[V2_POOL_STRING_BYTES - 1] = '\0';
      v2_trim_ascii_trailing_whitespace(slot);
      if (strings != NULL) {
        strings[i] = slot;
      }
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "values") &&
              v2_json_buffer_append_string_array(&out, strings, (int)n) &&
              v2_json_buffer_append_char(&out, '}');

    free(strings);
    free(values);

    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "gdpool_c") == 0) {
    char *name = NULL;
    SpiceInt start = 0;
    SpiceInt room = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &start) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[2], arg2, &room)) {
      free(name);
      return false;
    }

    if (start < 0 || room <= 0) {
      free(name);
      write_error_json_ex("invalid_args", "gdpool expects start>=0 and room>0",
                          context->fnName, NULL, NULL, NULL);
      return false;
    }

    SpiceDouble *values = (SpiceDouble *)calloc((size_t)room,
                                                sizeof(SpiceDouble));
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    SpiceInt n = 0;
    SpiceBoolean found = SPICEFALSE;
    gdpool_c(name, start, room, &n, values, &found);
    free(name);
    if (failed_c() == SPICETRUE) {
      free(values);
      return v2_write_spice_failure("SPICE error in gdpool_c");
    }

    if (found != SPICETRUE) {
      free(values);
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    if (n < 0) {
      n = 0;
    } else if (n > room) {
      n = room;
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "values") &&
              v2_json_buffer_append_double_array(&out, values, (int)n) &&
              v2_json_buffer_append_char(&out, '}');
    free(values);

    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "gipool_c") == 0) {
    char *name = NULL;
    SpiceInt start = 0;
    SpiceInt room = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &start) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[2], arg2, &room)) {
      free(name);
      return false;
    }

    if (start < 0 || room <= 0) {
      free(name);
      write_error_json_ex("invalid_args", "gipool expects start>=0 and room>0",
                          context->fnName, NULL, NULL, NULL);
      return false;
    }

    SpiceInt *values = (SpiceInt *)calloc((size_t)room, sizeof(SpiceInt));
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    SpiceInt n = 0;
    SpiceBoolean found = SPICEFALSE;
    gipool_c(name, start, room, &n, values, &found);
    free(name);
    if (failed_c() == SPICETRUE) {
      free(values);
      return v2_write_spice_failure("SPICE error in gipool_c");
    }

    if (found != SPICETRUE) {
      free(values);
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    if (n < 0) {
      n = 0;
    } else if (n > room) {
      n = room;
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "values") &&
              v2_json_buffer_append_spiceint_array(&out, values, (int)n) &&
              v2_json_buffer_append_char(&out, '}');
    free(values);

    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "gnpool_c") == 0) {
    char *templ = NULL;
    SpiceInt start = 0;
    SpiceInt room = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &templ) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &start) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[2], arg2, &room)) {
      free(templ);
      return false;
    }

    if (start < 0 || room <= 0) {
      free(templ);
      write_error_json_ex("invalid_args", "gnpool expects start>=0 and room>0",
                          context->fnName, NULL, NULL, NULL);
      return false;
    }

    enum { V2_POOL_NAME_BYTES = 64 };
    char *values = (char *)calloc((size_t)room, (size_t)V2_POOL_NAME_BYTES);
    if (values == NULL) {
      free(templ);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    SpiceInt n = 0;
    SpiceBoolean found = SPICEFALSE;
    gnpool_c(templ,
             start,
             room,
             (SpiceInt)V2_POOL_NAME_BYTES,
             &n,
             values,
             &found);
    free(templ);
    if (failed_c() == SPICETRUE) {
      free(values);
      return v2_write_spice_failure("SPICE error in gnpool_c");
    }

    if (found != SPICETRUE) {
      free(values);
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    if (n < 0) {
      n = 0;
    } else if (n > room) {
      n = room;
    }

    char **strings = NULL;
    if (n > 0) {
      strings = (char **)calloc((size_t)n, sizeof(char *));
      if (strings == NULL) {
        free(values);
        write_error_json("Out of memory", NULL, NULL, NULL);
        return false;
      }
    }

    for (SpiceInt i = 0; i < n; i++) {
      char *slot = values + ((size_t)i * (size_t)V2_POOL_NAME_BYTES);
      slot[V2_POOL_NAME_BYTES - 1] = '\0';
      v2_trim_ascii_trailing_whitespace(slot);
      if (strings != NULL) {
        strings[i] = slot;
      }
    }

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "values") &&
              v2_json_buffer_append_string_array(&out, strings, (int)n) &&
              v2_json_buffer_append_char(&out, '}');

    free(strings);
    free(values);

    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "pcpool_c") == 0) {
    char *name = NULL;
    char **values = NULL;
    int valueCount = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_string_array_values(
            context, context->resolved->valueTokens[1], arg1, &values,
            &valueCount)) {
      free(name);
      v2_free_string_array_values(values, valueCount);
      return false;
    }

    char *matrix = NULL;
    SpiceInt valueWidth = 0;
    if (!v2_build_fixed_width_string_matrix(values,
                                            valueCount,
                                            1,
                                            &matrix,
                                            &valueWidth)) {
      free(name);
      v2_free_string_array_values(values, valueCount);
      return false;
    }

    pcpool_c(name, (SpiceInt)valueCount, valueWidth, matrix);
    free(name);
    v2_free_string_array_values(values, valueCount);
    free(matrix);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in pcpool_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "pdpool_c") == 0) {
    char *name = NULL;
    SpiceDouble *values = NULL;
    int valueCount = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_double_array_values(
            context, context->resolved->valueTokens[1], arg1, &values,
            &valueCount)) {
      free(name);
      free(values);
      return false;
    }

    pdpool_c(name, (SpiceInt)valueCount, values);
    free(name);
    free(values);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in pdpool_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "pipool_c") == 0) {
    char *name = NULL;
    SpiceInt *values = NULL;
    int valueCount = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &name) ||
        !v2_resolve_expr_spiceint_array_values(
            context, context->resolved->valueTokens[1], arg1, &values,
            &valueCount)) {
      free(name);
      free(values);
      return false;
    }

    pipool_c(name, (SpiceInt)valueCount, values);
    free(name);
    free(values);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in pipool_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "swpool_c") == 0) {
    char *agent = NULL;
    char **names = NULL;
    int nameCount = 0;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &agent) ||
        !v2_resolve_expr_string_array_values(
            context, context->resolved->valueTokens[1], arg1, &names,
            &nameCount)) {
      free(agent);
      v2_free_string_array_values(names, nameCount);
      return false;
    }

    char *matrix = NULL;
    SpiceInt nameWidth = 0;
    if (!v2_build_fixed_width_string_matrix(names,
                                            nameCount,
                                            1,
                                            &matrix,
                                            &nameWidth)) {
      free(agent);
      v2_free_string_array_values(names, nameCount);
      return false;
    }

    swpool_c(agent, (SpiceInt)nameCount, nameWidth, matrix);
    free(agent);
    v2_free_string_array_values(names, nameCount);
    free(matrix);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in swpool_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "furnsh_c") == 0) {
    char *path = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path)) {
      return false;
    }

    furnsh_c(path);
    free(path);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in furnsh_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "kdata_c") == 0) {
    SpiceInt which = 0;
    char *kind = NULL;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &which) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &kind)) {
      free(kind);
      return false;
    }

    enum { V2_KERNEL_BUF_BYTES = 2048 };
    SpiceChar file[V2_KERNEL_BUF_BYTES];
    SpiceChar filtyp[V2_KERNEL_BUF_BYTES];
    SpiceChar source[V2_KERNEL_BUF_BYTES];
    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;
    memset(file, 0, sizeof(file));
    memset(filtyp, 0, sizeof(filtyp));
    memset(source, 0, sizeof(source));

    kdata_c(which,
            kind,
            (SpiceInt)V2_KERNEL_BUF_BYTES,
            (SpiceInt)V2_KERNEL_BUF_BYTES,
            (SpiceInt)V2_KERNEL_BUF_BYTES,
            file,
            filtyp,
            source,
            &handle,
            &found);
    free(kind);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in kdata_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    file[V2_KERNEL_BUF_BYTES - 1] = '\0';
    filtyp[V2_KERNEL_BUF_BYTES - 1] = '\0';
    source[V2_KERNEL_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)file);
    v2_trim_ascii_trailing_whitespace((char *)filtyp);
    v2_trim_ascii_trailing_whitespace((char *)source);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "file") &&
              v2_json_buffer_append_json_string(&out, file) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "filtyp") &&
              v2_json_buffer_append_json_string(&out, filtyp) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "source") &&
              v2_json_buffer_append_json_string(&out, source) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "handle") &&
              v2_json_buffer_append_int(&out, handle) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "kinfo_c") == 0) {
    char *file = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &file)) {
      return false;
    }

    enum { V2_KERNEL_BUF_BYTES = 2048 };
    SpiceChar filtyp[V2_KERNEL_BUF_BYTES];
    SpiceChar source[V2_KERNEL_BUF_BYTES];
    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;
    memset(filtyp, 0, sizeof(filtyp));
    memset(source, 0, sizeof(source));

    kinfo_c(file,
            (SpiceInt)V2_KERNEL_BUF_BYTES,
            (SpiceInt)V2_KERNEL_BUF_BYTES,
            filtyp,
            source,
            &handle,
            &found);
    free(file);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in kinfo_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    filtyp[V2_KERNEL_BUF_BYTES - 1] = '\0';
    source[V2_KERNEL_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)filtyp);
    v2_trim_ascii_trailing_whitespace((char *)source);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "filtyp") &&
              v2_json_buffer_append_json_string(&out, filtyp) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "source") &&
              v2_json_buffer_append_json_string(&out, source) &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "handle") &&
              v2_json_buffer_append_int(&out, handle) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "kplfrm_c") == 0) {
    SpiceInt frameClass = 0;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &frameClass)) {
      return false;
    }

    SPICEINT_CELL(idset, 1024);
    scard_c(0, &idset);
    kplfrm_c(frameClass, &idset);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in kplfrm_c");
    }

    const SpiceInt count = card_c(&idset);
    const SpiceInt *values = (const SpiceInt *)idset.data;
    return v2_set_return_json_from_spiceint_array(context, values, (int)count);
  }

  if (strcmp(binding->cSymbol, "ktotal_c") == 0) {
    char *kind = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &kind)) {
      return false;
    }

    SpiceInt count = 0;
    ktotal_c(kind, &count);
    free(kind);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in ktotal_c");
    }

    return v2_set_return_json_from_spiceint(context, count);
  }

  if (strcmp(binding->cSymbol, "kxtrct_c") == 0) {
    char *keywd = NULL;
    char **terms = NULL;
    int termCount = 0;
    char *wordsq = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &keywd) ||
        !v2_resolve_expr_string_array_values(
            context, context->resolved->valueTokens[1], arg1, &terms,
            &termCount) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[2], arg2, &wordsq)) {
      free(keywd);
      v2_free_string_array_values(terms, termCount);
      free(wordsq);
      return false;
    }

    char *termsMatrix = NULL;
    SpiceInt termWidth = 0;
    if (!v2_build_fixed_width_string_matrix(terms,
                                            termCount,
                                            1,
                                            &termsMatrix,
                                            &termWidth)) {
      free(keywd);
      v2_free_string_array_values(terms, termCount);
      free(wordsq);
      return false;
    }

    const size_t wordsqLen = strlen(wordsq);
    if (wordsqLen + 1U > (size_t)INT_MAX) {
      free(keywd);
      v2_free_string_array_values(terms, termCount);
      free(wordsq);
      free(termsMatrix);
      write_error_json_ex("invalid_args", "wordsq is too long", arg2, NULL,
                          NULL, NULL);
      return false;
    }

    const SpiceInt wordsqWidth = (SpiceInt)(wordsqLen + 1U);
    char *wordsqMutable = (char *)malloc((size_t)wordsqWidth);
    if (wordsqMutable == NULL) {
      free(keywd);
      v2_free_string_array_values(terms, termCount);
      free(wordsq);
      free(termsMatrix);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
    memcpy(wordsqMutable, wordsq, (size_t)wordsqWidth);

    enum { V2_KXTRCT_SUBSTR_BYTES = 2048 };
    SpiceChar substr[V2_KXTRCT_SUBSTR_BYTES];
    memset(substr, 0, sizeof(substr));

    SpiceBoolean found = SPICEFALSE;
    kxtrct_c(keywd,
             termWidth,
             termsMatrix,
             (SpiceInt)termCount,
             wordsqWidth,
             (SpiceInt)V2_KXTRCT_SUBSTR_BYTES,
             wordsqMutable,
             &found,
             substr);

    free(keywd);
    v2_free_string_array_values(terms, termCount);
    free(wordsq);
    free(termsMatrix);
    free(wordsqMutable);

    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in kxtrct_c");
    }

    if (found != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    substr[V2_KXTRCT_SUBSTR_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)substr);

    V2JsonBuffer out;
    v2_json_buffer_init(&out);
    bool ok = v2_json_buffer_append_char(&out, '{') &&
              v2_json_buffer_append_json_key(&out, "found") &&
              v2_json_buffer_append_cstr(&out, "true") &&
              v2_json_buffer_append_char(&out, ',') &&
              v2_json_buffer_append_json_key(&out, "xtract") &&
              v2_json_buffer_append_json_string(&out, substr) &&
              v2_json_buffer_append_char(&out, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&out);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &out);
    v2_json_buffer_free(&out);
    return ok;
  }

  if (strcmp(binding->cSymbol, "unload_c") == 0) {
    char *path = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &path)) {
      return false;
    }

    unload_c(path);
    free(path);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in unload_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "deltet_c") == 0) {
    SpiceDouble epoch = 0.0;
    char *eptype = NULL;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &epoch) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &eptype)) {
      free(eptype);
      return false;
    }

    SpiceDouble delta = 0.0;
    deltet_c(epoch, eptype, &delta);
    free(eptype);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in deltet_c");
    }

    return v2_set_return_json_from_double(context, delta);
  }

  if (strcmp(binding->cSymbol, "timdef_c") == 0) {
    char *action = NULL;
    char *item = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &action) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &item)) {
      free(action);
      free(item);
      return false;
    }

    if (strcmp(action, "GET") == 0) {
      enum { V2_TIMDEF_BUF_BYTES = 2048 };
      SpiceChar out[V2_TIMDEF_BUF_BYTES];
      memset(out, 0, sizeof(out));
      timdef_c(action, item, (SpiceInt)V2_TIMDEF_BUF_BYTES, out);
      free(action);
      free(item);
      if (failed_c() == SPICETRUE) {
        return v2_write_spice_failure("SPICE error in timdef_c");
      }

      out[V2_TIMDEF_BUF_BYTES - 1] = '\0';
      v2_trim_ascii_trailing_whitespace((char *)out);
      return v2_set_return_json_from_string(context, out);
    }

    timdef_c(action, item, (SpiceInt)(strlen(item) + 1U), item);
    free(action);
    free(item);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in timdef_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "timout_c") == 0) {
    SpiceDouble et = 0.0;
    char *pictur = NULL;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &et) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &pictur)) {
      free(pictur);
      return false;
    }

    enum { V2_TIMOUT_BUF_BYTES = 2048 };
    SpiceChar out[V2_TIMOUT_BUF_BYTES];
    memset(out, 0, sizeof(out));
    timout_c(et, pictur, (SpiceInt)V2_TIMOUT_BUF_BYTES, out);
    free(pictur);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in timout_c");
    }

    out[V2_TIMOUT_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)out);
    return v2_set_return_json_from_string(context, out);
  }

  if (strcmp(binding->cSymbol, "tparse_c") == 0) {
    char *input = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &input)) {
      return false;
    }

    SpiceDouble et = 0.0;
    enum { V2_TPARSE_ERR_BYTES = 2048 };
    SpiceChar errmsg[V2_TPARSE_ERR_BYTES];
    memset(errmsg, 0, sizeof(errmsg));

    tparse_c(input, (SpiceInt)V2_TPARSE_ERR_BYTES, &et, errmsg);
    free(input);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in tparse_c");
    }

    errmsg[V2_TPARSE_ERR_BYTES - 1] = '\0';
    if (errmsg[0] != '\0') {
      write_error_json_ex("invalid_args", errmsg, context->fnName, NULL, NULL,
                          NULL);
      return false;
    }

    return v2_set_return_json_from_double(context, et);
  }

  if (strcmp(binding->cSymbol, "tpictr_c") == 0) {
    char *sample = NULL;
    char *pictur = NULL;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &sample) ||
        !v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[1], arg1, &pictur)) {
      free(sample);
      free(pictur);
      return false;
    }

    enum { V2_TPICTR_BUF_BYTES = 2048 };
    SpiceChar out[V2_TPICTR_BUF_BYTES];
    SpiceChar errmsg[V2_TPICTR_BUF_BYTES];
    SpiceBoolean okFlag = SPICEFALSE;
    strncpy((char *)out, pictur, (size_t)V2_TPICTR_BUF_BYTES - 1U);
    out[V2_TPICTR_BUF_BYTES - 1] = '\0';
    memset(errmsg, 0, sizeof(errmsg));

    tpictr_c(sample,
             (SpiceInt)V2_TPICTR_BUF_BYTES,
             out,
             &okFlag,
             errmsg);
    free(sample);
    free(pictur);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in tpictr_c");
    }

    if (okFlag != SPICETRUE) {
      return v2_set_return_json_from_literal(context, "{\"found\":false}");
    }

    out[V2_TPICTR_BUF_BYTES - 1] = '\0';
    v2_trim_ascii_trailing_whitespace((char *)out);

    V2JsonBuffer outJson;
    v2_json_buffer_init(&outJson);
    bool ok = v2_json_buffer_append_char(&outJson, '{') &&
              v2_json_buffer_append_json_key(&outJson, "found") &&
              v2_json_buffer_append_cstr(&outJson, "true") &&
              v2_json_buffer_append_char(&outJson, ',') &&
              v2_json_buffer_append_json_key(&outJson, "picture") &&
              v2_json_buffer_append_json_string(&outJson, out) &&
              v2_json_buffer_append_char(&outJson, '}');
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      v2_json_buffer_free(&outJson);
      return false;
    }

    ok = v2_set_return_json_from_buffer(context, &outJson);
    v2_json_buffer_free(&outJson);
    return ok;
  }

  if (strcmp(binding->cSymbol, "insrtc_c") == 0) {
    char *item = NULL;
    int cellRefIndex = -1;
    if (!v2_resolve_expr_string_value(
            context, context->resolved->valueTokens[0], arg0, &item) ||
        !v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[1], arg1, &cellRefIndex)) {
      free(item);
      return false;
    }

    insrtc_c(item, &context->refs[cellRefIndex].cell);
    free(item);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in insrtc_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "insrtd_c") == 0) {
    SpiceDouble item = 0.0;
    int cellRefIndex = -1;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &item) ||
        !v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[1], arg1, &cellRefIndex)) {
      return false;
    }

    insrtd_c(item, &context->refs[cellRefIndex].cell);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in insrtd_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "insrti_c") == 0) {
    SpiceInt item = 0;
    int cellRefIndex = -1;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &item) ||
        !v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[1], arg1, &cellRefIndex)) {
      return false;
    }

    insrti_c(item, &context->refs[cellRefIndex].cell);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in insrti_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "wninsd_c") == 0) {
    SpiceDouble left = 0.0;
    SpiceDouble right = 0.0;
    int windowRefIndex = -1;
    if (!v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[0], arg0, &left) ||
        !v2_resolve_expr_double_value(
            context, context->resolved->valueTokens[1], arg1, &right) ||
        !v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[2], arg2, &windowRefIndex)) {
      return false;
    }

    wninsd_c(left, right, &context->refs[windowRefIndex].cell);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in wninsd_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "wnvald_c") == 0) {
    SpiceInt insize = 0;
    SpiceInt n = 0;
    int windowRefIndex = -1;
    if (!v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[0], arg0, &insize) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &n) ||
        !v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[2], arg2, &windowRefIndex)) {
      return false;
    }

    wnvald_c(insize, n, &context->refs[windowRefIndex].cell);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in wnvald_c");
    }

    return v2_set_return_json_from_literal(context, "null");
  }

  if (strcmp(binding->cSymbol, "wncard_c") == 0) {
    int windowRefIndex = -1;
    if (!v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[0], arg0, &windowRefIndex)) {
      return false;
    }

    const SpiceInt out = wncard_c(&context->refs[windowRefIndex].cell);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in wncard_c");
    }

    return v2_set_return_json_from_spiceint(context, out);
  }

  if (strcmp(binding->cSymbol, "wnfetd_c") == 0) {
    int windowRefIndex = -1;
    SpiceInt n = 0;
    if (!v2_resolve_expr_cell_or_window_ref_index(
            context, context->resolved->valueTokens[0], arg0, &windowRefIndex) ||
        !v2_resolve_expr_spiceint_value(
            context, context->resolved->valueTokens[1], arg1, &n)) {
      return false;
    }

    SpiceDouble left = 0.0;
    SpiceDouble right = 0.0;
    wnfetd_c(&context->refs[windowRefIndex].cell, n, &left, &right);
    if (failed_c() == SPICETRUE) {
      return v2_write_spice_failure("SPICE error in wnfetd_c");
    }

    SpiceDouble out[2] = { left, right };
    return v2_set_return_json_from_vec(context, out, 2);
  }

  write_error_json_ex("unsupported_call", "Unsupported v2 call",
                      context->fnName, NULL, NULL, NULL);
  return false;
}

static bool v2_invoke_contract_return_binding(
    const V2CallInvokeContext *context,
    const V2NativeReturnBindingEntry *binding) {
  if (binding == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  switch (binding->kind) {
  case V2_NATIVE_RETURN_BINDING_GENERATED_RETURN_BINDING_LANE:
    return v2_invoke_generated_return_binding_lane(context, binding);
  case V2_NATIVE_RETURN_BINDING_EXPR_STRING_TO_JSON_STRING:
    return v2_invoke_return_expr_string_to_json_string(
        context, binding->exprStringToJsonStringFn);
  case V2_NATIVE_RETURN_BINDING_EXPR_SPICE_INT_TO_JSON_STRING_VIA_SIZED_OUT_BUFFER:
    return v2_invoke_return_expr_spice_int_to_json_string_via_sized_out_buffer(
        context, binding->exprSpiceIntToJsonStringViaSizedOutBufferFn);
  default:
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }
}

static bool v2_invoke_contract_return(const V2CallInvokeContext *context) {
  if (context == NULL || context->spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  const V2NativeReturnBindingEntry *binding =
      v2_lookup_native_return_binding(context->spec->id);

  if (binding == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  if (binding->cSymbol == NULL ||
      strcmp(binding->cSymbol, context->spec->cSymbol) != 0) {
    char detail[256];
    detail[0] = '\0';
    snprintf(detail,
             sizeof(detail),
             "binding.cSymbol=%s spec.cSymbol=%s",
             binding->cSymbol != NULL ? binding->cSymbol : "<null>",
             context->spec->cSymbol != NULL ? context->spec->cSymbol : "<null>");
    write_error_json_ex("invalid_request",
                        "Generated native return binding symbol mismatch",
                        detail,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  return v2_invoke_contract_return_binding(context, binding);
}

typedef bool (*V2CallInvokerFn)(const V2CallInvokeContext *context);

#define V2_NATIVE_CALL_DISPATCH_CASE(_fnId, _invoker) \
  case _fnId:                                       \
    return _invoker;

static V2CallInvokerFn v2_lookup_call_invoker(const V2FunctionId fnId) {
  switch (fnId) {
    V2_NATIVE_CALL_DISPATCH_ROWS(V2_NATIVE_CALL_DISPATCH_CASE)
  default:
    return NULL;
  }
}

#undef V2_NATIVE_CALL_DISPATCH_CASE

bool v2_invoke_call(const V2CallInvokeContext *context) {
  if (context == NULL || context->spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  if (context->returnValueJson != NULL) {
    *context->returnValueJson = NULL;
  }

  V2CallInvokerFn invoker = v2_lookup_call_invoker(context->spec->id);

  if (invoker == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  return invoker(context);
}
