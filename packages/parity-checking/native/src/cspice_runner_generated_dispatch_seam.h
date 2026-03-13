#ifndef CSPICE_RUNNER_GENERATED_DISPATCH_SEAM_H
#define CSPICE_RUNNER_GENERATED_DISPATCH_SEAM_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"

typedef struct {
  const char *lane;
  const char *callId;
  const char *fn;
  const char *json;
  const jsmntok_t *tokens;
  int tokenCount;
  int inputTok;
} CspiceGeneratedDispatchRequest;

bool handoff_to_generated_dispatch_seam(
    const CspiceGeneratedDispatchRequest *request);

#endif
