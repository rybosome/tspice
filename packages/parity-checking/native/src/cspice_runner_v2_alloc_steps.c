#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_alloc_steps.h"

bool v2_execute_alloc_cell_step(const char *json, const jsmntok_t *tokens,
                                       const int tokenCount, const int stepTok,
                                       const int argsTok, V2RefEntry *refs,
                                       int *refCount) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  int paramsTok =
      jsmn_find_object_key(json, tokens, stepTok, "params", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING || paramsTok < 0 ||
      tokens[paramsTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "allocCell requires string 'as' and object 'params'",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char asDetail[256];
  asDetail[0] = '\0';
  char *asName = NULL;
  jsmn_strdup_err_t asErr =
      jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
  if (asErr != JSMN_STRDUP_OK) {
    if (asErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  int kindTok = jsmn_find_object_key(json, tokens, paramsTok, "kind", tokenCount);
  int sizeTok = jsmn_find_object_key(json, tokens, paramsTok, "size", tokenCount);
  if (kindTok < 0 || tokens[kindTok].type != JSMN_STRING || sizeTok < 0) {
    write_error_json_ex("invalid_request",
                        "allocCell.params requires string kind and size", NULL,
                        NULL, NULL, NULL);
    free(asName);
    return false;
  }

  SpiceInt size = 0;
  if (!v2_resolve_spiceint_expr(json, tokens, tokenCount, sizeTok, argsTok, refs,
                                *refCount, "allocCell.params.size", &size)) {
    free(asName);
    return false;
  }

  if (size < 0) {
    write_error_json_ex("invalid_args", "allocCell.params.size must be >= 0", NULL,
                        NULL, NULL, NULL);
    free(asName);
    return false;
  }

  void *storage = NULL;
  SpiceCell cell;
  memset(&cell, 0, sizeof(cell));

  if (jsmn_token_streq(json, &tokens[kindTok], "int")) {
    size_t cellSize = (size_t)size;
    if (cellSize > (SIZE_MAX / sizeof(SpiceInt)) - (size_t)SPICE_CELL_CTRLSZ) {
      write_error_json_ex("invalid_args", "allocCell.params.size is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t elemCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
    SpiceInt *intStorage = (SpiceInt *)calloc(elemCount, sizeof(SpiceInt));
    if (intStorage == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(asName);
      return false;
    }

    storage = intStorage;
    cell.dtype = SPICE_INT;
    cell.length = 0;
    cell.size = size;
    cell.card = 0;
    cell.isSet = SPICETRUE;
    cell.adjust = SPICEFALSE;
    cell.init = SPICEFALSE;
    cell.base = (void *)intStorage;
    cell.data = (void *)(intStorage + SPICE_CELL_CTRLSZ);
  } else if (jsmn_token_streq(json, &tokens[kindTok], "double")) {
    size_t cellSize = (size_t)size;
    if (cellSize > (SIZE_MAX / sizeof(SpiceDouble)) - (size_t)SPICE_CELL_CTRLSZ) {
      write_error_json_ex("invalid_args", "allocCell.params.size is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t elemCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
    SpiceDouble *doubleStorage =
        (SpiceDouble *)calloc(elemCount, sizeof(SpiceDouble));
    if (doubleStorage == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(asName);
      return false;
    }

    storage = doubleStorage;
    cell.dtype = SPICE_DP;
    cell.length = 0;
    cell.size = size;
    cell.card = 0;
    cell.isSet = SPICETRUE;
    cell.adjust = SPICEFALSE;
    cell.init = SPICEFALSE;
    cell.base = (void *)doubleStorage;
    cell.data = (void *)(doubleStorage + SPICE_CELL_CTRLSZ);
  } else if (jsmn_token_streq(json, &tokens[kindTok], "char")) {
    int lengthTok =
        jsmn_find_object_key(json, tokens, paramsTok, "length", tokenCount);
    if (lengthTok < 0) {
      write_error_json_ex("invalid_request",
                          "allocCell.params.kind=char requires length",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    SpiceInt length = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  lengthTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "allocCell.params.length",
                                  &length)) {
      free(asName);
      return false;
    }

    if (length < 1) {
      write_error_json_ex("invalid_args", "allocCell.params.length must be >= 1",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t cellSize = (size_t)size;
    const size_t charLength = (size_t)length;
    if (cellSize > SIZE_MAX - (size_t)SPICE_CELL_CTRLSZ) {
      write_error_json_ex("invalid_args", "allocCell.params.size is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t slotCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
    if (charLength > SIZE_MAX / slotCount) {
      write_error_json_ex("invalid_args",
                          "allocCell.params.length is too large",
                          NULL, NULL, NULL, NULL);
      free(asName);
      return false;
    }

    const size_t elemCount = slotCount * charLength;
    SpiceChar *charStorage = (SpiceChar *)calloc(elemCount, sizeof(SpiceChar));
    if (charStorage == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(asName);
      return false;
    }

    storage = charStorage;
    cell.dtype = SPICE_CHR;
    cell.length = length;
    cell.size = size;
    cell.card = 0;
    cell.isSet = SPICETRUE;
    cell.adjust = SPICEFALSE;
    cell.init = SPICEFALSE;
    cell.base = (void *)charStorage;
    cell.data = (void *)(charStorage + ((size_t)SPICE_CELL_CTRLSZ * charLength));
  } else {
    write_error_json_ex("unsupported_call", "Unsupported allocCell kind", NULL,
                        NULL, NULL, NULL);
    free(asName);
    return false;
  }

  ssize_c(size, &cell);
  scard_c(0, &cell);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json_ex("spice_error", "SPICE error in allocCell", NULL, shortMsg,
                        longMsg, traceMsg);
    free(storage);
    free(asName);
    return false;
  }

  bool ok = v2_add_ref_cell(refs, refCount, asName, V2_REF_CELL, &cell, storage);
  free(asName);
  if (!ok) {
    free(storage);
    return false;
  }

  return true;
}

bool v2_execute_alloc_window_step(const char *json,
                                         const jsmntok_t *tokens,
                                         const int tokenCount,
                                         const int stepTok,
                                         const int argsTok,
                                         V2RefEntry *refs,
                                         int *refCount) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  int paramsTok =
      jsmn_find_object_key(json, tokens, stepTok, "params", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING || paramsTok < 0 ||
      tokens[paramsTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "allocWindow requires string 'as' and object 'params'",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int maxIntervalsTok =
      jsmn_find_object_key(json, tokens, paramsTok, "maxIntervals", tokenCount);
  if (maxIntervalsTok < 0) {
    write_error_json_ex("invalid_request",
                        "allocWindow.params requires maxIntervals", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  SpiceInt maxIntervals = 0;
  if (!v2_resolve_spiceint_expr(json,
                                tokens,
                                tokenCount,
                                maxIntervalsTok,
                                argsTok,
                                refs,
                                *refCount,
                                "allocWindow.params.maxIntervals",
                                &maxIntervals)) {
    return false;
  }

  if (maxIntervals < 0) {
    write_error_json_ex("invalid_args",
                        "allocWindow.params.maxIntervals must be >= 0", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  if (maxIntervals > (SpiceInt)(INT_MAX / 2)) {
    write_error_json_ex("invalid_args",
                        "allocWindow.params.maxIntervals is too large", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const SpiceInt windowSize = maxIntervals * 2;
  const size_t cellSize = (size_t)windowSize;
  if (cellSize > (SIZE_MAX / sizeof(SpiceDouble)) - (size_t)SPICE_CELL_CTRLSZ) {
    write_error_json_ex("invalid_args", "allocWindow.params.maxIntervals is too large",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  const size_t elemCount = (size_t)SPICE_CELL_CTRLSZ + cellSize;
  SpiceDouble *storage = (SpiceDouble *)calloc(elemCount, sizeof(SpiceDouble));
  if (storage == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceCell window;
  memset(&window, 0, sizeof(window));
  window.dtype = SPICE_DP;
  window.length = 0;
  window.size = windowSize;
  window.card = 0;
  window.isSet = SPICETRUE;
  window.adjust = SPICEFALSE;
  window.init = SPICEFALSE;
  window.base = (void *)storage;
  window.data = (void *)(storage + SPICE_CELL_CTRLSZ);

  ssize_c(windowSize, &window);
  scard_c(0, &window);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json_ex("spice_error", "SPICE error in allocWindow", NULL,
                        shortMsg, longMsg, traceMsg);
    free(storage);
    return false;
  }

  char asDetail[256];
  asDetail[0] = '\0';
  char *asName = NULL;
  jsmn_strdup_err_t asErr =
      jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
  if (asErr != JSMN_STRDUP_OK) {
    if (asErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    free(storage);
    return false;
  }

  bool ok = v2_add_ref_cell(refs,
                            refCount,
                            asName,
                            V2_REF_WINDOW,
                            &window,
                            (void *)storage);
  free(asName);
  if (!ok) {
    free(storage);
    return false;
  }

  return true;
}

bool v2_execute_free_cell_step(const char *json, const jsmntok_t *tokens,
                                      const int tokenCount, const int stepTok,
                                      const int argsTok, V2RefEntry *refs,
                                      const int refCount) {
  int targetTok =
      jsmn_find_object_key(json, tokens, stepTok, "target", tokenCount);
  if (targetTok < 0) {
    write_error_json_ex("invalid_request", "freeCell requires target", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  int refIndex = -1;
  if (!v2_resolve_cell_ref(json, tokens, tokenCount, targetTok, refs, refCount,
                           "freeCell.target", &refIndex)) {
    return false;
  }

  (void)argsTok;

  v2_free_ref_entry(&refs[refIndex]);
  return true;
}

bool v2_execute_free_window_step(const char *json,
                                        const jsmntok_t *tokens,
                                        const int tokenCount,
                                        const int stepTok,
                                        const int argsTok,
                                        V2RefEntry *refs,
                                        const int refCount) {
  int targetTok =
      jsmn_find_object_key(json, tokens, stepTok, "target", tokenCount);
  if (targetTok < 0) {
    write_error_json_ex("invalid_request", "freeWindow requires target", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int refIndex = -1;
  if (!v2_resolve_window_ref(json,
                             tokens,
                             tokenCount,
                             targetTok,
                             refs,
                             refCount,
                             "freeWindow.target",
                             &refIndex)) {
    return false;
  }

  (void)argsTok;

  v2_free_ref_entry(&refs[refIndex]);
  return true;
}
