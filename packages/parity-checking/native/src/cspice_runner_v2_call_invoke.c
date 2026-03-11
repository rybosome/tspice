#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_call_invoke.h"
#include "cspice_runner_v2_json_buffer.h"
#include "generated/native_as_spice_int_bindings.h"
#include "generated/native_call_dispatch.h"
#include "generated/native_return_bindings.h"

#include <string.h>

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

static bool v2_resolve_expr_double_value(const V2CallInvokeContext *context,
                                         int exprTok,
                                         const char *label,
                                         SpiceDouble *outValue) {
  int valueTok = -1;
  if (!v2_resolve_expr_value_token(context, exprTok, label, &valueTok)) {
    return false;
  }

  if (valueTok < 0 || valueTok >= context->tokenCount ||
      context->tokens[valueTok].type != JSMN_PRIMITIVE) {
    write_error_json_ex("invalid_args", "Expression must resolve to number", label,
                        NULL, NULL, NULL);
    return false;
  }

  return v2_parse_double_token_or_error(
      context->json, &context->tokens[valueTok], outValue, label);
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
  v2_build_call_arg_label(context, 0, arg0, sizeof(arg0));
  v2_build_call_arg_label(context, 1, arg1, sizeof(arg1));
  v2_build_call_arg_label(context, 2, arg2, sizeof(arg2));
  v2_build_call_arg_label(context, 3, arg3, sizeof(arg3));
  v2_build_call_arg_label(context, 4, arg4, sizeof(arg4));

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
