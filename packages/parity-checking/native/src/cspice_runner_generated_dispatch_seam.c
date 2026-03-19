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

static bool parse_double_arg(const CspiceGeneratedDispatchRequest *request,
                             int valueTok,
                             SpiceDouble *out,
                             const char *detailLabel) {
  if (jsmn_parse_double(request->json, &request->tokens[valueTok], out) !=
      PARSE_OK) {
    return write_invalid_args("generated dispatch expected a numeric argument",
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
        "generated dispatch input token is out of bounds", detailLabel);
  }

  if (request->tokens[valueTok].type != JSMN_STRING) {
    return write_invalid_args("generated dispatch expected a string argument",
                              detailLabel);
  }

  char detail[256];
  detail[0] = '\0';

  const jsmn_strdup_err_t duplicateStatus =
      jsmn_strdup(request->json, &request->tokens[valueTok], out, detail,
                  sizeof(detail));

  if (duplicateStatus == JSMN_STRDUP_OK) {
    return true;
  }

  if (duplicateStatus == JSMN_STRDUP_INVALID) {
    write_error_json_ex("invalid_request", "Invalid JSON string escape",
                        detail[0] != '\0' ? detail : detailLabel, NULL, NULL,
                        NULL);
    return false;
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
                        "time.str2et arg0 must be string")) {
    return false;
  }

  SpiceDouble et = 0.0;
  str2et_c(utc, &et);
  free(utc);
  utc = NULL;

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in time.str2et generated dispatch");
  }

  return write_ok_double_result(et);
}

static bool generated_dispatch_time_tparse(
    const CspiceGeneratedDispatchRequest *request) {
  int argTokens[1];
  if (!resolve_input_array_tokens(request, 1, argTokens)) {
    return false;
  }

  char *timstr = NULL;
  if (!parse_string_arg(request, argTokens[0], &timstr,
                        "time.tparse arg0 must be string")) {
    return false;
  }

  SpiceDouble et = 0.0;
  SpiceChar errmsg[2048];
  errmsg[0] = '\0';

  tparse_c(timstr, (SpiceInt)sizeof(errmsg), &et, errmsg);
  free(timstr);
  timstr = NULL;

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in time.tparse generated dispatch");
  }

  if (errmsg[0] != '\0') {
    return write_invalid_args(
        "generated dispatch time.tparse could not parse input", errmsg);
  }

  return write_ok_double_result(et);
}

static bool generated_dispatch_time_deltet(
    const CspiceGeneratedDispatchRequest *request) {
  int argTokens[2];
  if (!resolve_input_array_tokens(request, 2, argTokens)) {
    return false;
  }

  SpiceDouble epoch = 0.0;
  if (!parse_double_arg(request, argTokens[0], &epoch,
                        "time.deltet arg0 must be number")) {
    return false;
  }

  char *eptype = NULL;
  if (!parse_string_arg(request, argTokens[1], &eptype,
                        "time.deltet arg1 must be string")) {
    return false;
  }

  SpiceDouble delta = 0.0;
  deltet_c(epoch, eptype, &delta);
  free(eptype);
  eptype = NULL;

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in time.deltet generated dispatch");
  }

  return write_ok_double_result(delta);
}

static bool generated_dispatch_time_unitim(
    const CspiceGeneratedDispatchRequest *request) {
  int argTokens[3];
  if (!resolve_input_array_tokens(request, 3, argTokens)) {
    return false;
  }

  SpiceDouble epoch = 0.0;
  if (!parse_double_arg(request, argTokens[0], &epoch,
                        "time.unitim arg0 must be number")) {
    return false;
  }

  char *insys = NULL;
  if (!parse_string_arg(request, argTokens[1], &insys,
                        "time.unitim arg1 must be string")) {
    return false;
  }

  char *outsys = NULL;
  if (!parse_string_arg(request, argTokens[2], &outsys,
                        "time.unitim arg2 must be string")) {
    free(insys);
    return false;
  }

  const SpiceDouble converted = unitim_c(epoch, insys, outsys);
  free(insys);
  insys = NULL;
  free(outsys);
  outsys = NULL;

  if (failed_c() == SPICETRUE) {
    return write_spice_error("SPICE error in time.unitim generated dispatch");
  }

  return write_ok_double_result(converted);
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

  if (strcmp(nativeHandler, "generated_dispatch_time_deltet") == 0) {
    return generated_dispatch_time_deltet;
  }

  if (strcmp(nativeHandler, "generated_dispatch_time_str2et") == 0) {
    return generated_dispatch_time_str2et;
  }

  if (strcmp(nativeHandler, "generated_dispatch_time_tparse") == 0) {
    return generated_dispatch_time_tparse;
  }

  if (strcmp(nativeHandler, "generated_dispatch_time_unitim") == 0) {
    return generated_dispatch_time_unitim;
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
