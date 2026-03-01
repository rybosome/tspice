#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_refs.h"

bool v2_parse_int_token_or_error(const char *json, const jsmntok_t *tok,
                                 SpiceInt *out, const char *label) {
  parse_result pr = jsmn_parse_int(json, tok, out);
  if (pr == PARSE_OK) {
    return true;
  }

  if (pr == PARSE_UNSUPPORTED) {
    write_unsupported_spiceint_width_error();
    return false;
  }

  char msg[256];
  switch (pr) {
  case PARSE_TOO_LONG:
    snprintf(msg, sizeof(msg), "%s is too long", label);
    break;
  case PARSE_OUT_OF_RANGE:
    snprintf(msg, sizeof(msg), "%s is out of range", label);
    break;
  case PARSE_INVALID:
  default:
    snprintf(msg, sizeof(msg), "%s must be an integer", label);
    break;
  }

  write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
  return false;
}

bool v2_parse_ref_name(const char *expr, const char *prefix,
                       const char **outName) {
  const size_t prefixLen = strlen(prefix);
  if (strncmp(expr, prefix, prefixLen) != 0) {
    return false;
  }

  const char *name = expr + prefixLen;
  if (name[0] == '\0') {
    return false;
  }

  *outName = name;
  return true;
}

static char *v2_strdup(const char *value) {
  if (value == NULL) {
    return NULL;
  }

  size_t len = strlen(value) + 1;
  char *copy = (char *)malloc(len);
  if (copy == NULL) {
    return NULL;
  }

  memcpy(copy, value, len);
  return copy;
}

int v2_find_ref_index(const V2RefEntry *refs, const int refCount,
                      const char *name) {
  for (int i = 0; i < refCount; i++) {
    if (refs[i].name != NULL && strcmp(refs[i].name, name) == 0) {
      return i;
    }
  }

  return -1;
}

int v2_find_free_ref_slot(const V2RefEntry *refs, const int refCount) {
  for (int i = 0; i < refCount; i++) {
    if (refs[i].name == NULL) {
      return i;
    }
  }

  return -1;
}

