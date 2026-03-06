#include "cspice_runner_json_emit.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_call.h"
#include "cspice_runner_v2_call_invoke.h"
#include "generated/function_registry.h"

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
        v2_find_arg_value_token(json, tokens, tokenCount, argsTok, argName);
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

static bool v2_require_as_output_ref(const char *json, const jsmntok_t *tokens,
                                     int tokenCount, int stepTok,
                                     const char *fnName,
                                     char **outName) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args",
                        "call requires string \"as\" output ref", fnName,
                        NULL, NULL, NULL);
    return false;
  }

  return v2_strdup_json_token(json, &tokens[asTok], outName);
}

static bool v2_forbid_as_output_ref(const char *json, const jsmntok_t *tokens,
                                    int tokenCount, int stepTok,
                                    const char *fnName) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (asTok >= 0) {
    write_error_json_ex("invalid_args", "call does not allow \"as\" output ref",
                        fnName, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_require_out_map(const char *json, const jsmntok_t *tokens,
                               int tokenCount, int stepTok,
                               const char *fnName,
                               int *outMapTok) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok < 0 || tokens[outTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_args", "call requires object \"out\" map",
                        fnName, NULL, NULL, NULL);
    return false;
  }

  *outMapTok = outTok;
  return true;
}

static bool v2_forbid_out_map(const char *json, const jsmntok_t *tokens,
                              int tokenCount, int stepTok,
                              const char *fnName) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok >= 0) {
    write_error_json_ex("invalid_args", "call does not allow \"out\" map",
                        fnName, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static void v2_clear_resolved_args(V2ResolvedCallArgs *args) {
  memset(args, 0, sizeof(*args));
  for (int i = 0; i < V2_FUNCTION_MAX_ARITY; i++) {
    args->refIndices[i] = -1;
    args->valueTokens[i] = -1;
  }
}

static void v2_free_resolved_args(V2ResolvedCallArgs *args) {
  for (int i = 0; i < V2_FUNCTION_MAX_ARITY; i++) {
    free(args->pathValues[i]);
    args->pathValues[i] = NULL;
  }
}

static bool v2_resolve_call_args(const char *json, const jsmntok_t *tokens,
                                 int tokenCount, int stepTok, int argsTok,
                                 V2RefEntry *refs, int refCount,
                                 const V2FunctionSpec *spec,
                                 const char *fnName,
                                 V2ResolvedCallArgs *out) {
  int inTok = jsmn_find_object_key(json, tokens, stepTok, "in", tokenCount);
  if (inTok < 0 || tokens[inTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "call requires array \"in\"",
                        fnName, NULL, NULL, NULL);
    return false;
  }

  if (tokens[inTok].size != spec->arity) {
    char msg[128];
    snprintf(msg, sizeof(msg), "call expects %d input(s)", spec->arity);
    write_error_json_ex("invalid_request", msg, fnName, NULL, NULL, NULL);
    return false;
  }

  v2_clear_resolved_args(out);

  int idx = inTok + 1;
  for (int i = 0; i < spec->arity; i++) {
    int valueTok = idx;
    switch (spec->argKinds[i]) {
    case V2_FUNCTION_ARG_INT_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "call(%s).in[%d]", fnName, i);
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
        write_error_json_ex("invalid_args", "call integer input must be >= 0",
                            fnName, NULL, NULL, NULL);
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_FUNCTION_ARG_CELL_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "call(%s).in[%d]", fnName, i);
      if (!v2_resolve_cell_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_FUNCTION_ARG_CELL_OR_WINDOW_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "call(%s).in[%d]", fnName, i);
      if (!v2_resolve_cell_or_window_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_FUNCTION_ARG_PATH_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "call(%s).in[%d]", fnName, i);
      if (!v2_resolve_path_expr(json,
                                tokens,
                                tokenCount,
                                valueTok,
                                argsTok,
                                refs,
                                refCount,
                                label,
                                &out->pathValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_FUNCTION_ARG_DAS_HANDLE_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "call(%s).in[%d]", fnName, i);
      if (!v2_resolve_das_handle_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_FUNCTION_ARG_DLA_DESCRIPTOR_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "call(%s).in[%d]", fnName, i);
      if (!v2_resolve_dla_descr_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_FUNCTION_ARG_EXPR:
      out->valueTokens[i] = valueTok;
      break;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "call input parse error", NULL,
                          NULL, NULL, NULL);
      v2_free_resolved_args(out);
      return false;
    }
  }

  return true;
}

bool v2_execute_call_step(const char *json, const jsmntok_t *tokens,
                          int tokenCount, int stepTok,
                          int argsTok, V2RefEntry *refs,
                          int *refCount,
                          char **returnValueJson) {
  if (returnValueJson != NULL) {
    *returnValueJson = NULL;
  }

  int fnTok = jsmn_find_object_key(json, tokens, stepTok, "fn", tokenCount);
  if (fnTok < 0 || tokens[fnTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "call requires string fn", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  char *fnName = NULL;
  if (!v2_strdup_json_token(json, &tokens[fnTok], &fnName)) {
    return false;
  }

  const V2FunctionSpec *spec = v2_lookup_function_spec(fnName);
  if (spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call", fnName,
                        NULL, NULL, NULL);
    free(fnName);
    return false;
  }

  char *asRefName = NULL;
  int outMapTok = -1;
  if (spec->outputBindingPolicy == V2_FUNCTION_OUTPUT_BINDING_POLICY_FORBIDDEN) {
    if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, fnName) ||
        !v2_forbid_out_map(json, tokens, tokenCount, stepTok, fnName)) {
      free(fnName);
      return false;
    }
  } else {
    switch (spec->resultMode) {
    case V2_FUNCTION_RESULT_AS_SPICE_INT:
    case V2_FUNCTION_RESULT_AS_DSK_DESCRIPTOR:
      if (!v2_require_as_output_ref(
              json, tokens, tokenCount, stepTok, fnName, &asRefName) ||
          !v2_forbid_out_map(json, tokens, tokenCount, stepTok, fnName)) {
        free(fnName);
        free(asRefName);
        return false;
      }
      break;

    case V2_FUNCTION_RESULT_OUT_NAMED_DSKB02:
      if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, fnName) ||
          !v2_require_out_map(json,
                              tokens,
                              tokenCount,
                              stepTok,
                              fnName,
                              &outMapTok)) {
        free(fnName);
        return false;
      }
      break;

    case V2_FUNCTION_RESULT_FORBIDDEN:
      write_error_json_ex("invalid_request",
                          "Generated output binding policy mismatch",
                          fnName,
                          NULL,
                          NULL,
                          NULL);
      free(fnName);
      return false;

    case V2_FUNCTION_RESULT_RETURN:
      if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, fnName) ||
          !v2_forbid_out_map(json, tokens, tokenCount, stepTok, fnName)) {
        free(fnName);
        return false;
      }
      break;
    }
  }

  V2ResolvedCallArgs resolved;
  if (!v2_resolve_call_args(json,
                            tokens,
                            tokenCount,
                            stepTok,
                            argsTok,
                            refs,
                            *refCount,
                            spec,
                            fnName,
                            &resolved)) {
    free(fnName);
    free(asRefName);
    return false;
  }

  V2CallInvokeContext invokeContext = {
      .json = json,
      .tokens = tokens,
      .tokenCount = tokenCount,
      .fnName = fnName,
      .spec = spec,
      .argsTok = argsTok,
      .asRefName = asRefName,
      .outMapTok = outMapTok,
      .returnValueJson = returnValueJson,
      .resolved = &resolved,
      .refs = refs,
      .refCount = refCount,
  };

  bool ok = v2_invoke_call(&invokeContext);

  if (ok && spec->resultMode == V2_FUNCTION_RESULT_RETURN &&
      returnValueJson != NULL && *returnValueJson == NULL) {
    write_error_json_ex("invalid_request",
                        "call result.mode=return expected invoker output",
                        fnName, NULL, NULL, NULL);
    ok = false;
  }

  if (!ok && returnValueJson != NULL && *returnValueJson != NULL) {
    free(*returnValueJson);
    *returnValueJson = NULL;
  }

  v2_free_resolved_args(&resolved);
  free(fnName);
  free(asRefName);
  return ok;
}
