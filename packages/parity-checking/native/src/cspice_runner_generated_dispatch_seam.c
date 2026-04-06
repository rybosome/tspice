#include "cspice_runner_generated_dispatch_seam.h"

#include "cspice_runner_error.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_json_emit.h"

#include <limits.h>

#define DISPATCH_TIMDEF_MAX 1024
#define DISPATCH_ET2UTC_MAX 128
#define DISPATCH_KDATA_FIELD_MAX 1024
#define DISPATCH_GCPOOL_VALUE_MAX 1024
#define DISPATCH_EKGC_VALUE_MAX 4096

typedef struct {
  const generated_dispatch_request *request;
  int argsTok;
} dispatch_args;

static int write_invalid_args(const char *detail) {
  write_error_json_ex("invalid_args", "Invalid dispatch args", detail, NULL, NULL, NULL);
  return 1;
}

static int write_spice_failure(const char *callLabel) {
  char shortMsg[SPICE_SHORT_MSG_MAX] = {0};
  char longMsg[SPICE_LONG_MSG_MAX] = {0};
  char traceMsg[SPICE_TRACE_MSG_MAX] = {0};

  capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg, sizeof(traceMsg));
  write_error_json_ex("spice_error", "SPICE call failed", callLabel, shortMsg, longMsg, traceMsg);
  return 1;
}

static bool token_is_string(const generated_dispatch_request *request, int tokIndex) {
  if (tokIndex < 0 || tokIndex >= request->tokenCount) {
    return false;
  }
  return request->tokens[tokIndex].type == JSMN_STRING;
}

static int expect_args_array(dispatch_args *out, const generated_dispatch_request *request, int expectedArity, const char *callLabel) {
  if (request == NULL || request->tokens == NULL) {
    return write_invalid_args("dispatch request is missing token data");
  }

  if (request->inputTok < 0 || request->inputTok >= request->tokenCount) {
    return write_invalid_args("dispatch request input token is out of range");
  }

  const jsmntok_t *inputTok = &request->tokens[request->inputTok];
  if (inputTok->type != JSMN_ARRAY) {
    char detail[256];
    snprintf(detail, sizeof(detail), "%s expects args as an array", callLabel);
    return write_invalid_args(detail);
  }

  if (expectedArity >= 0 && inputTok->size != expectedArity) {
    char detail[256];
    snprintf(detail, sizeof(detail), "%s expects %d arg(s) (got %d)", callLabel, expectedArity, inputTok->size);
    return write_invalid_args(detail);
  }

  out->request = request;
  out->argsTok = request->inputTok;
  return 0;
}

static int args_size(const dispatch_args *args) {
  return args->request->tokens[args->argsTok].size;
}

static int args_elem_tok(const dispatch_args *args, int index) {
  return jsmn_get_array_elem(args->request->tokens, args->argsTok, index, args->request->tokenCount);
}

static int parse_string_arg(const dispatch_args *args, int index, const char *callLabel, char **out) {
  *out = NULL;

  const int tokIndex = args_elem_tok(args, index);
  if (!token_is_string(args->request, tokIndex)) {
    char detail[256];
    snprintf(detail, sizeof(detail), "%s expects args[%d] to be a string", callLabel, index);
    return write_invalid_args(detail);
  }

  char detail[256] = {0};
  jsmn_strdup_err_t dupRes =
      jsmn_strdup(args->request->json, &args->request->tokens[tokIndex], out, detail, sizeof(detail));

  if (dupRes == JSMN_STRDUP_OK) {
    return 0;
  }

  if (detail[0] == '\0') {
    snprintf(detail, sizeof(detail), "%s failed to decode args[%d] as UTF-8 string", callLabel, index);
  }
  return write_invalid_args(detail);
}

static int parse_int_arg(const dispatch_args *args, int index, const char *callLabel, SpiceInt *out) {
  const int tokIndex = args_elem_tok(args, index);
  if (tokIndex < 0 || tokIndex >= args->request->tokenCount) {
    return write_invalid_args("argument token index is out of range");
  }

  parse_result parseRes = jsmn_parse_int(args->request->json, &args->request->tokens[tokIndex], out);
  if (parseRes == PARSE_OK) {
    return 0;
  }

  char detail[256];
  snprintf(detail, sizeof(detail), "%s expects args[%d] to be a SpiceInt", callLabel, index);
  return write_invalid_args(detail);
}

static int parse_non_negative_int_arg(const dispatch_args *args, int index, const char *callLabel, SpiceInt *out) {
  int code = parse_int_arg(args, index, callLabel, out);
  if (code != 0) {
    return code;
  }

  if (*out < 0) {
    char detail[256];
    snprintf(detail, sizeof(detail), "%s expects args[%d] to be non-negative", callLabel, index);
    return write_invalid_args(detail);
  }

  return 0;
}

