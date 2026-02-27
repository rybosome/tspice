#ifndef CSPICE_RUNNER_V2_REFS_H
#define CSPICE_RUNNER_V2_REFS_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"

#define V2_MAX_REFS 64

typedef enum {
  V2_REF_NONE = 0,
  V2_REF_INT,
  V2_REF_CELL,
  V2_REF_WINDOW,
} V2RefType;

typedef struct {
  char *name;
  V2RefType type;
  SpiceInt intValue;
  SpiceCell cell;
  void *storage;
} V2RefEntry;

bool v2_parse_int_token_or_error(const char *json, const jsmntok_t *tok,
                                 SpiceInt *out, const char *label);
bool v2_parse_ref_name(const char *expr, const char *prefix,
                       const char **outName);
int v2_find_ref_index(const V2RefEntry *refs, int refCount, const char *name);
int v2_find_free_ref_slot(const V2RefEntry *refs, int refCount);
void v2_free_ref_entry(V2RefEntry *entry);
void v2_free_all_refs(V2RefEntry *refs, int refCount);
bool v2_add_ref_cell(V2RefEntry *refs, int *refCount, const char *name,
                     V2RefType type, const SpiceCell *cell, void *storage);
bool v2_add_ref_int(V2RefEntry *refs, int *refCount, const char *name,
                    SpiceInt value);
bool v2_resolve_spiceint_expr(const char *json, const jsmntok_t *tokens,
                              int tokenCount, int exprTok, int argsTok,
                              const V2RefEntry *refs, int refCount,
                              const char *label, SpiceInt *out);
bool v2_resolve_cell_ref(const char *json, const jsmntok_t *tokens,
                         int tokenCount, int tokenIndex,
                         V2RefEntry *refs, int refCount,
                         const char *label, int *outRefIndex);
bool v2_resolve_window_ref(const char *json, const jsmntok_t *tokens,
                           int tokenCount, int tokenIndex,
                           V2RefEntry *refs, int refCount,
                           const char *label, int *outRefIndex);
bool v2_resolve_cell_or_window_ref(const char *json, const jsmntok_t *tokens,
                                   int tokenCount, int tokenIndex,
                                   V2RefEntry *refs, int refCount,
                                   const char *label, int *outRefIndex);

#endif
