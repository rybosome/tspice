#ifndef CSPICE_RUNNER_V2_JSON_BUFFER_H
#define CSPICE_RUNNER_V2_JSON_BUFFER_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"

typedef struct {
  char *data;
  size_t len;
  size_t cap;
} V2JsonBuffer;

void v2_json_buffer_init(V2JsonBuffer *buf);
void v2_json_buffer_free(V2JsonBuffer *buf);
bool v2_json_buffer_reserve(V2JsonBuffer *buf, size_t extraBytes);
bool v2_json_buffer_append_bytes(V2JsonBuffer *buf, const char *src,
                                 size_t srcLen);
bool v2_json_buffer_append_cstr(V2JsonBuffer *buf, const char *src);
bool v2_json_buffer_append_char(V2JsonBuffer *buf, char c);
bool v2_json_buffer_append_int(V2JsonBuffer *buf, SpiceInt value);
bool v2_json_buffer_append_escaped(V2JsonBuffer *buf, const char *s);

bool v2_append_project_value_json(V2JsonBuffer *out, const char *json,
                                  const jsmntok_t *tokens,
                                  int tokenCount, int valueTok, int argsTok,
                                  const V2RefEntry *refs,
                                  int refCount);
bool v2_materialize_project_result_object_json(
    const char *json, const jsmntok_t *tokens, int tokenCount,
    int outTok, int argsTok, const V2RefEntry *refs,
    int refCount, char **outJsonObject);

#endif
