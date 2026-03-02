#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_call_spec.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_spice_call.h"

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

static bool v2_resolve_path_expr(const char *json, const jsmntok_t *tokens,
                                 int tokenCount, int exprTok, int argsTok,
                                 V2RefEntry *refs, int refCount,
                                 const char *label, char **outPath) {
  if (exprTok < 0 || exprTok >= tokenCount ||
      tokens[exprTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Path expression must be a string", label,
                        NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(json, &tokens[exprTok], &expr)) {
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0 || tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "Missing or invalid v2 string argument",
                          argName, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    char *resolved = NULL;
    bool ok = v2_strdup_json_token(json, &tokens[valueTok], &resolved);
    free(expr);
    if (!ok) {
      return false;
    }

    *outPath = resolved;
    return true;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    if (strchr(refName, '.') != NULL) {
      write_error_json_ex("invalid_args", "Ref must use $refs.<name>", refName,
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

    if (refs[refIndex].type != V2_REF_PATH || refs[refIndex].pathValue == NULL) {
      write_error_json_ex("invalid_args", "v2 ref is not a path", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    char *resolved = strdup(refs[refIndex].pathValue);
    free(expr);
    if (resolved == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    *outPath = resolved;
    return true;
  }

  *outPath = expr;
  return true;
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
    snprintf(msg, sizeof(msg), "%s must be a finite number", label);
    break;
  }

  write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
  return false;
}

static bool v2_parse_boolean_token_or_error(const char *json,
                                            const jsmntok_t *tok,
                                            SpiceBoolean *out,
                                            const char *label) {
  if (tok->type != JSMN_PRIMITIVE) {
    write_error_json_ex("invalid_args", "Expression must resolve to boolean",
                        label, NULL, NULL, NULL);
    return false;
  }

  const int len = tok->end - tok->start;
  const char *value = json + tok->start;
  if (len == 4 && strncmp(value, "true", 4) == 0) {
    *out = SPICETRUE;
    return true;
  }
  if (len == 5 && strncmp(value, "false", 5) == 0) {
    *out = SPICEFALSE;
    return true;
  }

  write_error_json_ex("invalid_args", "Expression must resolve to boolean",
                      label, NULL, NULL, NULL);
  return false;
}

static bool v2_resolve_double_expr(const char *json,
                                   const jsmntok_t *tokens,
                                   int tokenCount,
                                   int exprTok,
                                   int argsTok,
                                   V2RefEntry *refs,
                                   int refCount,
                                   const char *label,
                                   SpiceDouble *out) {
  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[exprTok];
  if (tok->type == JSMN_PRIMITIVE) {
    return v2_parse_double_token_or_error(json, tok, out, label);
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to number",
                        label, NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(json, tok, &expr)) {
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    bool ok =
        v2_parse_double_token_or_error(json, &tokens[valueTok], out, label);
    free(expr);
    return ok;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    if (strchr(refName, '.') != NULL) {
      write_error_json_ex("invalid_args",
                          "Ref must use $refs.<name> for numeric expressions",
                          refName,
                          NULL,
                          NULL,
                          NULL);
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

    if (refs[refIndex].type != V2_REF_INT) {
      write_error_json_ex("invalid_args",
                          "v2 ref is not a numeric scalar",
                          refName,
                          NULL,
                          NULL,
                          NULL);
      free(expr);
      return false;
    }

    *out = (SpiceDouble)refs[refIndex].intValue;
    free(expr);
    return true;
  }

  write_error_json_ex("invalid_args", "Unsupported numeric expression", expr,
                      NULL, NULL, NULL);
  free(expr);
  return false;
}

static bool v2_resolve_boolean_expr(const char *json,
                                    const jsmntok_t *tokens,
                                    int tokenCount,
                                    int exprTok,
                                    int argsTok,
                                    const char *label,
                                    SpiceBoolean *out) {
  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[exprTok];
  if (tok->type == JSMN_PRIMITIVE) {
    return v2_parse_boolean_token_or_error(json, tok, out, label);
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to boolean",
                        label, NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(json, tok, &expr)) {
    return false;
  }

  const char *argName = NULL;
  if (!v2_parse_ref_name(expr, "$args.", &argName)) {
    write_error_json_ex("invalid_args", "Unsupported boolean expression", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  int valueTok = jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
  if (valueTok < 0) {
    write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                        NULL, NULL);
    free(expr);
    return false;
  }

  bool ok = v2_parse_boolean_token_or_error(json, &tokens[valueTok], out, label);
  free(expr);
  return ok;
}

static bool v2_copy_double_array(const SpiceDouble *source,
                                 int sourceCount,
                                 SpiceDouble **outValues,
                                 int *outCount) {
  *outValues = NULL;
  *outCount = 0;

  if (sourceCount < 0) {
    return false;
  }

  if (sourceCount == 0) {
    return true;
  }

  if (source == NULL || (size_t)sourceCount > SIZE_MAX / sizeof(SpiceDouble)) {
    return false;
  }

  SpiceDouble *copy = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)sourceCount);
  if (copy == NULL) {
    return false;
  }

  memcpy(copy, source, sizeof(SpiceDouble) * (size_t)sourceCount);
  *outValues = copy;
  *outCount = sourceCount;
  return true;
}

static bool v2_copy_int_array(const SpiceInt *source,
                              int sourceCount,
                              SpiceInt **outValues,
                              int *outCount) {
  *outValues = NULL;
  *outCount = 0;

  if (sourceCount < 0) {
    return false;
  }

  if (sourceCount == 0) {
    return true;
  }

  if (source == NULL || (size_t)sourceCount > SIZE_MAX / sizeof(SpiceInt)) {
    return false;
  }

  SpiceInt *copy = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)sourceCount);
  if (copy == NULL) {
    return false;
  }

  memcpy(copy, source, sizeof(SpiceInt) * (size_t)sourceCount);
  *outValues = copy;
  *outCount = sourceCount;
  return true;
}

static bool v2_parse_double_array_token(const char *json,
                                        const jsmntok_t *tokens,
                                        int tokenCount,
                                        int arrayTok,
                                        const char *label,
                                        SpiceDouble **outValues,
                                        int *outCount) {
  if (arrayTok < 0 || arrayTok >= tokenCount ||
      tokens[arrayTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_args", "Expression must resolve to number[]",
                        label, NULL, NULL, NULL);
    return false;
  }

  const int valueCount = tokens[arrayTok].size;
  if (valueCount < 0 || (size_t)valueCount > SIZE_MAX / sizeof(SpiceDouble)) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceDouble *values = NULL;
  if (valueCount > 0) {
    values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)valueCount);
    if (values == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
  }

  int idx = arrayTok + 1;
  for (int i = 0; i < valueCount; i++) {
    if (idx < 0 || idx >= tokenCount) {
      free(values);
      write_error_json_ex("invalid_request", "spiceCall array parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char valueLabel[128];
    snprintf(valueLabel, sizeof(valueLabel), "%s[%d]", label, i);
    if (!v2_parse_double_token_or_error(json, &tokens[idx], &values[i],
                                        valueLabel)) {
      free(values);
      return false;
    }

    idx = jsmn_skip_subtree(tokens, idx, tokenCount);
    if (idx < 0) {
      free(values);
      write_error_json_ex("invalid_request", "spiceCall array parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  *outValues = values;
  *outCount = valueCount;
  return true;
}

static bool v2_parse_int_array_token(const char *json,
                                     const jsmntok_t *tokens,
                                     int tokenCount,
                                     int arrayTok,
                                     const char *label,
                                     SpiceInt **outValues,
                                     int *outCount) {
  if (arrayTok < 0 || arrayTok >= tokenCount ||
      tokens[arrayTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_args", "Expression must resolve to spiceInt[]",
                        label, NULL, NULL, NULL);
    return false;
  }

  const int valueCount = tokens[arrayTok].size;
  if (valueCount < 0 || (size_t)valueCount > SIZE_MAX / sizeof(SpiceInt)) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceInt *values = NULL;
  if (valueCount > 0) {
    values = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)valueCount);
    if (values == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
  }

  int idx = arrayTok + 1;
  for (int i = 0; i < valueCount; i++) {
    if (idx < 0 || idx >= tokenCount) {
      free(values);
      write_error_json_ex("invalid_request", "spiceCall array parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char valueLabel[128];
    snprintf(valueLabel, sizeof(valueLabel), "%s[%d]", label, i);
    if (!v2_parse_int_token_or_error(json, &tokens[idx], &values[i],
                                     valueLabel)) {
      free(values);
      return false;
    }

    idx = jsmn_skip_subtree(tokens, idx, tokenCount);
    if (idx < 0) {
      free(values);
      write_error_json_ex("invalid_request", "spiceCall array parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  *outValues = values;
  *outCount = valueCount;
  return true;
}

static bool v2_resolve_double_array_expr(const char *json,
                                         const jsmntok_t *tokens,
                                         int tokenCount,
                                         int exprTok,
                                         int argsTok,
                                         V2RefEntry *refs,
                                         int refCount,
                                         const char *label,
                                         SpiceDouble **outValues,
                                         int *outCount) {
  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  if (tokens[exprTok].type == JSMN_ARRAY) {
    return v2_parse_double_array_token(
        json, tokens, tokenCount, exprTok, label, outValues, outCount);
  }

  if (tokens[exprTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to number[]",
                        label, NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(json, &tokens[exprTok], &expr)) {
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    bool ok = v2_parse_double_array_token(
        json, tokens, tokenCount, valueTok, label, outValues, outCount);
    free(expr);
    return ok;
  }

  if (!v2_parse_ref_name(expr, "$refs.", &refName) || strchr(refName, '.') != NULL) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr, NULL,
                        NULL, NULL);
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

  if (refs[refIndex].type != V2_REF_DOUBLE_ARRAY) {
    write_error_json_ex("invalid_args", "v2 ref is not a double array", refName,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  bool ok = v2_copy_double_array(refs[refIndex].doubleArrayValue,
                                 refs[refIndex].doubleArrayLen,
                                 outValues,
                                 outCount);
  free(expr);
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_resolve_int_array_expr(const char *json,
                                      const jsmntok_t *tokens,
                                      int tokenCount,
                                      int exprTok,
                                      int argsTok,
                                      V2RefEntry *refs,
                                      int refCount,
                                      const char *label,
                                      SpiceInt **outValues,
                                      int *outCount) {
  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  if (tokens[exprTok].type == JSMN_ARRAY) {
    return v2_parse_int_array_token(
        json, tokens, tokenCount, exprTok, label, outValues, outCount);
  }

  if (tokens[exprTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to spiceInt[]",
                        label, NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(json, &tokens[exprTok], &expr)) {
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    bool ok = v2_parse_int_array_token(
        json, tokens, tokenCount, valueTok, label, outValues, outCount);
    free(expr);
    return ok;
  }

  if (!v2_parse_ref_name(expr, "$refs.", &refName) || strchr(refName, '.') != NULL) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr, NULL,
                        NULL, NULL);
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

  if (refs[refIndex].type != V2_REF_INT_ARRAY) {
    write_error_json_ex("invalid_args", "v2 ref is not an int array", refName,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  bool ok = v2_copy_int_array(refs[refIndex].intArrayValue,
                              refs[refIndex].intArrayLen,
                              outValues,
                              outCount);
  free(expr);
  if (!ok) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_require_as_output_ref(const char *json, const jsmntok_t *tokens,
                                     int tokenCount, int stepTok,
                                     const V2SpiceCallSpec *spec,
                                     char **outName) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args",
                        "spiceCall requires string \"as\" output ref",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  return v2_strdup_json_token(json, &tokens[asTok], outName);
}

static bool v2_forbid_as_output_ref(const char *json, const jsmntok_t *tokens,
                                    int tokenCount, int stepTok,
                                    const V2SpiceCallSpec *spec) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (asTok >= 0) {
    write_error_json_ex("invalid_args",
                        "spiceCall does not allow \"as\" output ref",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_require_out_map(const char *json, const jsmntok_t *tokens,
                               int tokenCount, int stepTok,
                               const V2SpiceCallSpec *spec,
                               int *outMapTok) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok < 0 || tokens[outTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_args",
                        "spiceCall requires object \"out\" map",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  *outMapTok = outTok;
  return true;
}

static bool v2_forbid_out_map(const char *json, const jsmntok_t *tokens,
                              int tokenCount, int stepTok,
                              const V2SpiceCallSpec *spec) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok >= 0) {
    write_error_json_ex("invalid_args", "spiceCall does not allow \"out\" map",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  return true;
}

typedef struct {
  SpiceInt intValues[V2_SPICE_CALL_MAX_ARITY];
  SpiceDouble doubleValues[V2_SPICE_CALL_MAX_ARITY];
  SpiceBoolean boolValues[V2_SPICE_CALL_MAX_ARITY];
  int refIndices[V2_SPICE_CALL_MAX_ARITY];
  char *stringValues[V2_SPICE_CALL_MAX_ARITY];
  SpiceDouble *doubleArrayValues[V2_SPICE_CALL_MAX_ARITY];
  int doubleArrayLengths[V2_SPICE_CALL_MAX_ARITY];
  SpiceInt *intArrayValues[V2_SPICE_CALL_MAX_ARITY];
  int intArrayLengths[V2_SPICE_CALL_MAX_ARITY];
} V2ResolvedSpiceCallArgs;

static void v2_clear_resolved_args(V2ResolvedSpiceCallArgs *args) {
  memset(args, 0, sizeof(*args));
  for (int i = 0; i < V2_SPICE_CALL_MAX_ARITY; i++) {
    args->refIndices[i] = -1;
  }
}

static void v2_free_resolved_args(V2ResolvedSpiceCallArgs *args) {
  for (int i = 0; i < V2_SPICE_CALL_MAX_ARITY; i++) {
    free(args->stringValues[i]);
    args->stringValues[i] = NULL;

    free(args->doubleArrayValues[i]);
    args->doubleArrayValues[i] = NULL;
    args->doubleArrayLengths[i] = 0;

    free(args->intArrayValues[i]);
    args->intArrayValues[i] = NULL;
    args->intArrayLengths[i] = 0;
  }
}

static bool v2_resolve_call_args(const char *json, const jsmntok_t *tokens,
                                 int tokenCount, int stepTok, int argsTok,
                                 V2RefEntry *refs, int refCount,
                                 const V2SpiceCallSpec *spec,
                                 V2ResolvedSpiceCallArgs *out) {
  int inTok = jsmn_find_object_key(json, tokens, stepTok, "in", tokenCount);
  if (inTok < 0 || tokens[inTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "spiceCall requires array \"in\"",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  if (tokens[inTok].size != spec->arity) {
    char msg[128];
    snprintf(msg, sizeof(msg), "spiceCall expects %d input(s)", spec->arity);
    write_error_json_ex("invalid_request", msg, spec->name, NULL, NULL, NULL);
    return false;
  }

  v2_clear_resolved_args(out);

  int idx = inTok + 1;
  for (int i = 0; i < spec->arity; i++) {
    int valueTok = idx;
    switch (spec->argKinds[i]) {
    case V2_SPICE_CALL_ARG_INT_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_spiceint_expr(json,
                                    tokens,
                                    tokenCount,
                                    valueTok,
                                    argsTok,
                                    refs,
                                    refCount,
                                    label,
                                    &out->intValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }

      if ((spec->nonNegativeIntArgMask & (1U << i)) != 0U &&
          out->intValues[i] < 0) {
        write_error_json_ex("invalid_args", "spiceCall integer input must be >= 0",
                            spec->name, NULL, NULL, NULL);
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_DOUBLE_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_double_expr(json,
                                  tokens,
                                  tokenCount,
                                  valueTok,
                                  argsTok,
                                  refs,
                                  refCount,
                                  label,
                                  &out->doubleValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_BOOLEAN_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_boolean_expr(json,
                                   tokens,
                                   tokenCount,
                                   valueTok,
                                   argsTok,
                                   label,
                                   &out->boolValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_CELL_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_cell_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_cell_or_window_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_SPICE_CALL_ARG_PATH_EXPR:
    case V2_SPICE_CALL_ARG_STRING_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_path_expr(json,
                                tokens,
                                tokenCount,
                                valueTok,
                                argsTok,
                                refs,
                                refCount,
                                label,
                                &out->stringValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_DOUBLE_ARRAY_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_double_array_expr(json,
                                        tokens,
                                        tokenCount,
                                        valueTok,
                                        argsTok,
                                        refs,
                                        refCount,
                                        label,
                                        &out->doubleArrayValues[i],
                                        &out->doubleArrayLengths[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_INT_ARRAY_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_int_array_expr(json,
                                     tokens,
                                     tokenCount,
                                     valueTok,
                                     argsTok,
                                     refs,
                                     refCount,
                                     label,
                                     &out->intArrayValues[i],
                                     &out->intArrayLengths[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_DAS_HANDLE_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_das_handle_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_SPICE_CALL_ARG_DLA_DESCR_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_dla_descr_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "spiceCall input parse error", NULL,
                          NULL, NULL, NULL);
      v2_free_resolved_args(out);
      return false;
    }
  }

  return true;
}

static bool v2_execute_read_virtual_output_call(const char *path) {
  FILE *fp = fopen(path, "rb");
  if (fp == NULL) {
    char detail[384];
    snprintf(detail, sizeof(detail), "%s (%s)", path, strerror(errno));
    write_error_json_ex("invalid_request",
                        "spiceCall readVirtualOutput failed to open file",
                        detail, NULL, NULL, NULL);
    return false;
  }

  if (fseek(fp, 0, SEEK_END) != 0) {
    fclose(fp);
    write_error_json_ex("invalid_request",
                        "spiceCall readVirtualOutput could not read file size",
                        path, NULL, NULL, NULL);
    return false;
  }

  long size = ftell(fp);
  fclose(fp);
  if (size <= 0) {
    write_error_json_ex("invalid_request",
                        "spiceCall readVirtualOutput expected non-empty bytes",
                        path, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_emit_named_dskmi2_outputs(const char *json,
                                         const jsmntok_t *tokens,
                                         int tokenCount,
                                         int outMapTok,
                                         V2RefEntry *refs,
                                         int *refCount,
                                         const SpiceDouble *spaixd,
                                         int spaixdCount,
                                         const SpiceInt *spaixi,
                                         int spaixiCount) {
  const int pairCount = jsmn_object_pair_count(&tokens[outMapTok]);
  if (pairCount < 0) {
    write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = outMapTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING ||
        tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
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

    bool ok = true;
    if (strcmp(outName, "spaixd") == 0) {
      ok = v2_add_ref_double_array(refs, refCount, refName, spaixd, spaixdCount);
    } else if (strcmp(outName, "spaixi") == 0) {
      ok = v2_add_ref_int_array(refs, refCount, refName, spaixi, spaixiCount);
    } else if (strcmp(outName, "spaixdLength") == 0) {
      ok = v2_add_ref_int(refs, refCount, refName, (SpiceInt)spaixdCount);
    } else if (strcmp(outName, "spaixiLength") == 0) {
      ok = v2_add_ref_int(refs, refCount, refName, (SpiceInt)spaixiCount);
    } else {
      write_error_json_ex("invalid_args",
                          "Unsupported dskmi2 named out param",
                          outName,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
    }

    free(outName);
    free(refName);
    if (!ok) {
      return false;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

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
    write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = outMapTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING ||
        tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
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
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

bool v2_execute_spice_call_step(const char *json, const jsmntok_t *tokens,
                                int tokenCount, int stepTok,
                                int argsTok, V2RefEntry *refs,
                                int *refCount) {
  int callTok = jsmn_find_object_key(json, tokens, stepTok, "call", tokenCount);
  if (callTok < 0 || tokens[callTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "spiceCall requires string call", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  char *callName = NULL;
  if (!v2_strdup_json_token(json, &tokens[callTok], &callName)) {
    return false;
  }

  const V2SpiceCallSpec *spec = v2_lookup_spice_call_spec(callName);
  if (spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", callName,
                        NULL, NULL, NULL);
    free(callName);
    return false;
  }

  char *asRefName = NULL;
  int outMapTok = -1;
  switch (spec->outputKind) {
  case V2_SPICE_CALL_OUTPUT_AS_INT:
  case V2_SPICE_CALL_OUTPUT_AS_DSK_DESCR:
  case V2_SPICE_CALL_OUTPUT_AS_DAS_HANDLE:
    if (!v2_require_as_output_ref(
            json, tokens, tokenCount, stepTok, spec, &asRefName) ||
        !v2_forbid_out_map(json, tokens, tokenCount, stepTok, spec)) {
      free(callName);
      free(asRefName);
      return false;
    }
    break;

  case V2_SPICE_CALL_OUTPUT_NAMED_DSKB02:
  case V2_SPICE_CALL_OUTPUT_NAMED_DSKMI2:
    if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, spec) ||
        !v2_require_out_map(json,
                            tokens,
                            tokenCount,
                            stepTok,
                            spec,
                            &outMapTok)) {
      free(callName);
      return false;
    }
    break;

  case V2_SPICE_CALL_OUTPUT_FORBIDDEN:
    if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, spec) ||
        !v2_forbid_out_map(json, tokens, tokenCount, stepTok, spec)) {
      free(callName);
      return false;
    }
    break;
  }

  V2ResolvedSpiceCallArgs resolved;
  if (!v2_resolve_call_args(json,
                            tokens,
                            tokenCount,
                            stepTok,
                            argsTok,
                            refs,
                            *refCount,
                            spec,
                            &resolved)) {
    free(callName);
    free(asRefName);
    return false;
  }

  bool ok = true;
  switch (spec->id) {
  case V2_SPICE_CALL_CARD: {
    SpiceInt value = card_c(&refs[resolved.refIndices[0]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in card_c");
      break;
    }

    ok = v2_add_ref_int(refs, refCount, asRefName, value);
    break;
  }

  case V2_SPICE_CALL_SIZE: {
    SpiceInt value = size_c(&refs[resolved.refIndices[0]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in size_c");
      break;
    }

    ok = v2_add_ref_int(refs, refCount, asRefName, value);
    break;
  }

  case V2_SPICE_CALL_SCARD:
    scard_c(resolved.intValues[0], &refs[resolved.refIndices[1]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in scard_c");
    }
    break;

  case V2_SPICE_CALL_SSIZE:
    ssize_c(resolved.intValues[0], &refs[resolved.refIndices[1]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in ssize_c");
    }
    break;

  case V2_SPICE_CALL_VALID:
    valid_c(resolved.intValues[0],
            resolved.intValues[1],
            &refs[resolved.refIndices[2]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in valid_c");
    }
    break;

  case V2_SPICE_CALL_DSKOBJ:
    dskobj_c(resolved.stringValues[0], &refs[resolved.refIndices[1]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dskobj_c");
    }
    break;

  case V2_SPICE_CALL_DSKSRF:
    dsksrf_c(resolved.stringValues[0],
             resolved.intValues[1],
             &refs[resolved.refIndices[2]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dsksrf_c");
    }
    break;

  case V2_SPICE_CALL_DSKGD: {
    SpiceDSKDescr descriptor;
    memset(&descriptor, 0, sizeof(descriptor));
    dskgd_c(refs[resolved.refIndices[0]].handleValue,
            &refs[resolved.refIndices[1]].dlaDescrValue,
            &descriptor);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dskgd_c");
      break;
    }

    ok = v2_add_ref_dsk_descr(refs, refCount, asRefName, &descriptor);
    break;
  }

  case V2_SPICE_CALL_DSKB02: {
    SpiceInt nv = 0;
    SpiceInt np = 0;
    SpiceInt nvxtot = 0;
    SpiceDouble vtxbds[3][2];
    SpiceDouble voxsiz = 0.0;
    SpiceDouble voxori[3];
    SpiceDouble vgrext[3];
    SpiceInt cgscal = 0;
    SpiceInt vtxnpl = 0;
    SpiceInt voxnpt = 0;
    SpiceInt voxnpl = 0;

    dskb02_c(refs[resolved.refIndices[0]].handleValue,
             &refs[resolved.refIndices[1]].dlaDescrValue,
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
      ok = v2_write_spice_failure("SPICE error in dskb02_c");
      break;
    }

    ok = v2_emit_named_dskb02_outputs(json,
                                      tokens,
                                      tokenCount,
                                      outMapTok,
                                      refs,
                                      refCount,
                                      nv,
                                      np,
                                      nvxtot,
                                      cgscal,
                                      vtxnpl,
                                      voxnpt,
                                      voxnpl);
    break;
  }

  case V2_SPICE_CALL_DSKOPN: {
    SpiceInt handle = 0;
    dskopn_c(resolved.stringValues[0],
             resolved.stringValues[1],
             resolved.intValues[2],
             &handle);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dskopn_c");
      break;
    }

    ok = v2_add_ref_das_handle(refs, refCount, asRefName, handle);
    break;
  }

  case V2_SPICE_CALL_DSKMI2: {
    const SpiceInt nv = resolved.intValues[0];
    const SpiceInt np = resolved.intValues[2];
    const SpiceInt worksz = resolved.intValues[6];
    const SpiceInt spxisz = resolved.intValues[10];

    if (nv <= 0 || np <= 0 || worksz <= 0 || spxisz <= 0) {
      write_error_json_ex("invalid_args",
                          "dskmi2_c expects positive nv/np/worksz/spxisz",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if ((size_t)nv > SIZE_MAX / 3U ||
        (size_t)resolved.doubleArrayLengths[1] != (size_t)nv * 3U) {
      write_error_json_ex("invalid_args",
                          "dskmi2_c vrtces length must equal nv * 3",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if ((size_t)np > SIZE_MAX / 3U ||
        (size_t)resolved.intArrayLengths[3] != (size_t)np * 3U) {
      write_error_json_ex("invalid_args",
                          "dskmi2_c plates length must equal np * 3",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if ((size_t)worksz > SIZE_MAX / sizeof(SpiceInt[2]) ||
        (size_t)spxisz > SIZE_MAX / sizeof(SpiceInt)) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      ok = false;
      break;
    }

    SpiceInt(*work)[2] =
        (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) * (size_t)worksz);
    SpiceInt *spaixi = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)spxisz);
    if (work == NULL || spaixi == NULL) {
      free(work);
      free(spaixi);
      write_error_json("Out of memory", NULL, NULL, NULL);
      ok = false;
      break;
    }

    SpiceDouble spaixd[SPICE_DSK02_IXDFIX];
    dskmi2_c(nv,
             (SpiceDouble(*)[3])resolved.doubleArrayValues[1],
             np,
             (SpiceInt(*)[3])resolved.intArrayValues[3],
             resolved.doubleValues[4],
             resolved.intValues[5],
             worksz,
             resolved.intValues[7],
             resolved.intValues[8],
             resolved.boolValues[9],
             spxisz,
             work,
             spaixd,
             spaixi);
    free(work);

    if (failed_c() == SPICETRUE) {
      free(spaixi);
      ok = v2_write_spice_failure("SPICE error in dskmi2_c");
      break;
    }

    ok = v2_emit_named_dskmi2_outputs(json,
                                      tokens,
                                      tokenCount,
                                      outMapTok,
                                      refs,
                                      refCount,
                                      spaixd,
                                      SPICE_DSK02_IXDFIX,
                                      spaixi,
                                      (int)spxisz);
    free(spaixi);
    break;
  }

  case V2_SPICE_CALL_DSKW02: {
    const SpiceInt nv = resolved.intValues[15];
    const SpiceInt np = resolved.intValues[17];

    if (nv <= 0 || np <= 0) {
      write_error_json_ex("invalid_args",
                          "dskw02_c expects positive nv and np",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if (resolved.doubleArrayLengths[6] != SPICE_DSK_NSYPAR) {
      write_error_json_ex("invalid_args",
                          "dskw02_c corpar length must equal SPICE_DSK_NSYPAR",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if ((size_t)nv > SIZE_MAX / 3U ||
        (size_t)resolved.doubleArrayLengths[16] != (size_t)nv * 3U) {
      write_error_json_ex("invalid_args",
                          "dskw02_c vrtces length must equal nv * 3",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if ((size_t)np > SIZE_MAX / 3U ||
        (size_t)resolved.intArrayLengths[18] != (size_t)np * 3U) {
      write_error_json_ex("invalid_args",
                          "dskw02_c plates length must equal np * 3",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if (resolved.doubleArrayLengths[19] != SPICE_DSK02_IXDFIX) {
      write_error_json_ex("invalid_args",
                          "dskw02_c spaixd length must equal SPICE_DSK02_IXDFIX",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    if (resolved.intArrayLengths[20] <= 0) {
      write_error_json_ex("invalid_args",
                          "dskw02_c spaixi must be non-empty",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
      break;
    }

    dskw02_c(refs[resolved.refIndices[0]].handleValue,
             resolved.intValues[1],
             resolved.intValues[2],
             resolved.intValues[3],
             resolved.stringValues[4],
             resolved.intValues[5],
             resolved.doubleArrayValues[6],
             resolved.doubleValues[7],
             resolved.doubleValues[8],
             resolved.doubleValues[9],
             resolved.doubleValues[10],
             resolved.doubleValues[11],
             resolved.doubleValues[12],
             resolved.doubleValues[13],
             resolved.doubleValues[14],
             nv,
             (SpiceDouble(*)[3])resolved.doubleArrayValues[16],
             np,
             (SpiceInt(*)[3])resolved.intArrayValues[18],
             resolved.doubleArrayValues[19],
             resolved.intArrayValues[20]);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dskw02_c");
    }
    break;
  }

  case V2_SPICE_CALL_READ_VIRTUAL_OUTPUT:
    ok = v2_execute_read_virtual_output_call(resolved.stringValues[0]);
    break;

  case V2_SPICE_CALL_UNKNOWN:
  default:
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", callName,
                        NULL, NULL, NULL);
    ok = false;
    break;
  }

  v2_free_resolved_args(&resolved);
  free(callName);
  free(asRefName);
  return ok;
}