static int parse_double_arg(const dispatch_args *args, int index, const char *callLabel, SpiceDouble *out) {
  const int tokIndex = args_elem_tok(args, index);
  if (tokIndex < 0 || tokIndex >= args->request->tokenCount) {
    return write_invalid_args("argument token index is out of range");
  }

  parse_result parseRes = jsmn_parse_double(args->request->json, &args->request->tokens[tokIndex], out);
  if (parseRes == PARSE_OK) {
    return 0;
  }

  char detail[256];
  snprintf(detail, sizeof(detail), "%s expects args[%d] to be a finite number", callLabel, index);
  return write_invalid_args(detail);
}

static void json_print_string_value(const char *value) {
  fputc('"', stdout);
  json_print_escaped(value);
  fputc('"', stdout);
}

static int build_kind_query_from_token(const generated_dispatch_request *request,
                                       int tokIndex,
                                       char **outQuery) {
  *outQuery = NULL;

  if (tokIndex < 0 || tokIndex >= request->tokenCount) {
    return write_invalid_args("kind query token index is out of range");
  }

  const jsmntok_t *tok = &request->tokens[tokIndex];
  if (tok->type == JSMN_STRING) {
    char detail[256] = {0};
    jsmn_strdup_err_t dupRes =
        jsmn_strdup(request->json, tok, outQuery, detail, sizeof(detail));

    if (dupRes == JSMN_STRDUP_OK) {
      return 0;
    }

    if (detail[0] == '\0') {
      snprintf(detail, sizeof(detail), "kind query string decode failed");
    }
    return write_invalid_args(detail);
  }

  if (tok->type != JSMN_ARRAY) {
    return write_invalid_args("kind query must be string | string[]");
  }

  if (tok->size == 0) {
    return write_invalid_args("kind query string[] must not be empty");
  }

  char **parts = (char **)calloc((size_t)tok->size, sizeof(char *));
  if (parts == NULL) {
    return write_invalid_args("out of memory while parsing kind query");
  }

  size_t totalLen = 0;
  int status = 0;

  for (int i = 0; i < tok->size; i++) {
    const int elemTok = jsmn_get_array_elem(request->tokens, tokIndex, i, request->tokenCount);
    if (!token_is_string(request, elemTok)) {
      status = write_invalid_args("kind query string[] elements must be strings");
      goto cleanup;
    }

    char detail[256] = {0};
    if (jsmn_strdup(request->json, &request->tokens[elemTok], &parts[i], detail, sizeof(detail)) != JSMN_STRDUP_OK) {
      status = write_invalid_args(detail[0] ? detail : "kind query string decode failed");
      goto cleanup;
    }

    totalLen += strlen(parts[i]);
    if (i + 1 < tok->size) {
      totalLen += 1;
    }
  }

  char *joined = (char *)malloc(totalLen + 1);
  if (joined == NULL) {
    status = write_invalid_args("out of memory while joining kind query values");
    goto cleanup;
  }

  size_t offset = 0;
  for (int i = 0; i < tok->size; i++) {
    size_t len = strlen(parts[i]);
    memcpy(joined + offset, parts[i], len);
    offset += len;

    if (i + 1 < tok->size) {
      joined[offset++] = ' ';
    }
  }
  joined[offset] = '\0';

  *outQuery = joined;

cleanup:
  for (int i = 0; i < tok->size; i++) {
    free(parts[i]);
  }
  free(parts);
  return status;
}

static SpiceCell *allocate_window_cell(SpiceInt maxIntervals, char *detail, size_t detailBytes) {
  if (maxIntervals < 0) {
    snprintf(detail, detailBytes, "window recipe maxIntervals must be >= 0");
    return NULL;
  }

  if (maxIntervals > INT_MAX / 2) {
    snprintf(detail, detailBytes, "window recipe maxIntervals is too large");
    return NULL;
  }

  SpiceInt endpoints = maxIntervals * 2;

  SpiceCell *window = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (window == NULL) {
    snprintf(detail, detailBytes, "failed to allocate window descriptor");
    return NULL;
  }

  SpiceDouble *base =
      (SpiceDouble *)calloc((size_t)(SPICE_CELL_CTRLSZ + endpoints), sizeof(SpiceDouble));
  if (base == NULL) {
    free(window);
    snprintf(detail, detailBytes, "failed to allocate window storage");
    return NULL;
  }

  memset(window, 0, sizeof(*window));

  window->dtype = SPICE_DP;
  window->length = 0;
  window->size = endpoints;
  window->card = 0;
  window->isSet = SPICETRUE;
  window->adjust = SPICEFALSE;
  window->init = SPICEFALSE;
  window->base = (void *)base;
  window->data = (void *)(base + SPICE_CELL_CTRLSZ);

  ssize_c(endpoints, window);
  if (failed_c()) {
    free(base);
    free(window);
    snprintf(detail, detailBytes, "failed to initialize window size");
    return NULL;
  }

  scard_c(0, window);
  if (failed_c()) {
    free(base);
    free(window);
    snprintf(detail, detailBytes, "failed to initialize window cardinality");
    return NULL;
  }

  return window;
}