static bool v2_prepare_ref_slot(V2RefEntry *refs, int *refCount,
                                const char *name, V2RefEntry **outEntry) {
  if (v2_find_ref_index(refs, *refCount, name) >= 0) {
    write_error_json_ex("invalid_request", "Duplicate v2 ref name", name, NULL,
                        NULL, NULL);
    return false;
  }

  int slot = v2_find_free_ref_slot(refs, *refCount);
  if (slot < 0 && *refCount >= V2_MAX_REFS) {
    write_error_json_ex("invalid_request", "Too many v2 refs", NULL, NULL, NULL,
                        NULL);
    return false;
  }

  if (slot < 0) {
    slot = *refCount;
  }

  char *ownedName = v2_strdup(name);
  if (ownedName == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  V2RefEntry *entry = &refs[slot];
  memset(entry, 0, sizeof(*entry));
  entry->name = ownedName;

  if (slot == *refCount) {
    (*refCount)++;
  }

  *outEntry = entry;
  return true;
}

void v2_free_ref_entry(V2RefEntry *entry) {
  if (entry == NULL) {
    return;
  }

  if (entry->storage != NULL) {
    free(entry->storage);
    entry->storage = NULL;
  }

  free(entry->pathValue);
  entry->pathValue = NULL;

  free(entry->name);
  entry->name = NULL;

  memset(&entry->cell, 0, sizeof(entry->cell));
  memset(&entry->dlaDescrValue, 0, sizeof(entry->dlaDescrValue));
  memset(&entry->dskDescrValue, 0, sizeof(entry->dskDescrValue));
  entry->type = V2_REF_NONE;
  entry->intValue = 0;
  entry->handleValue = 0;
}

void v2_free_all_refs(V2RefEntry *refs, const int refCount) {
  for (int i = 0; i < refCount; i++) {
    v2_free_ref_entry(&refs[i]);
  }
}

bool v2_add_ref_cell(V2RefEntry *refs, int *refCount, const char *name,
                     const V2RefType type, const SpiceCell *cell,
                     void *storage) {
  V2RefEntry *entry = NULL;
  if (!v2_prepare_ref_slot(refs, refCount, name, &entry)) {
    return false;
  }

  entry->type = type;
  entry->cell = *cell;
  entry->storage = storage;
  return true;
}

bool v2_add_ref_int(V2RefEntry *refs, int *refCount, const char *name,
                    const SpiceInt value) {
  V2RefEntry *entry = NULL;
  if (!v2_prepare_ref_slot(refs, refCount, name, &entry)) {
    return false;
  }

  entry->type = V2_REF_INT;
  entry->intValue = value;
  return true;
}

bool v2_add_ref_path(V2RefEntry *refs, int *refCount, const char *name,
                     const char *value) {
  V2RefEntry *entry = NULL;
  if (!v2_prepare_ref_slot(refs, refCount, name, &entry)) {
    return false;
  }

  char *pathCopy = v2_strdup(value);
  if (pathCopy == NULL) {
    v2_free_ref_entry(entry);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  entry->type = V2_REF_PATH;
  entry->pathValue = pathCopy;
  return true;
}

bool v2_add_ref_das_handle(V2RefEntry *refs, int *refCount, const char *name,
                           SpiceInt handle) {
  V2RefEntry *entry = NULL;
  if (!v2_prepare_ref_slot(refs, refCount, name, &entry)) {
    return false;
  }

  entry->type = V2_REF_DAS_HANDLE;
  entry->handleValue = handle;
  return true;
}

bool v2_add_ref_dla_descr(V2RefEntry *refs, int *refCount, const char *name,
                          const SpiceDLADescr *descr) {
  V2RefEntry *entry = NULL;
  if (!v2_prepare_ref_slot(refs, refCount, name, &entry)) {
    return false;
  }

  entry->type = V2_REF_DLA_DESCR;
  entry->dlaDescrValue = *descr;
  return true;
}

bool v2_add_ref_dsk_descr(V2RefEntry *refs, int *refCount, const char *name,
                          const SpiceDSKDescr *descr) {
  V2RefEntry *entry = NULL;
  if (!v2_prepare_ref_slot(refs, refCount, name, &entry)) {
    return false;
  }

  entry->type = V2_REF_DSK_DESCR;
  entry->dskDescrValue = *descr;
  return true;
}

static bool v2_try_resolve_dla_descr_field(const SpiceDLADescr *descr,
                                           const char *field,
                                           SpiceInt *out) {
  if (strcmp(field, "bwdptr") == 0) {
    *out = descr->bwdptr;
    return true;
  }
  if (strcmp(field, "fwdptr") == 0) {
    *out = descr->fwdptr;
    return true;
  }
  if (strcmp(field, "ibase") == 0) {
    *out = descr->ibase;
    return true;
  }
  if (strcmp(field, "isize") == 0) {
    *out = descr->isize;
    return true;
  }
  if (strcmp(field, "dbase") == 0) {
    *out = descr->dbase;
    return true;
  }
  if (strcmp(field, "dsize") == 0) {
    *out = descr->dsize;
    return true;
  }
  if (strcmp(field, "cbase") == 0) {
    *out = descr->cbase;
    return true;
  }
  if (strcmp(field, "csize") == 0) {
    *out = descr->csize;
    return true;
  }

  return false;
}

static bool v2_try_resolve_dsk_descr_field(const SpiceDSKDescr *descr,
                                           const char *field,
                                           SpiceInt *out) {
  if (strcmp(field, "surfce") == 0) {
    *out = descr->surfce;
    return true;
  }
  if (strcmp(field, "center") == 0) {
    *out = descr->center;
    return true;
  }
  if (strcmp(field, "dclass") == 0) {
    *out = descr->dclass;
    return true;
  }
  if (strcmp(field, "dtype") == 0) {
    *out = descr->dtype;
    return true;
  }
  if (strcmp(field, "frmcde") == 0) {
    *out = descr->frmcde;
    return true;
  }
  if (strcmp(field, "corsys") == 0) {
    *out = descr->corsys;
    return true;
  }

  return false;
}

bool v2_resolve_spiceint_expr(const char *json, const jsmntok_t *tokens,
                              const int tokenCount, const int exprTok,
                              const int argsTok, const V2RefEntry *refs,
                              const int refCount, const char *label,
                              SpiceInt *out) {
  if (exprTok < 0 || exprTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Invalid v2 expression token", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[exprTok];
  if (tok->type == JSMN_PRIMITIVE) {
    return v2_parse_int_token_or_error(json, tok, out, label);
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must resolve to integer",
                        label, NULL, NULL, NULL);
    return false;
  }

  char exprDetail[256];
  exprDetail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, tok, &expr, exprDetail, sizeof(exprDetail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          exprDetail[0] ? exprDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *argName = NULL;
  const char *refNameExpr = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    bool ok = v2_parse_int_token_or_error(json, &tokens[valueTok], out, label);
    free(expr);
    return ok;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refNameExpr)) {
    char *field = NULL;
    char *mutableRefName = (char *)refNameExpr;
    char *dot = strchr(mutableRefName, '.');
    if (dot != NULL) {
      *dot = '\0';
      field = dot + 1;
      if (field[0] == '\0' || strchr(field, '.') != NULL) {
        write_error_json_ex("invalid_args", "Unsupported v2 integer expression",
                            expr, NULL, NULL, NULL);
        free(expr);
        return false;
      }
    }

    int refIndex = v2_find_ref_index(refs, refCount, mutableRefName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", mutableRefName,
                          NULL, NULL, NULL);
      free(expr);
      return false;
    }

    const V2RefEntry *entry = &refs[refIndex];
    if (field == NULL) {
      if (entry->type != V2_REF_INT) {
        write_error_json_ex("invalid_args", "v2 ref is not an integer",
                            mutableRefName, NULL, NULL, NULL);
        free(expr);
        return false;
      }

      *out = entry->intValue;
      free(expr);
      return true;
    }

    if (entry->type == V2_REF_DSK_DESCR) {
      if (!v2_try_resolve_dsk_descr_field(&entry->dskDescrValue, field, out)) {
        write_error_json_ex("invalid_args", "Unknown SpiceDSKDescr field", field,
                            NULL, NULL, NULL);
        free(expr);
        return false;
      }

      free(expr);
      return true;
    }

    if (entry->type == V2_REF_DLA_DESCR) {
      if (!v2_try_resolve_dla_descr_field(&entry->dlaDescrValue, field, out)) {
        write_error_json_ex("invalid_args", "Unknown SpiceDLADescr field", field,
                            NULL, NULL, NULL);
        free(expr);
        return false;
      }

      free(expr);
      return true;
    }

    write_error_json_ex("invalid_args", "v2 ref does not support integer fields",
                        mutableRefName, NULL, NULL, NULL);
    free(expr);
    return false;
  }

  write_error_json_ex("invalid_args", "Unsupported v2 integer expression", expr,
                      NULL, NULL, NULL);
  free(expr);
  return false;
}

