#include "cspice_runner_generated_dispatch_seam.h"

#include "cspice_runner_error.h"
#include "cspice_runner_json_emit.h"

typedef bool (*CspiceGeneratedDispatchNativeInvoker)(
    const CspiceGeneratedDispatchRequest *request);

static bool write_invalid_request(const char *message, const char *detail) {
  write_error_json_ex("invalid_request", message, detail, NULL, NULL, NULL);
  return false;
}

static bool write_invalid_args(const char *message, const char *detail) {
  write_error_json_ex("invalid_args", message, detail, NULL, NULL, NULL);
  return false;
}

static bool resolve_input_array_tokens(const CspiceGeneratedDispatchRequest *request,
                                       int expectedLen,
                                       int *outValueTokens) {
  if (request->inputTok < 0 || request->inputTok >= request->tokenCount) {
    return write_invalid_request("generated dispatch input token is out of bounds",
                                 request->fn);
  }

  if (request->tokens[request->inputTok].type != JSMN_ARRAY) {
    return write_invalid_args("generated dispatch input must resolve to an array",
                              request->fn);
  }

  if (request->tokens[request->inputTok].size != expectedLen) {
    char detail[256];
    snprintf(detail, sizeof(detail), "%s expected %d args but got %d", request->fn,
             expectedLen, request->tokens[request->inputTok].size);
    return write_invalid_args(
        "generated dispatch input argument count mismatch", detail);
  }

  for (int i = 0; i < expectedLen; i++) {
    const int valueTok = jsmn_get_array_elem(request->tokens, request->inputTok,
                                             i, request->tokenCount);
    if (valueTok < 0 || valueTok >= request->tokenCount) {
      return write_invalid_request(
          "generated dispatch input array element token is out of bounds",
          request->fn);
    }

    outValueTokens[i] = valueTok;
  }

  return true;
}

static bool parse_vec3_arg(const CspiceGeneratedDispatchRequest *request,
                           int valueTok,
                           SpiceDouble out[3],
                           const char *detailLabel) {
  if (!jsmn_parse_vec3(request->json, (jsmntok_t *)request->tokens, valueTok,
                       request->tokenCount, out)) {
    return write_invalid_args(
        "generated dispatch expected a vec3 numeric array argument",
        detailLabel);
  }

  return true;
}

static bool parse_string_arg(const CspiceGeneratedDispatchRequest *request,
                             int valueTok,
                             char **out,
                             const char *detailLabel) {
  if (valueTok < 0 || valueTok >= request->tokenCount) {
    return write_invalid_request(
        "generated dispatch string argument token is out of bounds",
        request->fn);
  }

  if (request->tokens[valueTok].type != JSMN_STRING) {
    return write_invalid_args("generated dispatch expected a string argument",
                              detailLabel);
  }

  char detail[256];
  detail[0] = '\0';

  jsmn_strdup_err_t err =
      jsmn_strdup(request->json, &request->tokens[valueTok], out, detail,
                  sizeof(detail));

  if (err == JSMN_STRDUP_OK) {
    return true;
  }

  if (err == JSMN_STRDUP_INVALID) {
    return write_invalid_request(
        "generated dispatch string argument has invalid JSON escape",
        detail[0] ? detail : detailLabel);
  }

  write_error_json("Out of memory", NULL, NULL, NULL);
  return false;
}

static bool write_spice_error(const char *message) {
  char shortMsg[1841];
  char longMsg[1841];
  char traceMsg[1841];
  capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                      traceMsg, sizeof(traceMsg));
  write_error_json(message, shortMsg, longMsg, traceMsg);
  reset_c();
  return false;
}

static bool write_ok_double_result(SpiceDouble value) {
  fputs("{\"ok\":true,\"result\":", stdout);
  fprintf(stdout, "%.17g", (double)value);
  fputs("}\n", stdout);
  return true;
}

static bool write_ok_vec3_result(const SpiceDouble value[3]) {
  fputs("{\"ok\":true,\"result\":", stdout);
  json_print_double_array(value, 3);
  fputs("}\n", stdout);
  return true;
}