static void free_window_cell(SpiceCell *window) {
  if (window == NULL) {
    return;
  }

  free(window->base);
  free(window);
}

static int parse_window_recipe_arg(const dispatch_args *args,
                                   int index,
                                   const char *callLabel,
                                   SpiceInt *outMaxIntervals) {
  const int recipeTok = args_elem_tok(args, index);
  if (recipeTok < 0 || recipeTok >= args->request->tokenCount) {
    return write_invalid_args("window recipe token index is out of range");
  }

  const jsmntok_t *tok = &args->request->tokens[recipeTok];
  if (tok->type != JSMN_ARRAY || tok->size != 2) {
    char detail[256];
    snprintf(detail, sizeof(detail), "%s expects args[%d] to be [\"window\", maxIntervals]", callLabel, index);
    return write_invalid_args(detail);
  }

  const int tagTok = jsmn_get_array_elem(args->request->tokens, recipeTok, 0, args->request->tokenCount);
  if (!token_is_string(args->request, tagTok) ||
      !jsmn_token_streq(args->request->json, &args->request->tokens[tagTok], "window")) {
    return write_invalid_args("window recipe must start with string \"window\"");
  }

  const int maxTok = jsmn_get_array_elem(args->request->tokens, recipeTok, 1, args->request->tokenCount);
  if (maxTok < 0 || maxTok >= args->request->tokenCount) {
    return write_invalid_args("window recipe maxIntervals token is out of range");
  }

  parse_result parseRes =
      jsmn_parse_int(args->request->json, &args->request->tokens[maxTok], outMaxIntervals);

  if (parseRes != PARSE_OK) {
    return write_invalid_args("window recipe maxIntervals must be an integer");
  }

  if (*outMaxIntervals < 0) {
    return write_invalid_args("window recipe maxIntervals must be >= 0");
  }

  return 0;
}

static int build_terms_buffer(const generated_dispatch_request *request,
                              int termsTok,
                              char **outTerms,
                              SpiceInt *outTermlen,
                              SpiceInt *outNterms) {
  *outTerms = NULL;
  *outTermlen = 2;
  *outNterms = 0;

  if (termsTok < 0 || termsTok >= request->tokenCount) {
    return write_invalid_args("terms token index is out of range");
  }

  const jsmntok_t *tok = &request->tokens[termsTok];
  if (tok->type != JSMN_ARRAY) {
    return write_invalid_args("kxtrct args[1] must be string[]");
  }

  const SpiceInt nterms = (SpiceInt)tok->size;
  *outNterms = nterms;

  if (nterms <= 0) {
    return 0;
  }

  char **parts = (char **)calloc((size_t)nterms, sizeof(char *));
  if (parts == NULL) {
    return write_invalid_args("out of memory while parsing kxtrct terms");
  }

  SpiceInt termlen = 2;
  int status = 0;

  for (SpiceInt i = 0; i < nterms; i++) {
    const int elemTok = jsmn_get_array_elem(request->tokens, termsTok, (int)i, request->tokenCount);
    if (!token_is_string(request, elemTok)) {
      status = write_invalid_args("kxtrct args[1] elements must be strings");
      goto cleanup;
    }

    char detail[256] = {0};
    if (jsmn_strdup(request->json, &request->tokens[elemTok], &parts[i], detail, sizeof(detail)) != JSMN_STRDUP_OK) {
      status = write_invalid_args(detail[0] ? detail : "failed to decode kxtrct term");
      goto cleanup;
    }

    size_t len = strlen(parts[i]);
    if (len + 1 > (size_t)INT_MAX) {
      status = write_invalid_args("kxtrct term is too large");
      goto cleanup;
    }

    if ((SpiceInt)(len + 1) > termlen) {
      termlen = (SpiceInt)(len + 1);
    }
  }

  size_t totalBytes = (size_t)nterms * (size_t)termlen;
  char *buffer = (char *)calloc(totalBytes, sizeof(char));
  if (buffer == NULL) {
    status = write_invalid_args("out of memory while building kxtrct terms");
    goto cleanup;
  }

  for (SpiceInt i = 0; i < nterms; i++) {
    char *dst = buffer + ((size_t)i * (size_t)termlen);
    strncpy(dst, parts[i], (size_t)termlen - 1);
    dst[(size_t)termlen - 1] = '\0';
  }

  *outTerms = buffer;
  *outTermlen = termlen;

cleanup:
  for (SpiceInt i = 0; i < nterms; i++) {
    free(parts[i]);
  }
  free(parts);
  return status;
}

