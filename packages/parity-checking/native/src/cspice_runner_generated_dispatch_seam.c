#include "cspice_runner_generated_dispatch_seam.h"
#include "cspice_runner_json_emit.h"

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

  // Reserved for future generated-dispatch handoff payload usage.
  (void)request->json;
  (void)request->tokens;
  (void)request->tokenCount;
  (void)request->inputTok;

  write_generated_dispatch_unavailable_json(lane, request->callId, request->fn);
  return false;
}
