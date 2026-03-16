#ifndef CSPICE_RUNNER_GENERATED_DISPATCH_TABLE_H
#define CSPICE_RUNNER_GENERATED_DISPATCH_TABLE_H

#include "cspice_runner_common.h"

typedef enum {
  CSPICE_GEN_DISPATCH_BEHAVIOR_INPUT_MAPPING_SCALAR_OUTPUT = 0,
  CSPICE_GEN_DISPATCH_BEHAVIOR_OUT_PARAMS_STRUCTURED_PAYLOAD = 1,
  CSPICE_GEN_DISPATCH_BEHAVIOR_INTEGER_RETURN_SPLIT = 2,
  CSPICE_GEN_DISPATCH_BEHAVIOR_COMPLEX_RETURN_FORM = 3,
  CSPICE_GEN_DISPATCH_BEHAVIOR_STRING_BUFFER_BOUNDS = 4,
} CspiceGeneratedDispatchBehaviorClass;

typedef struct {
  const char *fn;
  bool implemented;
  CspiceGeneratedDispatchBehaviorClass behaviorClass;
} CspiceGeneratedDispatchTableEntry;

extern const CspiceGeneratedDispatchTableEntry CSPICE_GENERATED_DISPATCH_TABLE[];
extern const size_t CSPICE_GENERATED_DISPATCH_TABLE_COUNT;

const CspiceGeneratedDispatchTableEntry *cspice_generated_dispatch_lookup(const char *fn);

#endif