static int handle_time_str2et(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 1, "time.str2et");
  if (status != 0) {
    return status;
  }

  char *timeStr = NULL;
  status = parse_string_arg(&args, 0, "time.str2et", &timeStr);
  if (status != 0) {
    return status;
  }

  SpiceDouble et = 0.0;
  str2et_c(timeStr, &et);
  free(timeStr);

  if (failed_c()) {
    return write_spice_failure("time.str2et");
  }

  printf("{\"ok\":true,\"result\":%.17g}\n", (double)et);
  return 0;
}

static int handle_time_et2utc(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 3, "time.et2utc");
  if (status != 0) {
    return status;
  }

  SpiceDouble et = 0.0;
  SpiceInt prec = 0;
  char *format = NULL;

  status = parse_double_arg(&args, 0, "time.et2utc", &et);
  if (status != 0) return status;

  status = parse_string_arg(&args, 1, "time.et2utc", &format);
  if (status != 0) return status;

  status = parse_int_arg(&args, 2, "time.et2utc", &prec);
  if (status != 0) {
    free(format);
    return status;
  }

  char out[DISPATCH_ET2UTC_MAX] = {0};
  et2utc_c(et, format, prec, (SpiceInt)sizeof(out), out);
  free(format);

  if (failed_c()) {
    return write_spice_failure("time.et2utc");
  }

  printf("{\"ok\":true,\"result\":");
  json_print_string_value(out);
  fputs("}\n", stdout);
  return 0;
}

static int handle_time_timdef(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, -1, "time.timdef");
  if (status != 0) {
    return status;
  }

  const int arity = args_size(&args);
  if (arity != 2 && arity != 3) {
    return write_invalid_args("time.timdef expects 2 or 3 args");
  }

  char *action = NULL;
  char *item = NULL;

  status = parse_string_arg(&args, 0, "time.timdef", &action);
  if (status != 0) return status;

  status = parse_string_arg(&args, 1, "time.timdef", &item);
  if (status != 0) {
    free(action);
    return status;
  }

  if (strcmp(action, "GET") == 0) {
    if (arity != 2) {
      free(action);
      free(item);
      return write_invalid_args("time.timdef GET expects exactly 2 args");
    }

    char value[DISPATCH_TIMDEF_MAX] = {0};
    timdef_c("GET", item, (SpiceInt)sizeof(value), value);
    free(action);
    free(item);

    if (failed_c()) {
      return write_spice_failure("time.timdef(GET)");
    }

    printf("{\"ok\":true,\"result\":");
    json_print_string_value(value);
    fputs("}\n", stdout);
    return 0;
  }

  if (strcmp(action, "SET") == 0) {
    if (arity != 3) {
      free(action);
      free(item);
      return write_invalid_args("time.timdef SET expects exactly 3 args");
    }

    char *value = NULL;
    status = parse_string_arg(&args, 2, "time.timdef", &value);
    if (status != 0) {
      free(action);
      free(item);
      return status;
    }

    timdef_c("SET", item, (SpiceInt)(strlen(value) + 1), value);

    free(action);
    free(item);
    free(value);

    if (failed_c()) {
      return write_spice_failure("time.timdef(SET)");
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    return 0;
  }

  free(action);
  free(item);
  return write_invalid_args("time.timdef expects action to be GET or SET");
}

static int handle_ids_names_bodn2c(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 1, "ids-names.bodn2c");
  if (status != 0) {
    return status;
  }

  char *name = NULL;
  status = parse_string_arg(&args, 0, "ids-names.bodn2c", &name);
  if (status != 0) {
    return status;
  }

  SpiceInt code = 0;
  SpiceBoolean found = SPICEFALSE;
  bodn2c_c(name, &code, &found);
  free(name);

  if (failed_c()) {
    return write_spice_failure("ids-names.bodn2c");
  }

  if (found != SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
    return 0;
  }

  printf("{\"ok\":true,\"result\":{\"found\":true,\"value\":%" PRIdMAX "}}\n",
         (intmax_t)code);
  return 0;
}

