#ifndef CSPICE_RUNNER_GENERATED_DISPATCH_SEAM_H
#define CSPICE_RUNNER_GENERATED_DISPATCH_SEAM_H

#include "cspice_runner_common.h"
#include "cspice_runner_generated_dispatch_table.h"
#include "cspice_runner_json_core.h"

typedef struct {
  const char *lane;
  const char *callId;
  const char *fn;
  // Canonical request JSON + token context.
  // `inputTok` is the resolved call input token after workflow `$args` path
  // resolution (not a token-level workflow DSL expression).
  const char *json;
  const jsmntok_t *tokens;
  int tokenCount;
  int inputTok;
} CspiceGeneratedDispatchRequest;

bool handoff_to_generated_dispatch_seam(
    const CspiceGeneratedDispatchRequest *request);

#endif
