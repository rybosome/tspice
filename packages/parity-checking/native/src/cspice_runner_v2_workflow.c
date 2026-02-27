#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_alloc_steps.h"
#include "cspice_runner_v2_spice_call.h"
#include "cspice_runner_v2_json_buffer.h"
#include "cspice_runner_v2_workflow.h"

bool v2_dispatch_workflow_step(
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

bool v2_execute_workflow_request(const char *json, const jsmntok_t *tokens,
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