static int handle_coords_vectors_mxm(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 2, "coords-vectors.mxm");
  if (status != 0) {
    return status;
  }

  const int leftTok = args_elem_tok(&args, 0);
  const int rightTok = args_elem_tok(&args, 1);

  SpiceDouble left[3][3];
  SpiceDouble right[3][3];

  if (!jsmn_parse_mat3_rowmajor(request->json, request->tokens, leftTok, request->tokenCount, left)) {
    return write_invalid_args("coords-vectors.mxm expects args[0] to be a row-major 3x3 matrix");
  }

  if (!jsmn_parse_mat3_rowmajor(request->json, request->tokens, rightTok, request->tokenCount, right)) {
    return write_invalid_args("coords-vectors.mxm expects args[1] to be a row-major 3x3 matrix");
  }

  SpiceDouble out[3][3];
  mxm_c(left, right, out);
  if (failed_c()) {
    return write_spice_failure("coords-vectors.mxm");
  }

  fputs("{\"ok\":true,\"result\":", stdout);
  json_print_mat3_rowmajor(out);
  fputs("}\n", stdout);
  return 0;
}

static int handle_coords_vectors_recgeo(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 3, "coords-vectors.recgeo");
  if (status != 0) {
    return status;
  }

  const int rectTok = args_elem_tok(&args, 0);
  SpiceDouble rect[3];
  if (!jsmn_parse_vec3(request->json, request->tokens, rectTok, request->tokenCount, rect)) {
    return write_invalid_args("coords-vectors.recgeo expects args[0] to be a length-3 vector");
  }

  SpiceDouble re = 0.0;
  SpiceDouble f = 0.0;

  status = parse_double_arg(&args, 1, "coords-vectors.recgeo", &re);
  if (status != 0) return status;

  status = parse_double_arg(&args, 2, "coords-vectors.recgeo", &f);
  if (status != 0) return status;

  SpiceDouble lon = 0.0;
  SpiceDouble lat = 0.0;
  SpiceDouble alt = 0.0;

  recgeo_c(rect, re, f, &lon, &lat, &alt);
  if (failed_c()) {
    return write_spice_failure("coords-vectors.recgeo");
  }

  printf("{\"ok\":true,\"result\":{\"lon\":%.17g,\"lat\":%.17g,\"alt\":%.17g}}\n",
         (double)lon,
         (double)lat,
         (double)alt);
  return 0;
}

static int handle_cells_windows_wninsd(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 3, "cells-windows.wninsd");
  if (status != 0) {
    return status;
  }

  SpiceDouble left = 0.0;
  SpiceDouble right = 0.0;

  status = parse_double_arg(&args, 0, "cells-windows.wninsd", &left);
  if (status != 0) return status;

  status = parse_double_arg(&args, 1, "cells-windows.wninsd", &right);
  if (status != 0) return status;

  SpiceInt maxIntervals = 0;
  status = parse_window_recipe_arg(&args, 2, "cells-windows.wninsd", &maxIntervals);
  if (status != 0) return status;

  char detail[256] = {0};
  SpiceCell *window = allocate_window_cell(maxIntervals, detail, sizeof(detail));
  if (window == NULL) {
    return write_invalid_args(detail);
  }

  window->init = SPICEFALSE;
  wninsd_c(left, right, window);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wninsd");
  }

  window->init = SPICEFALSE;
  SpiceInt card = wncard_c(window);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wncard");
  }

  SpiceDouble firstLeft = 0.0;
  SpiceDouble firstRight = 0.0;
  window->init = SPICEFALSE;
  wnfetd_c(window, 0, &firstLeft, &firstRight);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wnfetd");
  }

  free_window_cell(window);

  printf("{\"ok\":true,\"result\":{\"card\":%" PRIdMAX ",\"first\":[%.17g,%.17g]}}\n",
         (intmax_t)card,
         (double)firstLeft,
         (double)firstRight);
  return 0;
}

static int handle_cells_windows_wnfetd(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 2, "cells-windows.wnfetd");
  if (status != 0) {
    return status;
  }

  SpiceInt maxIntervals = 0;
  status = parse_window_recipe_arg(&args, 0, "cells-windows.wnfetd", &maxIntervals);
  if (status != 0) return status;

  SpiceInt index = 0;
  status = parse_int_arg(&args, 1, "cells-windows.wnfetd", &index);
  if (status != 0) return status;

  char detail[256] = {0};
  SpiceCell *window = allocate_window_cell(maxIntervals, detail, sizeof(detail));
  if (window == NULL) {
    return write_invalid_args(detail);
  }

  window->init = SPICEFALSE;
  wninsd_c(0.0, 1.0, window);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wninsd");
  }

  window->init = SPICEFALSE;
  wninsd_c(2.0, 3.0, window);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wninsd");
  }

  window->init = SPICEFALSE;
  wninsd_c(0.5, 2.5, window);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wninsd");
  }

  SpiceDouble left = 0.0;
  SpiceDouble right = 0.0;
  window->init = SPICEFALSE;
  wnfetd_c(window, index, &left, &right);
  if (failed_c()) {
    free_window_cell(window);
    return write_spice_failure("cells-windows.wnfetd");
  }

  free_window_cell(window);
  printf("{\"ok\":true,\"result\":[%.17g,%.17g]}\n", (double)left, (double)right);
  return 0;
}