static bool generated_dispatch_coords_vectors_vdot(
    const CspiceGeneratedDispatchRequest *request) {
  int argTokens[2];
  if (!resolve_input_array_tokens(request, 2, argTokens)) {
    return false;
  }

  SpiceDouble v1[3];
  SpiceDouble v2[3];

  if (!parse_vec3_arg(request, argTokens[0], v1,
                      "coords-vectors.vdot arg0 must be vec3")) {
    return false;
  }

  if (!parse_vec3_arg(request, argTokens[1], v2,
                      "coords-vectors.vdot arg1 must be vec3")) {
    return false;
  }

  const SpiceDouble dot = vdot_c(v1, v2);

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in coords-vectors.vdot generated dispatch");
  }

  return write_ok_double_result(dot);
}

static bool generated_dispatch_coords_vectors_vadd(
    const CspiceGeneratedDispatchRequest *request) {
  int argTokens[2];
  if (!resolve_input_array_tokens(request, 2, argTokens)) {
    return false;
  }

  SpiceDouble v1[3];
  SpiceDouble v2[3];
  SpiceDouble sum[3];

  if (!parse_vec3_arg(request, argTokens[0], v1,
                      "coords-vectors.vadd arg0 must be vec3")) {
    return false;
  }

  if (!parse_vec3_arg(request, argTokens[1], v2,
                      "coords-vectors.vadd arg1 must be vec3")) {
    return false;
  }

  vadd_c(v1, v2, sum);

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in coords-vectors.vadd generated dispatch");
  }

  return write_ok_vec3_result(sum);
}

static bool generated_dispatch_time_str2et(
    const CspiceGeneratedDispatchRequest *request) {
  int argTokens[1];
  if (!resolve_input_array_tokens(request, 1, argTokens)) {
    return false;
  }

  char *utc = NULL;
  if (!parse_string_arg(request, argTokens[0], &utc,
                        "time.str2et utc must be string")) {
    return false;
  }

  SpiceDouble et = 0.0;
  str2et_c(utc, &et);
  free(utc);

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in time.str2et generated dispatch");
  }

  return write_ok_double_result(et);
}

static CspiceGeneratedDispatchNativeInvoker resolve_native_handler(
    const char *nativeHandler) {
  if (nativeHandler == NULL || nativeHandler[0] == '\0') {
    return NULL;
  }

  if (strcmp(nativeHandler, "generated_dispatch_coords_vectors_vadd") == 0) {
    return generated_dispatch_coords_vectors_vadd;
  }

  if (strcmp(nativeHandler, "generated_dispatch_coords_vectors_vdot") == 0) {
    return generated_dispatch_coords_vectors_vdot;
  }

  if (strcmp(nativeHandler, "generated_dispatch_time_str2et") == 0) {
    return generated_dispatch_time_str2et;
  }

  return NULL;
}

bool handoff_to_generated_dispatch_seam(
    const CspiceGeneratedDispatchRequest *request) {
  if (request == NULL || request->callId == NULL || request->callId[0] == '\0' ||
      request->fn == NULL || request->fn[0] == '\0') {
    write_error_json_ex(
        "invalid_request",
        "generated dispatch handoff request is missing required fields", NULL,
        NULL, NULL, NULL);
    return false;
  }

  const char *lane = request->lane;
  if (lane == NULL || lane[0] == '\0') {
    lane = "cspice";
  }

  const CspiceGeneratedDispatchTableEntry *entry =
      cspice_generated_dispatch_lookup(request->fn);

  if (entry != NULL && entry->implemented && entry->nativeHandler != NULL &&
      entry->nativeHandler[0] != '\0') {
    const CspiceGeneratedDispatchNativeInvoker invoker =
        resolve_native_handler(entry->nativeHandler);

    if (invoker == NULL) {
      return write_invalid_request(
          "generated dispatch native handler is not registered",
          entry->nativeHandler);
    }

    return invoker(request);
  }

  write_generated_dispatch_unavailable_json(lane, request->callId, request->fn,
                                            entry != NULL);
  return false;
}