static bool v2_resolve_ref_by_type(const char *json, const jsmntok_t *tokens,
                                   const int tokenCount, const int tokenIndex,
                                   V2RefEntry *refs, const int refCount,
                                   const char *label,
                                   const V2RefType expectedType,
                                   const char *invalidRefMessage,
                                   int *outRefIndex) {
  if (tokenIndex < 0 || tokenIndex >= tokenCount ||
      tokens[tokenIndex].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "Ref expression must be a string",
                        label, NULL, NULL, NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, &tokens[tokenIndex], &expr, detail, sizeof(detail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *refName = NULL;
  if (!v2_parse_ref_name(expr, "$refs.", &refName)) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  if (strchr(refName, '.') != NULL) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  int refIndex = v2_find_ref_index(refs, refCount, refName);
  if (refIndex < 0) {
    write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                        NULL, NULL);
    free(expr);
    return false;
  }

  if (refs[refIndex].type != expectedType) {
    write_error_json_ex("invalid_args", invalidRefMessage, refName, NULL, NULL,
                        NULL);
    free(expr);
    return false;
  }

  *outRefIndex = refIndex;
  free(expr);
  return true;
}

bool v2_resolve_cell_ref(const char *json, const jsmntok_t *tokens,
                         const int tokenCount, const int tokenIndex,
                         V2RefEntry *refs, const int refCount,
                         const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(json,
                                tokens,
                                tokenCount,
                                tokenIndex,
                                refs,
                                refCount,
                                label,
                                V2_REF_CELL,
                                "v2 ref is not an allocated cell",
                                outRefIndex);
}

bool v2_resolve_window_ref(const char *json, const jsmntok_t *tokens,
                           const int tokenCount, const int tokenIndex,
                           V2RefEntry *refs, const int refCount,
                           const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(json,
                                tokens,
                                tokenCount,
                                tokenIndex,
                                refs,
                                refCount,
                                label,
                                V2_REF_WINDOW,
                                "v2 ref is not an allocated window",
                                outRefIndex);
}

bool v2_resolve_path_ref(const char *json, const jsmntok_t *tokens,
                         const int tokenCount, const int tokenIndex,
                         V2RefEntry *refs, const int refCount,
                         const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(json,
                                tokens,
                                tokenCount,
                                tokenIndex,
                                refs,
                                refCount,
                                label,
                                V2_REF_PATH,
                                "v2 ref is not a path",
                                outRefIndex);
}

bool v2_resolve_das_handle_ref(const char *json, const jsmntok_t *tokens,
                               const int tokenCount, const int tokenIndex,
                               V2RefEntry *refs, const int refCount,
                               const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(json,
                                tokens,
                                tokenCount,
                                tokenIndex,
                                refs,
                                refCount,
                                label,
                                V2_REF_DAS_HANDLE,
                                "v2 ref is not a DAS handle",
                                outRefIndex);
}

bool v2_resolve_dla_descr_ref(const char *json, const jsmntok_t *tokens,
                              const int tokenCount, const int tokenIndex,
                              V2RefEntry *refs, const int refCount,
                              const char *label, int *outRefIndex) {
  return v2_resolve_ref_by_type(json,
                                tokens,
                                tokenCount,
                                tokenIndex,
                                refs,
                                refCount,
                                label,
                                V2_REF_DLA_DESCR,
                                "v2 ref is not a DLA descriptor",
                                outRefIndex);
}

bool v2_resolve_cell_or_window_ref(const char *json,
                                   const jsmntok_t *tokens,
                                   const int tokenCount,
                                   const int tokenIndex,
                                   V2RefEntry *refs,
                                   const int refCount,
                                   const char *label,
                                   int *outRefIndex) {
  if (tokenIndex < 0 || tokenIndex >= tokenCount ||
      tokens[tokenIndex].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "Ref expression must be a string",
                        label, NULL, NULL, NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, &tokens[tokenIndex], &expr, detail, sizeof(detail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *refName = NULL;
  if (!v2_parse_ref_name(expr, "$refs.", &refName)) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  if (strchr(refName, '.') != NULL) {
    write_error_json_ex("invalid_args", "Ref must use $refs.<name>", expr,
                        NULL, NULL, NULL);
    free(expr);
    return false;
  }

  int refIndex = v2_find_ref_index(refs, refCount, refName);
  if (refIndex < 0) {
    write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                        NULL, NULL);
    free(expr);
    return false;
  }

  if (refs[refIndex].type != V2_REF_CELL && refs[refIndex].type != V2_REF_WINDOW) {
    write_error_json_ex("invalid_args", "v2 ref is not an allocated cell/window",
                        refName, NULL, NULL, NULL);
    free(expr);
    return false;
  }

  *outRefIndex = refIndex;
  free(expr);
  return true;
}