static int handle_kernel_pool_gcpool(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 3, "kernel-pool.gcpool");
  if (status != 0) {
    return status;
  }

  char *name = NULL;
  status = parse_string_arg(&args, 0, "kernel-pool.gcpool", &name);
  if (status != 0) {
    return status;
  }

  SpiceInt start = 0;
  SpiceInt room = 0;

  status = parse_int_arg(&args, 1, "kernel-pool.gcpool", &start);
  if (status != 0) {
    free(name);
    return status;
  }

  status = parse_int_arg(&args, 2, "kernel-pool.gcpool", &room);
  if (status != 0) {
    free(name);
    return status;
  }

  if (start < 0) {
    free(name);
    return write_invalid_args("kernel-pool.gcpool expects args[1] >= 0");
  }

  if (room <= 0) {
    free(name);
    return write_invalid_args("kernel-pool.gcpool expects args[2] > 0");
  }

  SpiceChar (*values)[DISPATCH_GCPOOL_VALUE_MAX] =
      calloc((size_t)room, sizeof(*values));
  if (values == NULL) {
    free(name);
    return write_invalid_args("out of memory while allocating gcpool output");
  }

  SpiceInt count = 0;
  SpiceBoolean found = SPICEFALSE;
  gcpool_c(name,
           start,
           room,
           (SpiceInt)DISPATCH_GCPOOL_VALUE_MAX,
           &count,
           values,
           &found);

  free(name);

  if (failed_c()) {
    free(values);
    return write_spice_failure("kernel-pool.gcpool");
  }

  if (found != SPICETRUE) {
    free(values);
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
    return 0;
  }

  fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":[", stdout);
  for (SpiceInt i = 0; i < count; i++) {
    if (i > 0) {
      fputc(',', stdout);
    }
    trim_fixed_width_c_string_end(values[i], DISPATCH_GCPOOL_VALUE_MAX);
    json_print_string_value(values[i]);
  }
  fputs("]}}\n", stdout);

  free(values);
  return 0;
}

static int parse_furnsh_source_path(const generated_dispatch_request *request,
                                    const dispatch_args *args,
                                    char **outPath) {
  *outPath = NULL;

  const int sourceTok = args_elem_tok(args, 0);
  if (sourceTok < 0 || sourceTok >= request->tokenCount) {
    return write_invalid_args("kernels.furnsh source token is out of range");
  }

  const jsmntok_t *tok = &request->tokens[sourceTok];
  if (tok->type == JSMN_STRING) {
    char detail[256] = {0};
    if (jsmn_strdup(request->json, tok, outPath, detail, sizeof(detail)) == JSMN_STRDUP_OK) {
      return 0;
    }
    return write_invalid_args(detail[0] ? detail : "kernels.furnsh source decode failed");
  }

  if (tok->type != JSMN_OBJECT) {
    return write_invalid_args("kernels.furnsh expects args[0] to be string | { path, bytes }");
  }

  const int pathTok = jsmn_find_object_key(request->json,
                                           request->tokens,
                                           sourceTok,
                                           "path",
                                           request->tokenCount);
  if (!token_is_string(request, pathTok)) {
    return write_invalid_args("kernels.furnsh source object requires string path");
  }

  char detail[256] = {0};
  if (jsmn_strdup(request->json, &request->tokens[pathTok], outPath, detail, sizeof(detail)) != JSMN_STRDUP_OK) {
    return write_invalid_args(detail[0] ? detail : "kernels.furnsh path decode failed");
  }

  return 0;
}

static int handle_kernels_furnsh(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 1, "kernels.furnsh");
  if (status != 0) {
    return status;
  }

  char *pathToLoad = NULL;
  status = parse_furnsh_source_path(request, &args, &pathToLoad);
  if (status != 0) {
    return status;
  }

  furnsh_c(pathToLoad);
  free(pathToLoad);

  if (failed_c()) {
    return write_spice_failure("kernels.furnsh");
  }

  fputs("{\"ok\":true,\"result\":null}\n", stdout);
  return 0;
}

static int handle_kernels_ktotal(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, -1, "kernels.ktotal");
  if (status != 0) {
    return status;
  }

  const int arity = args_size(&args);
  if (arity < 0 || arity > 1) {
    return write_invalid_args("kernels.ktotal expects 0 or 1 args");
  }

  char *kindQuery = NULL;
  if (arity == 1) {
    status = build_kind_query_from_token(request, args_elem_tok(&args, 0), &kindQuery);
    if (status != 0) {
      return status;
    }
  }

  SpiceInt count = 0;
  ktotal_c(kindQuery ? kindQuery : "ALL", &count);
  free(kindQuery);

  if (failed_c()) {
    return write_spice_failure("kernels.ktotal");
  }

  printf("{\"ok\":true,\"result\":%" PRIdMAX "}\n", (intmax_t)count);
  return 0;
}

