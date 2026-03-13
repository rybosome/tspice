#include "cspice_runner_generated_dispatch_seam.h"
#include "cspice_runner_json_emit.h"
#include "cspice_runner_workflow.h"

static bool string_is_blank(const char *value) {
  if (value == NULL) {
    return true;
  }

  for (const unsigned char *p = (const unsigned char *)value; *p != '\0'; p++) {
    if (!isspace(*p)) {
      return false;
    }
  }

  return true;
}

static bool duplicate_json_string_or_error(const char *json,
                                           const jsmntok_t *tok,
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
    return false;
  }

  write_error_json("Out of memory", NULL, NULL, NULL);
  return false;
}

static bool duplicate_required_string_field(const char *json,
                                            const jsmntok_t *tokens,
                                            int tokenCount,
                                            int objTok,
                                            const char *field,
                                            const char *message,
                                            char **out) {
  int fieldTok = jsmn_find_object_key(json, tokens, objTok, field, tokenCount);
  if (fieldTok < 0 || fieldTok >= tokenCount ||
      tokens[fieldTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", message, NULL, NULL, NULL, NULL);
    return false;
  }

  if (!duplicate_json_string_or_error(json, &tokens[fieldTok], out)) {
    return false;
  }

  if (string_is_blank(*out)) {
    free(*out);
    *out = NULL;
    write_error_json_ex("invalid_request", message, NULL, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool resolve_object_path_token(const char *json,
                                      const jsmntok_t *tokens,
                                      int tokenCount,
                                      int rootTok,
                                      const char *path,
                                      const char *label,
                                      int *outTok) {
  if (path == NULL || path[0] == '\0') {
    *outTok = rootTok;
    return true;
  }

  int currentTok = rootTok;
  const char *cursor = path;

  while (cursor[0] != '\0') {
    if (tokens[currentTok].type != JSMN_OBJECT) {
      write_error_json_ex("invalid_args",
                          "Reference path expected object while resolving", label,
                          NULL, NULL, NULL);
      return false;
    }

    const char *dot = strchr(cursor, '.');
    const size_t segmentLen =
        dot != NULL ? (size_t)(dot - cursor) : strlen(cursor);
    if (segmentLen == 0) {
      write_error_json_ex("invalid_request", "Invalid reference expression",
                          label, NULL, NULL, NULL);
      return false;
    }

    if (segmentLen > SIZE_MAX - 1U) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    char *segment = (char *)malloc(segmentLen + 1U);
    if (segment == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    memcpy(segment, cursor, segmentLen);
    segment[segmentLen] = '\0';

    int nextTok =
        jsmn_find_object_key(json, tokens, currentTok, segment, tokenCount);
    free(segment);

    if (nextTok < 0 || nextTok >= tokenCount) {
      write_error_json_ex("invalid_args", "Reference path is missing property",
                          label, NULL, NULL, NULL);
      return false;
    }

    currentTok = nextTok;
    if (dot == NULL) {
      break;
    }

    cursor = dot + 1;
  }

  *outTok = currentTok;
  return true;
}

static bool resolve_step_fn(const char *json,
                            const jsmntok_t *tokens,
                            int tokenCount,
                            int fnTok,
                            int argsTok,
                            const char *label,
                            char **outFn) {
  if (fnTok < 0 || fnTok >= tokenCount || tokens[fnTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "workflow call step fn must be a non-empty string",
                        label, NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!duplicate_json_string_or_error(json, &tokens[fnTok], &expr)) {
    return false;
  }

  if (string_is_blank(expr)) {
    free(expr);
    write_error_json_ex("invalid_request",
                        "workflow call step fn must be a non-empty string",
                        label, NULL, NULL, NULL);
    return false;
  }

  if (strcmp(expr, "$args") == 0 || strncmp(expr, "$args.", 6) == 0) {
    if (argsTok < 0 || argsTok >= tokenCount) {
      write_error_json_ex("invalid_args",
                          "workflow call fn references missing args object", label,
                          NULL, NULL, NULL);
      free(expr);
      return false;
    }

    const char *path = expr + 5;
    int resolvedTok = argsTok;
    if (path[0] == '.') {
      if (!resolve_object_path_token(json, tokens, tokenCount, argsTok, path + 1,
                                     label, &resolvedTok)) {
        free(expr);
        return false;
      }
    }

    free(expr);
    expr = NULL;

    if (resolvedTok < 0 || resolvedTok >= tokenCount ||
        tokens[resolvedTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "workflow call step fn must resolve to a non-empty string",
                          label, NULL, NULL, NULL);
      return false;
    }

    if (!duplicate_json_string_or_error(json, &tokens[resolvedTok], &expr)) {
      return false;
    }

    if (string_is_blank(expr)) {
      free(expr);
      write_error_json_ex("invalid_request",
                          "workflow call step fn must resolve to a non-empty string",
                          label, NULL, NULL, NULL);
      return false;
    }

    *outFn = expr;
    return true;
  }

  if (strcmp(expr, "$refs") == 0 || strncmp(expr, "$refs.", 6) == 0) {
    write_error_json_ex("invalid_request",
                        "workflow call fn references missing ref", label, NULL,
                        NULL, NULL);
    free(expr);
    return false;
  }

  *outFn = expr;
  return true;
}

static bool build_call_id(const char *manifestId,
                          int stepIndex,
                          char **outCallId) {
  char stepIndexBuf[32];
  snprintf(stepIndexBuf, sizeof(stepIndexBuf), "%d", stepIndex + 1);

  const size_t manifestLen = strlen(manifestId);
  const size_t stepLen = strlen(stepIndexBuf);
  if (manifestLen > SIZE_MAX - stepLen - 3U) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  const size_t totalBytes = manifestLen + 2U + stepLen + 1U;
  char *callId = (char *)malloc(totalBytes);
  if (callId == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  snprintf(callId, totalBytes, "%s::%s", manifestId, stepIndexBuf);
  *outCallId = callId;
  return true;
}

bool execute_canonical_workflow_request(const char *json,
                                        const jsmntok_t *tokens,
                                        const int tokenCount) {
  int manifestTok = jsmn_find_object_key(json, tokens, 0, "manifest", tokenCount);
  if (manifestTok < 0 || manifestTok >= tokenCount ||
      tokens[manifestTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "Missing required object: manifest",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char *manifestId = NULL;
  if (!duplicate_required_string_field(
          json, tokens, tokenCount, manifestTok, "id",
          "manifest.id must be a non-empty string", &manifestId)) {
    return false;
  }

  int manifestKindTok =
      jsmn_find_object_key(json, tokens, manifestTok, "kind", tokenCount);
  if (manifestKindTok < 0 || manifestKindTok >= tokenCount ||
      tokens[manifestKindTok].type != JSMN_STRING ||
      !jsmn_token_streq(json, &tokens[manifestKindTok], "method")) {
    free(manifestId);
    write_error_json_ex("invalid_request",
                        "manifest.kind must be \"method\"", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  int workflowTok = jsmn_find_object_key(json, tokens, 0, "workflow", tokenCount);
  if (workflowTok < 0 || workflowTok >= tokenCount ||
      tokens[workflowTok].type != JSMN_OBJECT) {
    free(manifestId);
    write_error_json_ex("invalid_request", "Missing required object: workflow",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int stepsTok =
      jsmn_find_object_key(json, tokens, workflowTok, "steps", tokenCount);
  if (stepsTok < 0 || stepsTok >= tokenCount || tokens[stepsTok].type != JSMN_ARRAY ||
      tokens[stepsTok].size <= 0) {
    free(manifestId);
    write_error_json_ex("invalid_request",
                        "workflow.steps must be a non-empty array", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  int argsTok = jsmn_find_object_key(json, tokens, 0, "args", tokenCount);

  for (int stepIndex = 0; stepIndex < tokens[stepsTok].size; stepIndex++) {
    int stepTok = jsmn_get_array_elem(tokens, stepsTok, stepIndex, tokenCount);
    if (stepTok < 0 || stepTok >= tokenCount ||
        tokens[stepTok].type != JSMN_OBJECT) {
      free(manifestId);
      write_error_json_ex("invalid_request", "workflow step must be an object",
                          NULL, NULL, NULL, NULL);
      return false;
    }

    int opTok = jsmn_find_object_key(json, tokens, stepTok, "op", tokenCount);
    if (opTok < 0 || opTok >= tokenCount || tokens[opTok].type != JSMN_STRING ||
        !jsmn_token_streq(json, &tokens[opTok], "call")) {
      free(manifestId);
      write_error_json_ex("invalid_request",
                          "workflow step op must be \"call\"", NULL, NULL,
                          NULL, NULL);
      return false;
    }

    int fnTok = jsmn_find_object_key(json, tokens, stepTok, "fn", tokenCount);
    int inTok = jsmn_find_object_key(json, tokens, stepTok, "in", tokenCount);
    if (fnTok < 0 || inTok < 0 || inTok >= tokenCount) {
      free(manifestId);
      write_error_json_ex("invalid_request",
                          "workflow call step requires fn and in", NULL, NULL,
                          NULL, NULL);
      return false;
    }

    char label[64];
    snprintf(label, sizeof(label), "workflow.steps[%d].fn", stepIndex);

    char *resolvedFn = NULL;
    if (!resolve_step_fn(json, tokens, tokenCount, fnTok, argsTok, label,
                         &resolvedFn)) {
      free(manifestId);
      return false;
    }

    char *callId = NULL;
    if (!build_call_id(manifestId, stepIndex, &callId)) {
      free(resolvedFn);
      free(manifestId);
      return false;
    }

    CspiceGeneratedDispatchRequest request = {
        .lane = "cspice",
        .callId = callId,
        .fn = resolvedFn,
        .json = json,
        .tokens = tokens,
        .tokenCount = tokenCount,
        .inputTok = inTok,
    };

    bool ok = handoff_to_generated_dispatch_seam(&request);
    free(callId);
    free(resolvedFn);

    if (!ok) {
      free(manifestId);
      return false;
    }
  }

  free(manifestId);
  return true;
}