static int handle_kernels_kdata(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, -1, "kernels.kdata");
  if (status != 0) {
    return status;
  }

  const int arity = args_size(&args);
  if (arity < 1 || arity > 2) {
    return write_invalid_args("kernels.kdata expects 1 or 2 args");
  }

  SpiceInt which = 0;
  status = parse_int_arg(&args, 0, "kernels.kdata", &which);
  if (status != 0) {
    return status;
  }

  char *kindQuery = NULL;
  if (arity == 2) {
    status = build_kind_query_from_token(request, args_elem_tok(&args, 1), &kindQuery);
    if (status != 0) {
      return status;
    }
  }

  char file[DISPATCH_KDATA_FIELD_MAX] = {0};
  char filtyp[DISPATCH_KDATA_FIELD_MAX] = {0};
  char source[DISPATCH_KDATA_FIELD_MAX] = {0};
  SpiceInt handle = 0;
  SpiceBoolean found = SPICEFALSE;

  kdata_c(which,
          kindQuery ? kindQuery : "ALL",
          (SpiceInt)sizeof(file),
          (SpiceInt)sizeof(filtyp),
          (SpiceInt)sizeof(source),
          file,
          filtyp,
          source,
          &handle,
          &found);

  free(kindQuery);

  if (failed_c()) {
    return write_spice_failure("kernels.kdata");
  }

  if (found != SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
    return 0;
  }

  trim_fixed_width_c_string_end(file, sizeof(file));
  trim_fixed_width_c_string_end(filtyp, sizeof(filtyp));
  trim_fixed_width_c_string_end(source, sizeof(source));

  fputs("{\"ok\":true,\"result\":{\"found\":true,\"file\":", stdout);
  json_print_string_value(file);
  fputs(",\"filtyp\":", stdout);
  json_print_string_value(filtyp);
  fputs(",\"source\":", stdout);
  json_print_string_value(source);
  printf(",\"handle\":%" PRIdMAX "}}\n", (intmax_t)handle);
  return 0;
}

static int handle_kernels_kxtrct(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 3, "kernels.kxtrct");
  if (status != 0) {
    return status;
  }

  char *keywd = NULL;
  char *wordsq = NULL;
  char *terms = NULL;
  SpiceInt termlen = 2;
  SpiceInt nterms = 0;

  status = parse_string_arg(&args, 0, "kernels.kxtrct", &keywd);
  if (status != 0) {
    goto cleanup;
  }

  status = build_terms_buffer(request, args_elem_tok(&args, 1), &terms, &termlen, &nterms);
  if (status != 0) {
    goto cleanup;
  }

  status = parse_string_arg(&args, 2, "kernels.kxtrct", &wordsq);
  if (status != 0) {
    goto cleanup;
  }

  size_t wordsqLen = strlen(wordsq);
  size_t wordsqOutMaxBytes = wordsqLen + 1;
  if (wordsqOutMaxBytes < 2) {
    wordsqOutMaxBytes = 2;
  }

  char *wordsqOut = (char *)malloc(wordsqOutMaxBytes);
  char *substr = (char *)malloc(wordsqOutMaxBytes);
  if (wordsqOut == NULL || substr == NULL) {
    free(wordsqOut);
    free(substr);
    status = write_invalid_args("out of memory while allocating kxtrct buffers");
    goto cleanup;
  }

  strncpy(wordsqOut, wordsq, wordsqOutMaxBytes - 1);
  wordsqOut[wordsqOutMaxBytes - 1] = '\0';
  substr[0] = '\0';

  SpiceBoolean found = SPICEFALSE;
  kxtrct_c(keywd,
           termlen,
           terms,
           nterms,
           (SpiceInt)wordsqOutMaxBytes,
           (SpiceInt)wordsqOutMaxBytes,
           wordsqOut,
           &found,
           substr);

  if (failed_c()) {
    free(wordsqOut);
    free(substr);
    status = write_spice_failure("kernels.kxtrct");
    goto cleanup;
  }

  if (found != SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
  } else {
    fputs("{\"ok\":true,\"result\":{\"found\":true,\"wordsq\":", stdout);
    json_print_string_value(wordsqOut);
    fputs(",\"substr\":", stdout);
    json_print_string_value(substr);
    fputs("}}\n", stdout);
  }

  free(wordsqOut);
  free(substr);
  status = 0;

cleanup:
  free(keywd);
  free(wordsq);
  free(terms);
  return status;
}

static int handle_ek_ekfind(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 1, "ek.ekfind");
  if (status != 0) {
    return status;
  }

  char *query = NULL;
  status = parse_string_arg(&args, 0, "ek.ekfind", &query);
  if (status != 0) {
    return status;
  }

  SpiceInt nmrows = 0;
  SpiceBoolean error = SPICEFALSE;
  char errmsg[DISPATCH_TIMDEF_MAX] = {0};

  ekfind_c(query, (SpiceInt)sizeof(errmsg), &nmrows, &error, errmsg);
  free(query);

  if (failed_c()) {
    return write_spice_failure("ek.ekfind");
  }

  if (error == SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"ok\":false,\"errmsg\":", stdout);
    json_print_string_value(errmsg);
    fputs("}}\n", stdout);
    return 0;
  }

  printf("{\"ok\":true,\"result\":{\"ok\":true,\"nmrows\":%" PRIdMAX "}}\n",
         (intmax_t)nmrows);
  return 0;
}

static int handle_ek_ekgc(const generated_dispatch_request *request) {
  dispatch_args args;
  int status = expect_args_array(&args, request, 3, "ek.ekgc");
  if (status != 0) {
    return status;
  }

  SpiceInt selidx = 0;
  SpiceInt row = 0;
  SpiceInt elment = 0;

  status = parse_non_negative_int_arg(&args, 0, "ek.ekgc", &selidx);
  if (status != 0) return status;

  status = parse_non_negative_int_arg(&args, 1, "ek.ekgc", &row);
  if (status != 0) return status;

  status = parse_non_negative_int_arg(&args, 2, "ek.ekgc", &elment);
  if (status != 0) return status;

  char value[DISPATCH_EKGC_VALUE_MAX] = {0};
  SpiceBoolean isNull = SPICEFALSE;
  SpiceBoolean found = SPICEFALSE;

  ekgc_c(selidx,
         row,
         elment,
         (SpiceInt)sizeof(value),
         value,
         &isNull,
         &found);

  if (failed_c()) {
    return write_spice_failure("ek.ekgc");
  }

  if (found != SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
    return 0;
  }

  if (isNull == SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":true,\"isNull\":true}}\n", stdout);
    return 0;
  }

  fputs("{\"ok\":true,\"result\":{\"found\":true,\"isNull\":false,\"value\":", stdout);
  json_print_string_value(value);
  fputs("}}\n", stdout);
  return 0;
}

int handoff_to_generated_dispatch_seam(const generated_dispatch_request *request) {
  if (request == NULL) {
    write_error_json_ex("invalid_request", "dispatch request is null", NULL, NULL, NULL, NULL);
    return 1;
  }

  const char *fn = request->fn;

  if (fn != NULL) {
    if (strcmp(fn, "time.str2et") == 0) {
      return handle_time_str2et(request);
    }

    if (strcmp(fn, "time.et2utc") == 0) {
      return handle_time_et2utc(request);
    }

    if (strcmp(fn, "time.timdef") == 0) {
      return handle_time_timdef(request);
    }

    if (strcmp(fn, "ids-names.bodn2c") == 0) {
      return handle_ids_names_bodn2c(request);
    }

    if (strcmp(fn, "coords-vectors.mxm") == 0) {
      return handle_coords_vectors_mxm(request);
    }

    if (strcmp(fn, "coords-vectors.recgeo") == 0) {
      return handle_coords_vectors_recgeo(request);
    }

    if (strcmp(fn, "cells-windows.wninsd") == 0) {
      return handle_cells_windows_wninsd(request);
    }

    if (strcmp(fn, "cells-windows.wnfetd") == 0) {
      return handle_cells_windows_wnfetd(request);
    }

    if (strcmp(fn, "kernel-pool.gcpool") == 0) {
      return handle_kernel_pool_gcpool(request);
    }

    if (strcmp(fn, "kernels.furnsh") == 0) {
      return handle_kernels_furnsh(request);
    }

    if (strcmp(fn, "kernels.ktotal") == 0) {
      return handle_kernels_ktotal(request);
    }

    if (strcmp(fn, "kernels.kdata") == 0) {
      return handle_kernels_kdata(request);
    }

    if (strcmp(fn, "kernels.kxtrct") == 0) {
      return handle_kernels_kxtrct(request);
    }

    if (strcmp(fn, "ek.ekfind") == 0) {
      return handle_ek_ekfind(request);
    }

    if (strcmp(fn, "ek.ekgc") == 0) {
      return handle_ek_ekgc(request);
    }
  }

  write_generated_dispatch_unavailable_json(request->lane, request->callId, fn);
  return 1;
}
