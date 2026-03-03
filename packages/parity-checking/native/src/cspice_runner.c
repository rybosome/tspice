// Tiny CSPICE runner for parity-checking.
//
// Protocol:
//   stdin:  { setup: { kernels?: (string | { path: string, restrictToDir?: string })[] }, call: string, args: any }
//   stdout: { ok:true, result:any } OR { ok:false, error:{ message, spiceShort?, spiceLong?, spiceTrace? } }
//
// Implements:
//   - time.str2et (alias: str2et) args: [string] -> number
//   - time.et2utc (alias: et2utc) args: [number, string, number] -> string
//
//   - ids-names.bodn2c (alias: bodn2c) args: [string] -> {found, code?}
//   - ids-names.bodc2n (alias: bodc2n) args: [number] -> {found, name?}
//   - ids-names.bodc2s (alias: bodc2s) args: [number] -> string
//   - ids-names.bods2c (alias: bods2c) args: [string] -> {found, code?}
//   - ids-names.boddef (alias: boddef) args: [string, number] -> null
//   - ids-names.bodfnd (alias: bodfnd) args: [number, string] -> boolean
//   - ids-names.bodvar (alias: bodvar) args: [number, string] -> number[]
//
//   - frames.namfrm (alias: namfrm) args: [string] -> {found, code?}
//   - frames.frmnam (alias: frmnam) args: [number] -> {found, name?}
//   - frames.cidfrm (alias: cidfrm) args: [number] -> {found, frcode?, frname?}
//   - frames.cnmfrm (alias: cnmfrm) args: [string] -> {found, frcode?, frname?}
//   - frames.frinfo (alias: frinfo) args: [number] -> {found, center?, frameClass?, classId?}
//   - frames.ccifrm (alias: ccifrm) args: [number, number] -> {found, frcode?, frname?, center?}
//   - frames.pxform (alias: pxform) args: [string, string, number] -> number[9] (row-major)
//   - frames.sxform (alias: sxform) args: [string, string, number] -> number[36] (row-major)


#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_io.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_setup_kernels.h"
#include "cspice_runner_cells.h"
#include "cspice_runner_call_registry.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_workflow.h"

int main(void) {
  int exitCode = 0;

  // Ensure numeric parsing is locale-stable (decimal separator is '.')
  // regardless of the environment.
  if (setlocale(LC_NUMERIC, "C") == NULL) {
    write_error_json_ex(
        "locale_init",
        "Failed to set process numeric locale (LC_NUMERIC) to 'C'",
        "setlocale(LC_NUMERIC, 'C') returned NULL",
        NULL,
        NULL,
        NULL);
    return 1;
  }

  size_t inputLen = 0;
  char *input = NULL;
  ReadStdinErr readErr = read_all_stdin(&input, &inputLen);
  if (readErr != READ_STDIN_OK) {
    switch (readErr) {
    case READ_STDIN_TOO_LARGE: {
      char msg[128];
      snprintf(msg, sizeof(msg), "stdin too large (max %zu bytes)",
               (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES);
      write_error_json_ex("stdin_too_large", msg, NULL, NULL, NULL, NULL);
      break;
    }
    case READ_STDIN_OOM:
      write_error_json_ex("stdin_oom", "Out of memory while reading stdin", NULL,
                          NULL, NULL, NULL);
      exitCode = 1;
      break;
    case READ_STDIN_IO: {
      const char *detail = errno != 0 ? strerror(errno) : NULL;
      write_error_json_ex("stdin_io", "Failed to read stdin", detail, NULL, NULL,
                          NULL);
      exitCode = 1;
      break;
    }
    case READ_STDIN_OVERFLOW:
      write_error_json_ex("stdin_overflow",
                          "Internal overflow while reading stdin", NULL, NULL,
                          NULL, NULL);
      exitCode = 1;
      break;
    default:
      write_error_json_ex("stdin_error", "Failed to read stdin", NULL, NULL, NULL,
                          NULL);
      exitCode = 1;
      break;
    }
    return exitCode;
  }

  // Parse JSON.
  int tokenCap = 256;
  jsmntok_t *tokens = NULL;
  int tokenCount = 0;
  jsmn_parser parser;

  while (1) {
    tokens = (jsmntok_t *)malloc(sizeof(jsmntok_t) * (size_t)tokenCap);
    if (tokens == NULL) {
      free(input);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return 1;
    }

    jsmn_init(&parser);
    tokenCount = jsmn_parse(&parser, input, inputLen, tokens, (unsigned int)tokenCap);
    if (tokenCount >= 0) {
      break;
    }

    free(tokens);
    tokens = NULL;

    if (tokenCount == -1) {
      tokenCap *= 2;
      if (tokenCap > 8192) {
        free(input);
        write_error_json_ex("invalid_request", "JSON too large/complex", NULL,
                            NULL, NULL, NULL);
        return 0;
      }
      continue;
    }

    free(input);
    write_error_json_ex("invalid_request", "Invalid JSON", NULL, NULL, NULL,
                        NULL);
    return 0;
  }

  size_t firstNonWs = 0;
  while (firstNonWs < inputLen &&
         isspace((unsigned char)input[firstNonWs])) {
    firstNonWs++;
  }

  size_t endNonWs = inputLen;
  while (endNonWs > firstNonWs &&
         isspace((unsigned char)input[endNonWs - 1])) {
    endNonWs--;
  }

  // Enforce strict top-level parsing: exactly one JSON object spanning the
  // full non-whitespace payload. This rejects trailing bytes like
  // '{"call":"time.str2et"}garbage'.
  if (tokenCount >= 1 &&
      (tokens[0].start < 0 || tokens[0].end < 0 ||
       (size_t)tokens[0].start != firstNonWs ||
       (size_t)tokens[0].end != endNonWs ||
       parser.toksuper != -1)) {
    free(tokens);
    free(input);
    write_error_json_ex("invalid_request", "Invalid JSON", NULL, NULL, NULL,
                        NULL);
    return 0;
  }

  if (tokenCount < 1 || tokens[0].type != JSMN_OBJECT) {
    free(tokens);
    free(input);
    write_error_json_ex("invalid_request", "Input JSON must be an object", NULL,
                        NULL, NULL, NULL);
    return 0;
  }

  int callTok = jsmn_find_object_key(input, tokens, 0, "call", tokenCount);
  int argsTok = jsmn_find_object_key(input, tokens, 0, "args", tokenCount);
  int setupTok = jsmn_find_object_key(input, tokens, 0, "setup", tokenCount);
  int schemaVersionTok =
      jsmn_find_object_key(input, tokens, 0, "schemaVersion", tokenCount);

  char *call = NULL;

  bool isV3Request = false;
  if (schemaVersionTok >= 0) {
    SpiceInt schemaVersion = 0;
    if (!v2_parse_int_token_or_error(input, &tokens[schemaVersionTok],
                                     &schemaVersion, "schemaVersion")) {
      goto done;
    }

    if (schemaVersion == 3) {
      isV3Request = true;
    } else {
      write_error_json_ex("invalid_request", "Unsupported schemaVersion", NULL,
                          NULL, NULL, NULL);
      goto done;
    }
  }

  // --- Per-case isolation + error policy.
  kclear_c();
  reset_c();
  erract_c("SET", 0, "RETURN");
  errprt_c("SET", 0, "NONE");

  if (!apply_setup_kernels(input, tokens, tokenCount, setupTok, &exitCode)) {
    goto done;
  }

  if (isV3Request) {
    (void)argsTok;
    (void)callTok;
    if (!v2_execute_workflow_request(input, tokens, tokenCount)) {
      goto done;
    }

    goto done;
  }

  if (callTok < 0) {
    write_error_json_ex("invalid_request", "Missing required field: call", NULL,
                        NULL, NULL, NULL);
    goto done;
  }

  if (tokens[callTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "call must be a string", NULL, NULL,
                        NULL, NULL);
    goto done;
  }

  char strDetail[256];
  strDetail[0] = '\0';
  jsmn_strdup_err_t callErr =
      jsmn_strdup(input, &tokens[callTok], &call, strDetail, sizeof(strDetail));
  if (callErr != JSMN_STRDUP_OK) {
    if (callErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    goto done;
  }

  if (argsTok < 0) {
    write_error_json_ex("invalid_request", "Missing required field: args", NULL,
                        NULL, NULL, NULL);
    goto done;
  }

  if (tokens[argsTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "args must be an array", NULL, NULL,
                        NULL, NULL);
    goto done;
  }

  const CallId callId = parse_call_id(call);
  if (callId == CALL_NONE) {
    write_error_json_ex_with_call("unsupported_call", "Unsupported call", NULL,
                                  NULL, NULL, NULL, call);
    goto done;
  }

  switch (callId) {
  case CALL_TIME_STR2ET: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "time.str2et expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int arg0Tok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (arg0Tok < 0 || arg0Tok >= tokenCount || tokens[arg0Tok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "time.str2et expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *timeStr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t timeErr =
        jsmn_strdup(input, &tokens[arg0Tok], &timeStr, strDetail, sizeof(strDetail));
    if (timeErr != JSMN_STRDUP_OK) {
      if (timeErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    str2et_c(timeStr, &et);
    free(timeStr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in str2et", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // Success.
    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)et);
    goto done;
  }

  case CALL_TIME_ET2UTC: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "time.et2utc expects args[0]=number args[1]=string args[2]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int etTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int fmtTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int precTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble et = 0.0;
    SpiceInt prec = 0;

    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }

    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "time.et2utc expects args[0] to be a number",
          etParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    if (fmtTok < 0 || fmtTok >= tokenCount || tokens[fmtTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "time.et2utc expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    parse_result precParse = PARSE_INVALID;
    if (precTok >= 0 && precTok < tokenCount) {
      precParse = jsmn_parse_int(input, &tokens[precTok], &prec);
    }

    if (precTok < 0 || precTok >= tokenCount || precParse != PARSE_OK) {
      if (precParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "time.et2utc expects args[2] to be an integer (SpiceInt range)",
            precParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *format = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t fmtErr =
        jsmn_strdup(input, &tokens[fmtTok], &format, strDetail, sizeof(strDetail));
    if (fmtErr != JSMN_STRDUP_OK) {
      if (fmtErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceChar utc[128];
    utc[0] = '\0';
    et2utc_c(et, format, prec, (SpiceInt)sizeof(utc), utc);
    free(format);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in et2utc", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(utc);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_SPICE_VERSION: {
    const char *v = tkvrsn_c("TOOLKIT");

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spiceVersion", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(v);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_TKVRSN: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "time.tkvrsn expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tkvrsn expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *item = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &item, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (strcmp(item, "TOOLKIT") != 0) {
      write_error_json_ex("invalid_args", "time.tkvrsn expects args[0] to be \"TOOLKIT\"",
                          NULL, NULL, NULL, NULL);
      free(item);
      goto done;
    }

    const char *v = tkvrsn_c(item);
    free(item);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in tkvrsn", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(v);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_TIMOUT: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args",
                          "time.timout expects args[0]=number args[1]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int etTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int pictTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble et = 0.0;
    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }
    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex("invalid_args", "time.timout expects args[0] to be a number",
                          etParse == PARSE_TOO_LONG
                              ? "numeric literal too long"
                              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
                          NULL, NULL, NULL);
      goto done;
    }

    if (pictTok < 0 || pictTok >= tokenCount || tokens[pictTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.timout expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *picture = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pictErr =
        jsmn_strdup(input, &tokens[pictTok], &picture, strDetail, sizeof(strDetail));
    if (pictErr != JSMN_STRDUP_OK) {
      if (pictErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceChar out[4096];
    out[0] = '\0';
    timout_c(et, picture, (SpiceInt)sizeof(out), out);
    free(picture);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in timout", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(out);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_DELTET: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args",
                          "time.deltet expects args[0]=number args[1]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int epochTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int typeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble epoch = 0.0;
    parse_result epochParse = PARSE_INVALID;
    if (epochTok >= 0 && epochTok < tokenCount) {
      epochParse = jsmn_parse_double(input, &tokens[epochTok], &epoch);
    }
    if (epochTok < 0 || epochTok >= tokenCount || epochParse != PARSE_OK) {
      write_error_json_ex("invalid_args", "time.deltet expects args[0] to be a number",
                          epochParse == PARSE_TOO_LONG
                              ? "numeric literal too long"
                              : (epochParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
                          NULL, NULL, NULL);
      goto done;
    }

    if (typeTok < 0 || typeTok >= tokenCount || tokens[typeTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.deltet expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *eptype = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t typeErr =
        jsmn_strdup(input, &tokens[typeTok], &eptype, strDetail, sizeof(strDetail));
    if (typeErr != JSMN_STRDUP_OK) {
      if (typeErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (strcmp(eptype, "ET") != 0 && strcmp(eptype, "UTC") != 0) {
      write_error_json_ex("invalid_args",
                          "time.deltet expects args[1] to be \"ET\" or \"UTC\"",
                          NULL, NULL, NULL, NULL);
      free(eptype);
      goto done;
    }

    SpiceDouble delta = 0.0;
    deltet_c(epoch, eptype, &delta);
    free(eptype);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in deltet", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)delta);
    goto done;
  }

  case CALL_TIME_UNITIM: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args",
                          "time.unitim expects args[0]=number args[1]=string args[2]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int epochTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int inTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int outTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble epoch = 0.0;
    parse_result epochParse = PARSE_INVALID;
    if (epochTok >= 0 && epochTok < tokenCount) {
      epochParse = jsmn_parse_double(input, &tokens[epochTok], &epoch);
    }
    if (epochTok < 0 || epochTok >= tokenCount || epochParse != PARSE_OK) {
      write_error_json_ex("invalid_args", "time.unitim expects args[0] to be a number",
                          epochParse == PARSE_TOO_LONG
                              ? "numeric literal too long"
                              : (epochParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
                          NULL, NULL, NULL);
      goto done;
    }

    if (inTok < 0 || inTok >= tokenCount || tokens[inTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.unitim expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (outTok < 0 || outTok >= tokenCount || tokens[outTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.unitim expects args[2] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *insys = NULL;
    char *outsys = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t inErr =
        jsmn_strdup(input, &tokens[inTok], &insys, strDetail, sizeof(strDetail));
    if (inErr != JSMN_STRDUP_OK) {
      if (inErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t outErr =
        jsmn_strdup(input, &tokens[outTok], &outsys, strDetail, sizeof(strDetail));
    if (outErr != JSMN_STRDUP_OK) {
      if (outErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(insys);
      goto done;
    }

    if ((strcmp(insys, "TAI") != 0 && strcmp(insys, "UTC") != 0 && strcmp(insys, "TDB") != 0 &&
         strcmp(insys, "TDT") != 0 && strcmp(insys, "ET") != 0) ||
        (strcmp(outsys, "TAI") != 0 && strcmp(outsys, "UTC") != 0 && strcmp(outsys, "TDB") != 0 &&
         strcmp(outsys, "TDT") != 0 && strcmp(outsys, "ET") != 0)) {
      write_error_json_ex("invalid_args",
                          "time.unitim expects args[1]/args[2] to be valid time systems",
                          NULL, NULL, NULL, NULL);
      free(insys);
      free(outsys);
      goto done;
    }

    const SpiceDouble outEpoch = unitim_c(epoch, insys, outsys);
    free(insys);
    free(outsys);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in unitim", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)outEpoch);
    goto done;
  }

  case CALL_TIME_TPARSE: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "time.tparse expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int strTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (strTok < 0 || strTok >= tokenCount || tokens[strTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tparse expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *timstr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t strErr =
        jsmn_strdup(input, &tokens[strTok], &timstr, strDetail, sizeof(strDetail));
    if (strErr != JSMN_STRDUP_OK) {
      if (strErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble sp2000 = 0.0;
    SpiceChar errmsg[1024];
    errmsg[0] = '\0';
    tparse_c(timstr, (SpiceInt)sizeof(errmsg), &sp2000, errmsg);
    free(timstr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in tparse", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (errmsg[0] != '\0') {
      write_error_json_ex("invalid_args", errmsg, NULL, NULL, NULL, NULL);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)sp2000);
    goto done;
  }

  case CALL_TIME_TPICTR: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "time.tpictr expects args[0]=string args[1]=string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    int sampleTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int templTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (sampleTok < 0 || sampleTok >= tokenCount || tokens[sampleTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tpictr expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (templTok < 0 || templTok >= tokenCount || tokens[templTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.tpictr expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *sample = NULL;
    char *templ = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t sampleErr =
        jsmn_strdup(input, &tokens[sampleTok], &sample, strDetail, sizeof(strDetail));
    if (sampleErr != JSMN_STRDUP_OK) {
      if (sampleErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t templErr =
        jsmn_strdup(input, &tokens[templTok], &templ, strDetail, sizeof(strDetail));
    if (templErr != JSMN_STRDUP_OK) {
      if (templErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(sample);
      goto done;
    }

    SpiceChar pictur[4096];
    pictur[0] = '\0';
    snprintf(pictur, sizeof(pictur), "%s", templ);

    SpiceBoolean ok = SPICEFALSE;
    SpiceChar errmsg[4096];
    errmsg[0] = '\0';
    tpictr_c(sample, (SpiceInt)sizeof(pictur), (SpiceInt)sizeof(errmsg), pictur, &ok, errmsg);

    free(sample);
    free(templ);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in tpictr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (ok != SPICETRUE) {
      write_error_json(errmsg[0] ? errmsg : "tpictr failed", NULL, NULL, NULL);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(pictur);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_TIME_TIMDEF: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "time.timdef expects args[0]=string args[1]=string (and optional args[2]=string for SET)",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    int actionTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int itemTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (actionTok < 0 || actionTok >= tokenCount || tokens[actionTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.timdef expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "time.timdef expects args[1] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *action = NULL;
    char *item = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t actionErr =
        jsmn_strdup(input, &tokens[actionTok], &action, strDetail, sizeof(strDetail));
    if (actionErr != JSMN_STRDUP_OK) {
      if (actionErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &item, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(action);
      goto done;
    }

    if (strcmp(action, "GET") == 0) {
      SpiceChar value[256];
      value[0] = '\0';
      timdef_c("GET", item, (SpiceInt)sizeof(value), value);

      free(action);
      free(item);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                            sizeof(traceMsg));
        write_error_json("SPICE error in timdef(GET)", shortMsg, longMsg, traceMsg);
        goto done;
      }

      fputs("{\"ok\":true,\"result\":\"", stdout);
      json_print_escaped(value);
      fputs("\"}\n", stdout);
      goto done;
    }

    if (strcmp(action, "SET") == 0) {
      if (tokens[argsTok].size < 3) {
        write_error_json_ex("invalid_args", "time.timdef SET expects args[2] to be a string",
                            NULL, NULL, NULL, NULL);
        free(action);
        free(item);
        goto done;
      }

      int valueTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
      if (valueTok < 0 || valueTok >= tokenCount || tokens[valueTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_args", "time.timdef SET expects args[2] to be a string",
                            NULL, NULL, NULL, NULL);
        free(action);
        free(item);
        goto done;
      }

      char *value = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t valErr =
          jsmn_strdup(input, &tokens[valueTok], &value, strDetail, sizeof(strDetail));
      if (valErr != JSMN_STRDUP_OK) {
        if (valErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        free(action);
        free(item);
        goto done;
      }

      timdef_c("SET", item, (SpiceInt)(strlen(value) + 1), value);

      free(action);
      free(item);
      free(value);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                            sizeof(traceMsg));
        write_error_json("SPICE error in timdef(SET)", shortMsg, longMsg, traceMsg);
        goto done;
      }

      fputs("{\"ok\":true,\"result\":null}\n", stdout);
      goto done;
    }

    write_error_json_ex("invalid_args", "time.timdef expects args[0] to be \"GET\" or \"SET\"",
                        NULL, NULL, NULL, NULL);
    free(action);
    free(item);
    goto done;
  }


  case CALL_BODN2C: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodn2c expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodn2c expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt code = 0;
    SpiceBoolean found = SPICEFALSE;
    bodn2c_c(name, &code, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodn2c", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"code\":%" PRIdMAX "}}\n",
            (intmax_t)code);
    goto done;
  }

  case CALL_BODC2N: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodc2n expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int codeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt code = 0;
    parse_result codeParse = PARSE_INVALID;
    if (codeTok >= 0 && codeTok < tokenCount) {
      codeParse = jsmn_parse_int(input, &tokens[codeTok], &code);
    }

    if (codeTok < 0 || codeTok >= tokenCount || codeParse != PARSE_OK) {
      if (codeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodc2n expects args[0] to be an integer (SpiceInt range)",
            codeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceChar name[64];
    name[0] = '\0';
    SpiceBoolean found = SPICEFALSE;
    bodc2n_c(code, (SpiceInt)sizeof(name), name, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodc2n", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"name\":\"", stdout);
    json_print_escaped(name);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_BODC2S: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodc2s expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int codeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt code = 0;
    parse_result codeParse = PARSE_INVALID;
    if (codeTok >= 0 && codeTok < tokenCount) {
      codeParse = jsmn_parse_int(input, &tokens[codeTok], &code);
    }

    if (codeTok < 0 || codeTok >= tokenCount || codeParse != PARSE_OK) {
      if (codeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodc2s expects args[0] to be an integer (SpiceInt range)",
            codeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceChar name[64];
    name[0] = '\0';
    bodc2s_c(code, (SpiceInt)sizeof(name), name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodc2s", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(name);
    fputs("\"}\n", stdout);
    goto done;
  }

  case CALL_BODS2C: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bods2c expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bods2c expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt code = 0;
    SpiceBoolean found = SPICEFALSE;
    bods2c_c(name, &code, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bods2c", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"code\":%" PRIdMAX "}}\n",
            (intmax_t)code);
    goto done;
  }

  case CALL_BODDEF: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.boddef expects args[0]=string args[1]=integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int codeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.boddef expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceInt code = 0;
    parse_result codeParse = PARSE_INVALID;
    if (codeTok >= 0 && codeTok < tokenCount) {
      codeParse = jsmn_parse_int(input, &tokens[codeTok], &code);
    }

    if (codeTok < 0 || codeTok >= tokenCount || codeParse != PARSE_OK) {
      if (codeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.boddef expects args[1] to be an integer (SpiceInt range)",
            codeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    boddef_c(name, code);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in boddef", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_BODFND: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodfnd expects args[0]=integer (SpiceInt range) args[1]=string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int itemTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodfnd expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodfnd expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *itemRaw = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &itemRaw, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *item = NULL;
    const size_t itemRawLen = strlen(itemRaw);
    normalize_bod_item_err_t itemNorm = normalize_bod_item(itemRaw, &item);
    free(itemRaw);
    if (itemNorm != NORMALIZE_BOD_ITEM_OK) {
      if (itemNorm == NORMALIZE_BOD_ITEM_OOM) {
        write_error_json("Out of memory", NULL, NULL, NULL);
      } else if (itemNorm == NORMALIZE_BOD_ITEM_TOO_LONG) {
        char detail[128];
        snprintf(detail, sizeof(detail), "bod item too long (len=%zu, max=%zu bytes)", itemRawLen,
                 (size_t)MAX_BOD_ITEM_BYTES);
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodfnd expects args[1] to be a short string",
            detail,
            NULL,
            NULL,
            NULL);
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodfnd expects args[1] to be a string",
            NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char poolVar[2048];
    int poolLen = snprintf(poolVar, sizeof(poolVar), "BODY%" PRIdMAX "_%s", (intmax_t)body, item);
    if (poolLen < 0 || (size_t)poolLen >= sizeof(poolVar)) {
      free(item);
      write_error_json_ex("invalid_args", "bodfnd: pool var name too long", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceBoolean foundC = SPICEFALSE;
    SpiceInt nC = 0;
    SpiceChar typeC = 0;
    dtpool_c(poolVar, &foundC, &nC, &typeC);
    free(item);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodfnd", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // NAIF `bodfnd_c` is an existence check; it does not care whether the pool
    // var is numeric ('N') vs character ('C') typed.
    const bool out = (foundC == SPICETRUE);
    fprintf(stdout, "{\"ok\":true,\"result\":%s}\n", out ? "true" : "false");
    goto done;
  }

  case CALL_BODVAR: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodvar expects args[0]=integer (SpiceInt range) args[1]=string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int itemTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodvar expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "ids-names.bodvar expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *itemRaw = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &itemRaw, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *item = NULL;
    const size_t itemRawLen = strlen(itemRaw);
    normalize_bod_item_err_t itemNorm = normalize_bod_item(itemRaw, &item);
    free(itemRaw);
    if (itemNorm != NORMALIZE_BOD_ITEM_OK) {
      if (itemNorm == NORMALIZE_BOD_ITEM_OOM) {
        write_error_json("Out of memory", NULL, NULL, NULL);
      } else if (itemNorm == NORMALIZE_BOD_ITEM_TOO_LONG) {
        char detail[128];
        snprintf(detail, sizeof(detail), "bod item too long (len=%zu, max=%zu bytes)", itemRawLen,
                 (size_t)MAX_BOD_ITEM_BYTES);
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodvar expects args[1] to be a short string",
            detail,
            NULL,
            NULL,
            NULL);
      } else {
        write_error_json_ex(
            "invalid_args",
            "ids-names.bodvar expects args[1] to be a string",
            NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char poolVar[2048];
    int poolLen = snprintf(poolVar, sizeof(poolVar), "BODY%" PRIdMAX "_%s", (intmax_t)body, item);
    if (poolLen < 0 || (size_t)poolLen >= sizeof(poolVar)) {
      free(item);
      write_error_json_ex("invalid_args", "bodvar: pool var name too long", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceBoolean foundC = SPICEFALSE;
    SpiceInt nC = 0;
    SpiceChar typeC = 0;
    dtpool_c(poolVar, &foundC, &nC, &typeC);

    if (failed_c() == SPICETRUE) {
      free(item);
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodvar (dtpool)", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (foundC != SPICETRUE || typeC != 'N' || nC <= 0) {
      free(item);
      fputs("{\"ok\":true,\"result\":[]}\n", stdout);
      goto done;
    }

    if (nC > (SpiceInt)BODY_CONST_MAX_VALUES) {
      free(item);
      write_error_json_ex(
          "invalid_args",
          "bodvar(): BODY constant has too many values",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    const SpiceInt maxn = nC;
    SpiceDouble *values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)maxn);
    if (values == NULL) {
      free(item);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt dim = 0;
    bodvcd_c(body, item, maxn, &dim, values);
    free(item);

    if (failed_c() == SPICETRUE) {
      free(values);
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in bodvar", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (dim < 0) {
      dim = 0;
    }
    if (dim > maxn) {
      dim = maxn;
    }

    fputs("{\"ok\":true,\"result\":[", stdout);
    for (SpiceInt i = 0; i < dim; i++) {
      if (i != 0) {
        fputc(',', stdout);
      }
      fprintf(stdout, "%.17g", (double)values[i]);
    }
    fputs("]}\n", stdout);
    free(values);
    goto done;
  }


  case CALL_NAMFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.namfrm expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.namfrm expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    namfrm_c(name, &frcode);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in namfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (frcode == 0) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"code\":%" PRIdMAX "}}\n",
            (intmax_t)frcode);
    goto done;
  }

  case CALL_FRMNAM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.frmnam expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int codeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt frcode = 0;
    parse_result frcodeParse = PARSE_INVALID;
    if (codeTok >= 0 && codeTok < tokenCount) {
      frcodeParse = jsmn_parse_int(input, &tokens[codeTok], &frcode);
    }

    if (codeTok < 0 || codeTok >= tokenCount || frcodeParse != PARSE_OK) {
      if (frcodeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.frmnam expects args[0] to be an integer (SpiceInt range)",
            frcodeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceChar frname[64];
    frname[0] = '\0';
    frmnam_c(frcode, (SpiceInt)sizeof(frname), frname);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in frmnam", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (frname[0] == '\0') {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"name\":\"", stdout);
    json_print_escaped(frname);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_CIDFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.cidfrm expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int centerTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt center = 0;
    parse_result centerParse = PARSE_INVALID;
    if (centerTok >= 0 && centerTok < tokenCount) {
      centerParse = jsmn_parse_int(input, &tokens[centerTok], &center);
    }

    if (centerTok < 0 || centerTok >= tokenCount || centerParse != PARSE_OK) {
      if (centerParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.cidfrm expects args[0] to be an integer (SpiceInt range)",
            centerParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    SpiceChar frname[64];
    frname[0] = '\0';
    SpiceBoolean found = SPICEFALSE;
    cidfrm_c(center, (SpiceInt)sizeof(frname), &frcode, frname, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in cidfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"frcode\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frcode);
    fputs(",\"frname\":\"", stdout);
    json_print_escaped(frname);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_CNMFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.cnmfrm expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.cnmfrm expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *name = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    SpiceChar frname[64];
    frname[0] = '\0';
    SpiceBoolean found = SPICEFALSE;
    cnmfrm_c(name, (SpiceInt)sizeof(frname), &frcode, frname, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in cnmfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"frcode\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frcode);
    fputs(",\"frname\":\"", stdout);
    json_print_escaped(frname);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_FRINFO: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "frames.frinfo expects args[0] to be an integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int idTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceInt frameId = 0;
    parse_result idParse = PARSE_INVALID;
    if (idTok >= 0 && idTok < tokenCount) {
      idParse = jsmn_parse_int(input, &tokens[idTok], &frameId);
    }

    if (idTok < 0 || idTok >= tokenCount || idParse != PARSE_OK) {
      if (idParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.frinfo expects args[0] to be an integer (SpiceInt range)",
            idParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt center = 0;
    SpiceInt frameClass = 0;
    SpiceInt classId = 0;
    SpiceBoolean found = SPICEFALSE;
    frinfo_c(frameId, &center, &frameClass, &classId, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in frinfo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"center\":%" PRIdMAX ",\"frameClass\":%" PRIdMAX ",\"classId\":%" PRIdMAX "}}\n",
            (intmax_t)center, (intmax_t)frameClass, (intmax_t)classId);
    goto done;
  }

  case CALL_CCIFRM: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "frames.ccifrm expects args[0]=integer (SpiceInt range) args[1]=integer (SpiceInt range)",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int frClassTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int classIdTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt frClass = 0;
    parse_result frClassParse = PARSE_INVALID;
    if (frClassTok >= 0 && frClassTok < tokenCount) {
      frClassParse = jsmn_parse_int(input, &tokens[frClassTok], &frClass);
    }

    if (frClassTok < 0 || frClassTok >= tokenCount || frClassParse != PARSE_OK) {
      if (frClassParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.ccifrm expects args[0] to be an integer (SpiceInt range)",
            frClassParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt clssid = 0;
    parse_result clssidParse = PARSE_INVALID;
    if (classIdTok >= 0 && classIdTok < tokenCount) {
      clssidParse = jsmn_parse_int(input, &tokens[classIdTok], &clssid);
    }

    if (classIdTok < 0 || classIdTok >= tokenCount || clssidParse != PARSE_OK) {
      if (clssidParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "frames.ccifrm expects args[1] to be an integer (SpiceInt range)",
            clssidParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt frcode = 0;
    SpiceChar frname[64];
    frname[0] = '\0';
    SpiceInt center = 0;
    SpiceBoolean found = SPICEFALSE;

    ccifrm_c(frClass, clssid, (SpiceInt)sizeof(frname), &frcode, frname, &center, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in ccifrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"frcode\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frcode);
    fputs(",\"frname\":\"", stdout);
    json_print_escaped(frname);
    fputs("\",\"center\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)center);
    fputs("}}\n", stdout);
    goto done;
  }


  case CALL_PXFORM: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[0]=string args[1]=string args[2]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int fromTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int toTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (fromTok < 0 || fromTok >= tokenCount || tokens[fromTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    if (toTok < 0 || toTok >= tokenCount || tokens[toTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }

    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "frames.pxform expects args[2] to be a number",
          etParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *from = NULL;
    char *to = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t fromErr =
        jsmn_strdup(input, &tokens[fromTok], &from, strDetail, sizeof(strDetail));
    if (fromErr != JSMN_STRDUP_OK) {
      if (fromErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t toErr =
        jsmn_strdup(input, &tokens[toTok], &to, strDetail, sizeof(strDetail));
    if (toErr != JSMN_STRDUP_OK) {
      free(from);
      if (toErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble m[3][3];
    pxform_c(from, to, et, m);
    free(from);
    free(to);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pxform", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // Success: row-major matrix.
    fputs("{\"ok\":true,\"result\":[", stdout);
    for (int r = 0; r < 3; r++) {
      for (int c = 0; c < 3; c++) {
        const int i = r * 3 + c;
        if (i != 0) {
          fputc(',', stdout);
        }
        fprintf(stdout, "%.17g", (double)m[r][c]);
      }
    }
    fputs("]}\n", stdout);
    goto done;
  }

  case CALL_SXFORM: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "frames.sxform expects args[0]=string args[1]=string args[2]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int fromTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int toTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (fromTok < 0 || fromTok >= tokenCount || tokens[fromTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.sxform expects args[0] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    if (toTok < 0 || toTok >= tokenCount || tokens[toTok].type != JSMN_STRING) {
      write_error_json_ex(
          "invalid_args",
          "frames.sxform expects args[1] to be a string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    parse_result etParse = PARSE_INVALID;
    if (etTok >= 0 && etTok < tokenCount) {
      etParse = jsmn_parse_double(input, &tokens[etTok], &et);
    }

    if (etTok < 0 || etTok >= tokenCount || etParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "frames.sxform expects args[2] to be a number",
          etParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (etParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    char *from = NULL;
    char *to = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t fromErr =
        jsmn_strdup(input, &tokens[fromTok], &from, strDetail, sizeof(strDetail));
    if (fromErr != JSMN_STRDUP_OK) {
      if (fromErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t toErr =
        jsmn_strdup(input, &tokens[toTok], &to, strDetail, sizeof(strDetail));
    if (toErr != JSMN_STRDUP_OK) {
      free(from);
      if (toErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble x[6][6];
    sxform_c(from, to, et, x);
    free(from);
    free(to);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in sxform", shortMsg, longMsg, traceMsg);
      goto done;
    }

    // Success: row-major matrix.
    fputs("{\"ok\":true,\"result\":[", stdout);
    for (int r = 0; r < 6; r++) {
      for (int c = 0; c < 6; c++) {
        const int i = r * 6 + c;
        if (i != 0) {
          fputc(',', stdout);
        }
        fprintf(stdout, "%.17g", (double)x[r][c]);
      }
    }
    fputs("]}\n", stdout);
    goto done;
  }



  // coords-vectors
  case CALL_AXISAR: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.axisar expects args[0]=vec3 args[1]=number",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int axisTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int angleTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble axis[3];
    if (!jsmn_parse_vec3(input, tokens, axisTok, tokenCount, axis)) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.axisar expects args[0] to be a length-3 array of numbers",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble angle = 0.0;
    parse_result angleParse = PARSE_INVALID;
    if (angleTok >= 0 && angleTok < tokenCount) {
      angleParse = jsmn_parse_double(input, &tokens[angleTok], &angle);
    }
    if (angleTok < 0 || angleTok >= tokenCount || angleParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.axisar expects args[1] to be a number",
          angleParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (angleParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble m[3][3];
    axisar_c(axis, angle, m);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in axisar", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(m);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_GEOREC: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.georec expects args[0]=lon args[1]=lat args[2]=alt args[3]=re args[4]=f",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int lonTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int latTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int altTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int reTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int fTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    SpiceDouble alt = 0.0;
    SpiceDouble re = 0.0;
    SpiceDouble f = 0.0;

    if (lonTok < 0 || lonTok >= tokenCount || jsmn_parse_double(input, &tokens[lonTok], &lon) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (latTok < 0 || latTok >= tokenCount || jsmn_parse_double(input, &tokens[latTok], &lat) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (altTok < 0 || altTok >= tokenCount || jsmn_parse_double(input, &tokens[altTok], &alt) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (reTok < 0 || reTok >= tokenCount || jsmn_parse_double(input, &tokens[reTok], &re) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[3] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (fTok < 0 || fTok >= tokenCount || jsmn_parse_double(input, &tokens[fTok], &f) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.georec expects args[4] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble rect[3];
    georec_c(lon, lat, alt, re, f, rect);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in georec", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(rect, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_LATREC: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.latrec expects args[0]=radius args[1]=lon args[2]=lat",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int lonTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int latTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble radius = 0.0;
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;

    if (rTok < 0 || rTok >= tokenCount || jsmn_parse_double(input, &tokens[rTok], &radius) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.latrec expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (lonTok < 0 || lonTok >= tokenCount || jsmn_parse_double(input, &tokens[lonTok], &lon) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.latrec expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (latTok < 0 || latTok >= tokenCount || jsmn_parse_double(input, &tokens[latTok], &lat) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.latrec expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble rect[3];
    latrec_c(radius, lon, lat, rect);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in latrec", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(rect, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_MTXV: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mtxv expects args[0]=mat3 args[1]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int mTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int vTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble m[3][3];
    if (!jsmn_parse_mat3_rowmajor(input, tokens, mTok, tokenCount, m)) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mtxv expects args[0] to be a length-9 array of numbers",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mtxv expects args[1] to be a length-3 array of numbers",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    SpiceDouble out[3];
    mtxv_c(m, v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in mtxv", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_MXM: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mxm expects args[0]=mat3 args[1]=mat3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3][3];
    SpiceDouble b[3][3];

    if (!jsmn_parse_mat3_rowmajor(input, tokens, aTok, tokenCount, a)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxm expects args[0] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!jsmn_parse_mat3_rowmajor(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxm expects args[1] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3][3];
    mxm_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in mxm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(out);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_MXV: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.mxv expects args[0]=mat3 args[1]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int mTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int vTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble m[3][3];
    if (!jsmn_parse_mat3_rowmajor(input, tokens, mTok, tokenCount, m)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxv expects args[0] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.mxv expects args[1] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    mxv_c(m, v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in mxv", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_RECGEO: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.recgeo expects args[0]=vec3 args[1]=re args[2]=f",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rectTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int reTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int fTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble rect[3];
    if (!jsmn_parse_vec3(input, tokens, rectTok, tokenCount, rect)) {
      write_error_json_ex("invalid_args", "coords-vectors.recgeo expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble re = 0.0;
    SpiceDouble f = 0.0;
    if (reTok < 0 || reTok >= tokenCount || jsmn_parse_double(input, &tokens[reTok], &re) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.recgeo expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (fTok < 0 || fTok >= tokenCount || jsmn_parse_double(input, &tokens[fTok], &f) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.recgeo expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    SpiceDouble alt = 0.0;
    recgeo_c(rect, re, f, &lon, &lat, &alt);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in recgeo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"lon\":%.17g,\"lat\":%.17g,\"alt\":%.17g}}\n",
            (double)lon, (double)lat, (double)alt);
    goto done;
  }

  case CALL_RECLAT: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.reclat expects args[0]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rectTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble rect[3];
    if (!jsmn_parse_vec3(input, tokens, rectTok, tokenCount, rect)) {
      write_error_json_ex("invalid_args", "coords-vectors.reclat expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble radius = 0.0;
    SpiceDouble lon = 0.0;
    SpiceDouble lat = 0.0;
    reclat_c(rect, &radius, &lon, &lat);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in reclat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"radius\":%.17g,\"lon\":%.17g,\"lat\":%.17g}}\n",
            (double)radius, (double)lon, (double)lat);
    goto done;
  }

  case CALL_RECSPH: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.recsph expects args[0]=vec3",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rectTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble rect[3];
    if (!jsmn_parse_vec3(input, tokens, rectTok, tokenCount, rect)) {
      write_error_json_ex("invalid_args", "coords-vectors.recsph expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble radius = 0.0;
    SpiceDouble colat = 0.0;
    SpiceDouble lon = 0.0;
    recsph_c(rect, &radius, &colat, &lon);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in recsph", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"radius\":%.17g,\"colat\":%.17g,\"lon\":%.17g}}\n",
            (double)radius, (double)colat, (double)lon);
    goto done;
  }

  case CALL_ROTATE: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.rotate expects args[0]=angle args[1]=axis",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int angTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int axisTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble angle = 0.0;
    if (angTok < 0 || angTok >= tokenCount || jsmn_parse_double(input, &tokens[angTok], &angle) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.rotate expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt axis = 0;
    parse_result axisParse = PARSE_INVALID;
    if (axisTok >= 0 && axisTok < tokenCount) {
      axisParse = jsmn_parse_int(input, &tokens[axisTok], &axis);
    }

    if (axisTok < 0 || axisTok >= tokenCount || axisParse != PARSE_OK) {
      if (axisParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "coords-vectors.rotate expects args[1] to be an integer (SpiceInt range)",
            axisParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble m[3][3];
    rotate_c(angle, axis, m);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in rotate", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(m);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_ROTMAT: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.rotmat expects args[0]=mat3 args[1]=angle args[2]=axis",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int mTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int angTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int axisTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble m[3][3];
    if (!jsmn_parse_mat3_rowmajor(input, tokens, mTok, tokenCount, m)) {
      write_error_json_ex("invalid_args", "coords-vectors.rotmat expects args[0] to be a length-9 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble angle = 0.0;
    if (angTok < 0 || angTok >= tokenCount || jsmn_parse_double(input, &tokens[angTok], &angle) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.rotmat expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt axis = 0;
    parse_result axisParse = PARSE_INVALID;
    if (axisTok >= 0 && axisTok < tokenCount) {
      axisParse = jsmn_parse_int(input, &tokens[axisTok], &axis);
    }

    if (axisTok < 0 || axisTok >= tokenCount || axisParse != PARSE_OK) {
      if (axisParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "coords-vectors.rotmat expects args[2] to be an integer (SpiceInt range)",
            axisParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble out[3][3];
    rotmat_c(m, angle, axis, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in rotmat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_mat3_rowmajor(out);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_SPHREC: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "coords-vectors.sphrec expects args[0]=radius args[1]=colat args[2]=lon",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int rTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int cTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int lTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble radius = 0.0;
    SpiceDouble colat = 0.0;
    SpiceDouble lon = 0.0;

    if (rTok < 0 || rTok >= tokenCount || jsmn_parse_double(input, &tokens[rTok], &radius) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.sphrec expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (cTok < 0 || cTok >= tokenCount || jsmn_parse_double(input, &tokens[cTok], &colat) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.sphrec expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (lTok < 0 || lTok >= tokenCount || jsmn_parse_double(input, &tokens[lTok], &lon) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.sphrec expects args[2] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble rect[3];
    sphrec_c(radius, colat, lon, rect);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in sphrec", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(rect, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VADD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vadd expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vadd expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vadd_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vadd", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VCRSS: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vcrss expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vcrss expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vcrss_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vcrss", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VDOT: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vdot expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vdot expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    const SpiceDouble out = vdot_c(a, b);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vdot", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)out);
    goto done;
  }

  case CALL_VHAT: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "coords-vectors.vhat expects args[0]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int vTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vhat expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vhat_c(v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vhat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VMINUS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "coords-vectors.vminus expects args[0]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int vTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vminus expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vminus_c(v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vminus", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VNORM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "coords-vectors.vnorm expects args[0]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int vTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vnorm expects args[0] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    const SpiceDouble out = vnorm_c(v);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vnorm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%.17g}\n", (double)out);
    goto done;
  }

  case CALL_VSCL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vscl expects args[0]=number args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int sTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int vTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble s = 0.0;
    if (sTok < 0 || sTok >= tokenCount || jsmn_parse_double(input, &tokens[sTok], &s) != PARSE_OK) {
      write_error_json_ex("invalid_args", "coords-vectors.vscl expects args[0] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble v[3];
    if (!jsmn_parse_vec3(input, tokens, vTok, tokenCount, v)) {
      write_error_json_ex("invalid_args", "coords-vectors.vscl expects args[1] to be a length-3 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vscl_c(s, v, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vscl", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_VSUB: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "coords-vectors.vsub expects args[0]=vec3 args[1]=vec3", NULL, NULL, NULL, NULL);
      goto done;
    }

    int aTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int bTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble a[3];
    SpiceDouble b[3];

    if (!jsmn_parse_vec3(input, tokens, aTok, tokenCount, a) ||
        !jsmn_parse_vec3(input, tokens, bTok, tokenCount, b)) {
      write_error_json_ex("invalid_args", "coords-vectors.vsub expects vec3 args", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble out[3];
    vsub_c(a, b, out);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in vsub", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(out, 3);
    fputs("}\n", stdout);
    goto done;
  }




  // --- ephemeris --------------------------------------------------------

  case CALL_SPKEZR: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[0]=string args[1]=number args[2]=string args[3]=string args[4]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targetTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int observerTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    if (targetTok < 0 || targetTok >= tokenCount || tokens[targetTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (observerTok < 0 || observerTok >= tokenCount || tokens[observerTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[4] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkezr expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *target = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t targetErr =
        jsmn_strdup(input, &tokens[targetTok], &target, strDetail, sizeof(strDetail));
    if (targetErr != JSMN_STRDUP_OK) {
      if (targetErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      free(target);
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *observer = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t obsErr =
        jsmn_strdup(input, &tokens[observerTok], &observer, strDetail, sizeof(strDetail));
    if (obsErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      free(abcorr);
      if (obsErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkezr_c(target, et, ref, abcorr, observer, state, &lt);

    free(target);
    free(ref);
    free(abcorr);
    free(observer);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkezr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"state\":", stdout);
    json_print_double_array(state, 6);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKPOS: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[0]=string args[1]=number args[2]=string args[3]=string args[4]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targetTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int observerTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    if (targetTok < 0 || targetTok >= tokenCount || tokens[targetTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (observerTok < 0 || observerTok >= tokenCount || tokens[observerTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[4] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkpos expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *target = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t targetErr =
        jsmn_strdup(input, &tokens[targetTok], &target, strDetail, sizeof(strDetail));
    if (targetErr != JSMN_STRDUP_OK) {
      if (targetErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      free(target);
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *observer = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t obsErr =
        jsmn_strdup(input, &tokens[observerTok], &observer, strDetail, sizeof(strDetail));
    if (obsErr != JSMN_STRDUP_OK) {
      free(target);
      free(ref);
      free(abcorr);
      if (obsErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkpos_c(target, et, ref, abcorr, observer, pos, &lt);

    free(target);
    free(ref);
    free(abcorr);
    free(observer);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkpos", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"pos\":", stdout);
    json_print_double_array(pos, 3);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKEZ: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[0]=int args[1]=number args[2]=string args[3]=string args[4]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkez expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkez expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkez expects args[4] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkez_c(targ, et, ref, abcorr, obs, state, &lt);

    free(ref);
    free(abcorr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkez", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"state\":", stdout);
    json_print_double_array(state, 6);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKEZP: {
    if (tokens[argsTok].size < 5) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[0]=int args[1]=number args[2]=string args[3]=string args[4]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int abcorrTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkezp expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (abcorrTok < 0 || abcorrTok >= tokenCount || tokens[abcorrTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkezp expects args[3] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkezp expects args[4] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *abcorr = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t abcErr =
        jsmn_strdup(input, &tokens[abcorrTok], &abcorr, strDetail, sizeof(strDetail));
    if (abcErr != JSMN_STRDUP_OK) {
      free(ref);
      if (abcErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkezp_c(targ, et, ref, abcorr, obs, pos, &lt);

    free(ref);
    free(abcorr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkezp", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"pos\":", stdout);
    json_print_double_array(pos, 3);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKGEO: {
    if (tokens[argsTok].size < 4) {
      write_error_json_ex("invalid_args", "ephemeris.spkgeo expects args[0]=int args[1]=number args[2]=string args[3]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgeo expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkgeo expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkgeo expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgeo expects args[3] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    SpiceDouble lt = 0.0;
    spkgeo_c(targ, et, ref, obs, state, &lt);

    free(ref);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkgeo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"state\":", stdout);
    json_print_double_array(state, 6);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKGPS: {
    if (tokens[argsTok].size < 4) {
      write_error_json_ex("invalid_args", "ephemeris.spkgps expects args[0]=int args[1]=number args[2]=string args[3]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int obsTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgps expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkgps expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkgps expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt obs = 0;
    parse_result obsParse = PARSE_INVALID;
    if (obsTok >= 0 && obsTok < tokenCount) {
      obsParse = jsmn_parse_int(input, &tokens[obsTok], &obs);
    }

    if (obsTok < 0 || obsTok >= tokenCount || obsParse != PARSE_OK) {
      if (obsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkgps expects args[3] to be an integer (SpiceInt range)",
            obsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble pos[3] = {0};
    SpiceDouble lt = 0.0;
    spkgps_c(targ, et, ref, obs, pos, &lt);

    free(ref);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkgps", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"pos\":", stdout);
    json_print_double_array(pos, 3);
    fputs(",\"lt\":", stdout);
    fprintf(stdout, "%.17g", (double)lt);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKSSB: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "ephemeris.spkssb expects args[0]=int args[1]=number args[2]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int targTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int refTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceInt targ = 0;
    parse_result targParse = PARSE_INVALID;
    if (targTok >= 0 && targTok < tokenCount) {
      targParse = jsmn_parse_int(input, &tokens[targTok], &targ);
    }

    if (targTok < 0 || targTok >= tokenCount || targParse != PARSE_OK) {
      if (targParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkssb expects args[0] to be an integer (SpiceInt range)",
            targParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkssb expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    if (refTok < 0 || refTok >= tokenCount || tokens[refTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkssb expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *ref = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t refErr =
        jsmn_strdup(input, &tokens[refTok], &ref, strDetail, sizeof(strDetail));
    if (refErr != JSMN_STRDUP_OK) {
      if (refErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble state[6] = {0};
    spkssb_c(targ, et, ref, state);

    free(ref);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkssb", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(state, 6);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_SPKPDS: {
    if (tokens[argsTok].size < 6) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[0]=int args[1]=int args[2]=string args[3]=int args[4]=number args[5]=number", NULL, NULL, NULL, NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int centerTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int frameTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    int typeTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);
    int firstTok = jsmn_get_array_elem(tokens, argsTok, 4, tokenCount);
    int lastTok = jsmn_get_array_elem(tokens, argsTok, 5, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkpds expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceInt center = 0;
    parse_result centerParse = PARSE_INVALID;
    if (centerTok >= 0 && centerTok < tokenCount) {
      centerParse = jsmn_parse_int(input, &tokens[centerTok], &center);
    }

    if (centerTok < 0 || centerTok >= tokenCount || centerParse != PARSE_OK) {
      if (centerParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkpds expects args[1] to be an integer (SpiceInt range)",
            centerParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    if (frameTok < 0 || frameTok >= tokenCount || tokens[frameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt type = 0;
    parse_result typeParse = PARSE_INVALID;
    if (typeTok >= 0 && typeTok < tokenCount) {
      typeParse = jsmn_parse_int(input, &tokens[typeTok], &type);
    }

    if (typeTok < 0 || typeTok >= tokenCount || typeParse != PARSE_OK) {
      if (typeParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spkpds expects args[3] to be an integer (SpiceInt range)",
            typeParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble first = 0.0;
    if (firstTok < 0 || firstTok >= tokenCount || jsmn_parse_double(input, &tokens[firstTok], &first) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[4] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceDouble last = 0.0;
    if (lastTok < 0 || lastTok >= tokenCount || jsmn_parse_double(input, &tokens[lastTok], &last) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spkpds expects args[5] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *frame = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t frameErr =
        jsmn_strdup(input, &tokens[frameTok], &frame, strDetail, sizeof(strDetail));
    if (frameErr != JSMN_STRDUP_OK) {
      if (frameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble descr[5] = {0};
    spkpds_c(body, center, frame, type, first, last, descr);

    free(frame);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkpds", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_double_array(descr, 5);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_SPKUDS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "ephemeris.spkuds expects args[0]=descr5", NULL, NULL, NULL, NULL);
      goto done;
    }

    int descrTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    SpiceDouble descr[5] = {0};
    if (!jsmn_parse_double_array_fixed(input, tokens, descrTok, tokenCount, 5, descr)) {
      write_error_json_ex("invalid_args", "ephemeris.spkuds expects args[0] to be a length-5 array of numbers", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt body = 0;
    SpiceInt center = 0;
    SpiceInt frame = 0;
    SpiceInt type = 0;
    SpiceDouble first = 0.0;
    SpiceDouble last = 0.0;
    SpiceInt baddr = 0;
    SpiceInt eaddr = 0;

    spkuds_c(descr, &body, &center, &frame, &type, &first, &last, &baddr, &eaddr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spkuds", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"body\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)body);
    fputs(",\"center\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)center);
    fputs(",\"frame\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)frame);
    fputs(",\"type\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)type);
    fputs(",\"first\":", stdout);
    fprintf(stdout, "%.17g", (double)first);
    fputs(",\"last\":", stdout);
    fprintf(stdout, "%.17g", (double)last);
    fputs(",\"baddr\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)baddr);
    fputs(",\"eaddr\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)eaddr);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_SPKSFS: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "ephemeris.spksfs expects args[0]=int args[1]=number", NULL, NULL, NULL, NULL);
      goto done;
    }

    int bodyTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int etTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt body = 0;
    parse_result bodyParse = PARSE_INVALID;
    if (bodyTok >= 0 && bodyTok < tokenCount) {
      bodyParse = jsmn_parse_int(input, &tokens[bodyTok], &body);
    }

    if (bodyTok < 0 || bodyTok >= tokenCount || bodyParse != PARSE_OK) {
      if (bodyParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "ephemeris.spksfs expects args[0] to be an integer (SpiceInt range)",
            bodyParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    SpiceDouble et = 0.0;
    if (etTok < 0 || etTok >= tokenCount || jsmn_parse_double(input, &tokens[etTok], &et) != PARSE_OK) {
      write_error_json_ex("invalid_args", "ephemeris.spksfs expects args[1] to be a number", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt handle = 0;
    SpiceDouble descr[5] = {0};
    SpiceChar ident[41];
    ident[0] = '\0';
    SpiceBoolean found = SPICEFALSE;

    spksfs_c(body, et, (SpiceInt)sizeof(ident), &handle, descr, ident, &found);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in spksfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    trim_fixed_width_c_string_end(ident, sizeof(ident));

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"handle\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)handle);
    fputs(",\"descr\":", stdout);
    json_print_double_array(descr, 5);
    fputs(",\"ident\":\"", stdout);
    json_print_escaped(ident);
    fputs("\"}}\n", stdout);
    goto done;
  }


  case CALL_FILE_IO_EXISTS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.exists expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.exists expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.exists expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    const SpiceBoolean fileExists = exists_c(filePath);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in exists", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"exists\":", stdout);
    fputs(fileExists == SPICETRUE ? "true" : "false", stdout);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_GETFAT: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.getfat expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.getfat expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.getfat expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceChar arch[32];
    SpiceChar type[32];
    arch[0] = '\0';
    type[0] = '\0';

    getfat_c(filePath, (SpiceInt)sizeof(arch), (SpiceInt)sizeof(type), arch, type);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in getfat", shortMsg, longMsg, traceMsg);
      goto done;
    }

    trim_fixed_width_c_string_end(arch, sizeof(arch));
    trim_fixed_width_c_string_end(type, sizeof(type));

    fputs("{\"ok\":true,\"result\":{\"arch\":\"", stdout);
    json_print_escaped(arch);
    fputs("\",\"type\":\"", stdout);
    json_print_escaped(type);
    fputs("\"}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFOPR: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dafopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dafopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dafopr expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"opened\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFCLS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dafcls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dafcls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dafcls expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"closed\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFBFS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dafbfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dafbfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dafbfs expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafbfs_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafbfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"searchStarted\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DAFFNA: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.daffna expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.daffna expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.daffna expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dafopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafbfs_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafbfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceBoolean found = SPICEFALSE;
    daffna_c(&found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in daffna", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dafcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dafcls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":", stdout);
    fputs(found == SPICETRUE ? "true" : "false", stdout);
    fputs("}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DASOPR: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dasopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dasopr expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dasopr expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"opened\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DASCLS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dascls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dascls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dascls expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"closed\":true}}\n", stdout);
    goto done;
  }

  case CALL_FILE_IO_DLAOPN: {
    if (tokens[argsTok].size < 4) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[0]=string args[1]=string args[2]=string args[3]=int", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int tagTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int ftypeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    const int ifnameTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);
    const int ncomchTok = jsmn_get_array_elem(tokens, argsTok, 3, tokenCount);

    if (tagTok < 0 || tagTok >= tokenCount || tokens[tagTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (ftypeTok < 0 || ftypeTok >= tokenCount || tokens[ftypeTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[1] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (ifnameTok < 0 || ifnameTok >= tokenCount || tokens[ifnameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt ncomch = 0;
    char detail[256] = {0};
    if (!parse_spiceint_arg(input, tokens, tokenCount, ncomchTok,
                            "file-io.dlaopn args[3]", &ncomch,
                            detail, sizeof(detail))) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[3] to be an integer (SpiceInt range)", detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (ncomch < 0) {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[3] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *tag = NULL;
    char *ftype = NULL;
    char *ifname = NULL;

    strDetail[0] = '\0';
    jsmn_strdup_err_t tagErr =
        jsmn_strdup(input, &tokens[tagTok], &tag, strDetail, sizeof(strDetail));
    if (tagErr != JSMN_STRDUP_OK) {
      if (tagErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t ftypeErr =
        jsmn_strdup(input, &tokens[ftypeTok], &ftype, strDetail, sizeof(strDetail));
    if (ftypeErr != JSMN_STRDUP_OK) {
      if (ftypeErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(tag);
      goto done;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t ifnameErr =
        jsmn_strdup(input, &tokens[ifnameTok], &ifname, strDetail, sizeof(strDetail));
    if (ifnameErr != JSMN_STRDUP_OK) {
      if (ifnameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(tag);
      free(ftype);
      goto done;
    }

    if (tag[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlaopn expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(tag);
      free(ftype);
      free(ifname);
      goto done;
    }

    char tempPath[PATH_MAX];
    int tempFd = -1;
    if (!build_file_io_temp_path(tag, ".dla", tempPath, sizeof(tempPath), &tempFd,
                                 detail, sizeof(detail))) {
      write_error_json_ex("invalid_request", "Failed to create temporary DLA path",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
      free(tag);
      free(ftype);
      free(ifname);
      goto done;
    }

    if (tempFd >= 0) {
      close(tempFd);
      tempFd = -1;
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    dlaopn_c(tempPath, ftype, ifname, ncomch, &handle);

    free(tag);
    free(ftype);
    free(ifname);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(tempPath);
      write_error_json("SPICE error in dlaopn", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr descr;
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &descr, &found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(tempPath);
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dlacls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(tempPath);
      write_error_json("SPICE error in dlacls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (tempFd >= 0) {
      close(tempFd);
    }
    unlink(tempPath);

    write_found_dla_descriptor_json(&descr, found);
    goto done;
  }

  case CALL_FILE_IO_DLABFS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dlabfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlabfs expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlabfs expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr descr;
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &descr, &found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    write_found_dla_descriptor_json(&descr, found);
    goto done;
  }

  case CALL_FILE_IO_DLAFNS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dlafns expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlafns expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlafns expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr firstDescr;
    SpiceBoolean firstFound = SPICEFALSE;
    dlabfs_c(handle, &firstDescr, &firstFound);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      goto done;
    }

    SpiceDLADescr nextDescr = {0};
    SpiceBoolean nextFound = SPICEFALSE;
    if (firstFound == SPICETRUE) {
      dlafns_c(handle, &firstDescr, &nextFound, &nextDescr);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                            sizeof(traceMsg));
        write_error_json("SPICE error in dlafns", shortMsg, longMsg, traceMsg);
        goto done;
      }
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    write_found_dla_descriptor_json(&nextDescr, nextFound);
    goto done;
  }

  case CALL_FILE_IO_DLACLS: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "file-io.dlacls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    const int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "file-io.dlacls expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *filePath = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &filePath, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    if (filePath[0] == '\0') {
      write_error_json_ex("invalid_args", "file-io.dlacls expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      free(filePath);
      goto done;
    }

    SpiceInt handle = 0;
    dasopr_c(filePath, &handle);
    free(filePath);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      goto done;
    }

    dlacls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dlacls", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"closed\":true}}\n", stdout);
    goto done;
  }

  case CALL_CELLS_WINDOWS_INSRTI: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[0]=integer item args[1]=int recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceInt item = 0;
    RunnerCellRecipe recipe;
    char detail[256] = {0};

    if (!parse_spiceint_arg(input, tokens, tokenCount, itemTok,
                            "cells-windows.insrti args[0]", &item,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[0] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[1] to be an int recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_INT) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrti expects args[1] to be [\"int\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.insrti setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.insrti could not allocate transient int cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrti_c(item, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in insrti_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outCard = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.insrti)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outSize = size_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.insrti)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_INSRTD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[0]=number item args[1]=double recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    SpiceDouble item = 0.0;
    parse_result itemParse = PARSE_INVALID;
    if (itemTok >= 0 && itemTok < tokenCount) {
      itemParse = jsmn_parse_double(input, &tokens[itemTok], &item);
    }
    if (itemTok < 0 || itemTok >= tokenCount || itemParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[0] to be a number",
          itemParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (itemParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL, NULL, NULL);
      goto done;
    }

    RunnerCellRecipe recipe;
    char detail[256] = {0};
    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[1] to be a double recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_DOUBLE) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtd expects args[1] to be [\"double\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.insrtd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.insrtd could not allocate transient double cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrtd_c(item, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in insrtd_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outCard = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.insrtd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outSize = size_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.insrtd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_INSRTC: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtc expects args[0]=string item args[1]=char recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int itemTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (itemTok < 0 || itemTok >= tokenCount || tokens[itemTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args",
                          "cells-windows.insrtc expects args[0] to be a string",
                          NULL, NULL, NULL, NULL);
      goto done;
    }

    char *item = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t itemErr =
        jsmn_strdup(input, &tokens[itemTok], &item, strDetail, sizeof(strDetail));
    if (itemErr != JSMN_STRDUP_OK) {
      if (itemErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    RunnerCellRecipe recipe;
    char detail[256] = {0};
    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtc expects args[1] to be a char recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      free(item);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_CHAR) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.insrtc expects args[1] to be [\"char\",size,length]",
          NULL, NULL, NULL, NULL);
      free(item);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.insrtc setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.insrtc could not allocate transient char cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      free(item);
      goto done;
    }

    insrtc_c(item, cell);
    free(item);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in insrtc_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outCard = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.insrtc)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt outSize = size_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.insrtc)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_CELL_GETI: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[0]=int recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[0] to be an int recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_INT) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[0] to be [\"int\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.cellGeti args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGeti expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.cellGeti setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.cellGeti could not allocate transient int cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrti_c(3, cell);
    insrti_c(1, cell);
    insrti_c(2, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.cellGeti", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt card = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.cellGeti)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.cellGeti index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(cell);
      goto done;
    }

    SpiceInt item = 0;
    SPICE_CELL_GET_I(cell, index, &item);

    fputs("{\"ok\":true,\"result\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)item);
    fputs("}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_CELL_GETD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[0]=double recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[0] to be a double recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_DOUBLE) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[0] to be [\"double\",size]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.cellGetd args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetd expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.cellGetd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.cellGetd could not allocate transient double cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrtd_c(3.25, cell);
    insrtd_c(-1.0, cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.cellGetd", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt card = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.cellGetd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.cellGetd index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(cell);
      goto done;
    }

    SpiceDouble item = 0.0;
    SPICE_CELL_GET_D(cell, index, &item);

    fputs("{\"ok\":true,\"result\":", stdout);
    fprintf(stdout, "%.17g", (double)item);
    fputs("}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_CELL_GETC: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[0]=char recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[0] to be a char recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_CHAR) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[0] to be [\"char\",size,length]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.cellGetc args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.cellGetc expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *cell = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &cell, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.cellGetc setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.cellGetc could not allocate transient char cell",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    insrtc_c("b", cell);
    insrtc_c("a", cell);
    insrtc_c("c", cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.cellGetc", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    const SpiceInt card = card_c(cell);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in card_c (cells-windows.cellGetc)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(cell);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.cellGetc index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(cell);
      goto done;
    }

    SpiceChar item[4096];
    item[0] = '\0';
    SPICE_CELL_GET_C(cell, index, (SpiceInt)sizeof(item), item);

    fputs("{\"ok\":true,\"result\":\"", stdout);
    json_print_escaped(item);
    fputs("\"}\n", stdout);

    runner_free_allocated_cell(cell);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNINSD: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[0]=number left args[1]=number right args[2]=window recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int leftTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int rightTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceDouble left = 0.0;
    SpiceDouble right = 0.0;
    parse_result leftParse = PARSE_INVALID;
    parse_result rightParse = PARSE_INVALID;

    if (leftTok >= 0 && leftTok < tokenCount) {
      leftParse = jsmn_parse_double(input, &tokens[leftTok], &left);
    }
    if (leftTok < 0 || leftTok >= tokenCount || leftParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[0] to be a number",
          leftParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (leftParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL, NULL, NULL);
      goto done;
    }

    if (rightTok >= 0 && rightTok < tokenCount) {
      rightParse = jsmn_parse_double(input, &tokens[rightTok], &right);
    }
    if (rightTok < 0 || rightTok >= tokenCount || rightParse != PARSE_OK) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[1] to be a number",
          rightParse == PARSE_TOO_LONG
              ? "numeric literal too long"
              : (rightParse == PARSE_OUT_OF_RANGE ? "numeric literal out of range" : NULL),
          NULL, NULL, NULL);
      goto done;
    }

    RunnerCellRecipe recipe;
    char detail[256] = {0};
    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[2] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wninsd expects args[2] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wninsd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wninsd could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wninsd_c(left, right, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wninsd_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt card = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wninsd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    if (card > 0) {
      SpiceDouble firstLeft = 0.0;
      SpiceDouble firstRight = 0.0;
      wnfetd_c(window, 0, &firstLeft, &firstRight);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in wnfetd_c (cells-windows.wninsd)", shortMsg,
                         longMsg, traceMsg);
        runner_free_allocated_cell(window);
        goto done;
      }

      fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
      fprintf(stdout, "%" PRIdMAX, (intmax_t)card);
      fputs(",\"first\":[", stdout);
      fprintf(stdout, "%.17g", (double)firstLeft);
      fputs(",", stdout);
      fprintf(stdout, "%.17g", (double)firstRight);
      fputs("]}}\n", stdout);
    } else {
      fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
      fprintf(stdout, "%" PRIdMAX, (intmax_t)card);
      fputs("}}\n", stdout);
    }

    runner_free_allocated_cell(window);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNCARD: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wncard expects args[0]=window recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    RunnerCellRecipe recipe;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wncard expects args[0] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wncard expects args[0] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wncard setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wncard could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wninsd_c(0.0, 1.0, window);
    wninsd_c(2.0, 3.0, window);
    wninsd_c(0.5, 2.5, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.wncard", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt card = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wncard)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)card);
    fputs("}\n", stdout);

    runner_free_allocated_cell(window);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNFETD: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[0]=window recipe tuple args[1]=integer index",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int indexTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    RunnerCellRecipe recipe;
    SpiceInt index = 0;
    char detail[256] = {0};

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[0] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[0] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, indexTok,
                            "cells-windows.wnfetd args[1]", &index,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnfetd expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wnfetd setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wnfetd could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wninsd_c(0.0, 1.0, window);
    wninsd_c(2.0, 3.0, window);
    wninsd_c(0.5, 2.5, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error while priming cells-windows.wnfetd", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt card = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wnfetd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    if (index < 0 || index >= card) {
      write_error_json_ex("invalid_args",
                          "cells-windows.wnfetd index out of range",
                          NULL, NULL, NULL, NULL);
      runner_free_allocated_cell(window);
      goto done;
    }

    SpiceDouble left = 0.0;
    SpiceDouble right = 0.0;
    wnfetd_c(window, index, &left, &right);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wnfetd_c (cells-windows.wnfetd)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":[", stdout);
    fprintf(stdout, "%.17g", (double)left);
    fputs(",", stdout);
    fprintf(stdout, "%.17g", (double)right);
    fputs("]}\n", stdout);

    runner_free_allocated_cell(window);
    goto done;
  }

  case CALL_CELLS_WINDOWS_WNVALD: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[0]=integer size args[1]=integer n args[2]=window recipe tuple",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    const int sizeTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    const int nTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    const int recipeTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    SpiceInt size = 0;
    SpiceInt n = 0;
    RunnerCellRecipe recipe;
    char detail[256] = {0};

    if (!parse_spiceint_arg(input, tokens, tokenCount, sizeTok,
                            "cells-windows.wnvald args[0]", &size,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[0] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_spiceint_arg(input, tokens, tokenCount, nTok,
                            "cells-windows.wnvald args[1]", &n,
                            detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[1] to be an integer (SpiceInt range)",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (!parse_cells_windows_recipe(input, tokens, tokenCount, recipeTok,
                                    &recipe, detail, sizeof(detail))) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[2] to be a window recipe tuple",
          detail[0] ? detail : NULL, NULL, NULL, NULL);
      goto done;
    }

    if (recipe.kind != RUNNER_CELL_RECIPE_WINDOW) {
      write_error_json_ex(
          "invalid_args",
          "cells-windows.wnvald expects args[2] to be [\"window\",maxIntervals]",
          NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceCell *window = NULL;
    bool isWindow = false;
    if (!runner_alloc_cell_from_recipe(&recipe, &window, &isWindow, detail,
                                       sizeof(detail))) {
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                            traceMsg, sizeof(traceMsg));
        write_error_json("SPICE error in cells-windows.wnvald setup", shortMsg,
                         longMsg, traceMsg);
      } else {
        write_error_json_ex(
            "invalid_args",
            "cells-windows.wnvald could not allocate transient window",
            detail[0] ? detail : NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    wnvald_c(size, n, window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wnvald_c", shortMsg, longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt outCard = wncard_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in wncard_c (cells-windows.wnvald)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    const SpiceInt outSize = size_c(window);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in size_c (cells-windows.wnvald)", shortMsg,
                       longMsg, traceMsg);
      runner_free_allocated_cell(window);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":{\"card\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outCard);
    fputs(",\"size\":", stdout);
    fprintf(stdout, "%" PRIdMAX, (intmax_t)outSize);
    fputs("}}\n", stdout);

    runner_free_allocated_cell(window);
    goto done;
  }


  // --- kernels ----------------------------------------------------------

  case CALL_KERNELS_FURNSH: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.furnsh expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.furnsh expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *path = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &path, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    furnsh_c(path);
    free(path);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in furnsh", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_KERNELS_UNLOAD: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.unload expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.unload expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *path = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &path, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    unload_c(path);
    free(path);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in unload", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_KERNELS_KCLEAR: {
    if (tokens[argsTok].size > 0) {
      write_error_json_ex("invalid_args", "kernels.kclear expects no arguments", NULL, NULL, NULL, NULL);
      goto done;
    }

    kclear_c();

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kclear", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_KERNELS_KTOTAL: {
    const char *kind = "ALL";
    char *kindAlloc = NULL;

    if (tokens[argsTok].size >= 1) {
      int kindTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
      if (kindTok < 0 || kindTok >= tokenCount || tokens[kindTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_args", "kernels.ktotal expects args[0] to be a string", NULL, NULL, NULL, NULL);
        goto done;
      }

      strDetail[0] = '\0';
      jsmn_strdup_err_t kindErr =
          jsmn_strdup(input, &tokens[kindTok], &kindAlloc, strDetail, sizeof(strDetail));
      if (kindErr != JSMN_STRDUP_OK) {
        if (kindErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }
      kind = kindAlloc;
    }

    SpiceInt count = 0;
    ktotal_c(kind, &count);
    free(kindAlloc);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in ktotal", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fprintf(stdout, "{\"ok\":true,\"result\":%" PRIdMAX "}\n", (intmax_t)count);
    goto done;
  }

  case CALL_KERNELS_KDATA: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex(
          "invalid_args",
          "kernels.kdata expects args[0]=integer (SpiceInt range) args[1]=string?",
          NULL,
          NULL,
          NULL,
          NULL);
      goto done;
    }

    int whichTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);

    SpiceInt which = 0;
    parse_result whichParse = PARSE_INVALID;
    if (whichTok >= 0 && whichTok < tokenCount) {
      whichParse = jsmn_parse_int(input, &tokens[whichTok], &which);
    }

    if (whichTok < 0 || whichTok >= tokenCount || whichParse != PARSE_OK) {
      if (whichParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "kernels.kdata expects args[0] to be an integer (SpiceInt range)",
            whichParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    const char *kind = "ALL";
    char *kindAlloc = NULL;
    if (tokens[argsTok].size >= 2) {
      int kindTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
      if (kindTok < 0 || kindTok >= tokenCount || tokens[kindTok].type != JSMN_STRING) {
        write_error_json_ex(
            "invalid_args",
            "kernels.kdata expects args[1] to be a string",
            NULL,
            NULL,
            NULL,
            NULL);
        goto done;
      }

      strDetail[0] = '\0';
      jsmn_strdup_err_t kindErr =
          jsmn_strdup(input, &tokens[kindTok], &kindAlloc, strDetail, sizeof(strDetail));
      if (kindErr != JSMN_STRDUP_OK) {
        if (kindErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }
      kind = kindAlloc;
    }

    char file[2048];
    char filtyp[2048];
    char source[2048];
    file[0] = '\0';
    filtyp[0] = '\0';
    source[0] = '\0';

    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;

    kdata_c(
        which,
        kind,
        (SpiceInt)sizeof(file),
        (SpiceInt)sizeof(filtyp),
        (SpiceInt)sizeof(source),
        file,
        filtyp,
        source,
        &handle,
        &found);

    free(kindAlloc);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kdata", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    trim_fixed_width_c_string_end(file, sizeof(file));
    trim_fixed_width_c_string_end(filtyp, sizeof(filtyp));
    trim_fixed_width_c_string_end(source, sizeof(source));

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"file\":\"", stdout);
    json_print_escaped(file);
    fputs("\",\"filtyp\":\"", stdout);
    json_print_escaped(filtyp);
    fputs("\",\"source\":\"", stdout);
    json_print_escaped(source);
    fprintf(stdout, "\",\"handle\":%" PRIdMAX "}}\n", (intmax_t)handle);
    goto done;
  }

  case CALL_KERNELS_KINFO: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.kinfo expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int pathTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (pathTok < 0 || pathTok >= tokenCount || tokens[pathTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.kinfo expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *path = NULL;
    strDetail[0] = '\0';
    jsmn_strdup_err_t pathErr =
        jsmn_strdup(input, &tokens[pathTok], &path, strDetail, sizeof(strDetail));
    if (pathErr != JSMN_STRDUP_OK) {
      if (pathErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char filtyp[2048];
    char source[2048];
    filtyp[0] = '\0';
    source[0] = '\0';

    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;

    kinfo_c(
        path,
        (SpiceInt)sizeof(filtyp),
        (SpiceInt)sizeof(source),
        filtyp,
        source,
        &handle,
        &found);

    free(path);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kinfo", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    trim_fixed_width_c_string_end(filtyp, sizeof(filtyp));
    trim_fixed_width_c_string_end(source, sizeof(source));

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"filtyp\":\"", stdout);
    json_print_escaped(filtyp);
    fputs("\",\"source\":\"", stdout);
    json_print_escaped(source);
    fprintf(stdout, "\",\"handle\":%" PRIdMAX "}}\n", (intmax_t)handle);
    goto done;
  }

  case CALL_KERNELS_KXTRCT: {
    // Single cleanup path to avoid leaks across early exits.
    char *keywdRaw = NULL;
    char *wordsqRaw = NULL;
    char *keywd = NULL;
    char **terms = NULL;
    int nTermsRaw = 0;
    int nTerms = 0;
    int termlen = 2;
    char *termsBuf = NULL;
    char *wordsqOut = NULL;
    char *substr = NULL;

    if (tokens[argsTok].size < 3) {
      write_error_json_ex(
          "invalid_args",
          "kernels.kxtrct expects args[0]=string args[1]=string[] args[2]=string",
          NULL,
          NULL,
          NULL,
          NULL);
      goto kxtrct_cleanup;
    }

    int keywdTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int termsTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int wordsqTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (keywdTok < 0 || keywdTok >= tokenCount || tokens[keywdTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }
    if (termsTok < 0 || termsTok >= tokenCount || tokens[termsTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }
    if (wordsqTok < 0 || wordsqTok >= tokenCount || tokens[wordsqTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[2] to be a string", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t keywdErr =
        jsmn_strdup(input, &tokens[keywdTok], &keywdRaw, strDetail, sizeof(strDetail));
    if (keywdErr != JSMN_STRDUP_OK) {
      if (keywdErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto kxtrct_cleanup;
    }

    strDetail[0] = '\0';
    jsmn_strdup_err_t wordsqErr =
        jsmn_strdup(input, &tokens[wordsqTok], &wordsqRaw, strDetail, sizeof(strDetail));
    if (wordsqErr != JSMN_STRDUP_OK) {
      if (wordsqErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto kxtrct_cleanup;
    }

    // Trim keywd.
    size_t keyStart = 0;
    size_t keyLen = strlen(keywdRaw);
    while (keyStart < keyLen && is_ascii_whitespace((unsigned char)keywdRaw[keyStart])) {
      keyStart++;
    }
    size_t keyEnd = keyLen;
    while (keyEnd > keyStart && is_ascii_whitespace((unsigned char)keywdRaw[keyEnd - 1])) {
      keyEnd--;
    }

    const size_t keyOutLen = keyEnd - keyStart;
    if (keyOutLen == 0) {
      write_error_json_ex("invalid_args", "kernels.kxtrct expects args[0] to be a non-empty string", NULL, NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }

    keywd = (char *)malloc(keyOutLen + 1);
    if (keywd == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }
    memcpy(keywd, keywdRaw + keyStart, keyOutLen);
    keywd[keyOutLen] = '\0';

    // Terms are an array of strings; trim each entry and ignore whitespace-only terms.
    nTermsRaw = tokens[termsTok].size;
    if (nTermsRaw > 0) {
      terms = (char **)calloc((size_t)nTermsRaw, sizeof(char *));
      if (terms == NULL) {
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }
    }

    for (int i = 0; i < nTermsRaw; i++) {
      int tTok = jsmn_get_array_elem(tokens, termsTok, i, tokenCount);
      if (tTok < 0 || tTok >= tokenCount || tokens[tTok].type != JSMN_STRING) {
        write_error_json_ex("invalid_args", "kernels.kxtrct expects args[1] to contain only strings", NULL, NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }

      char *tRaw = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t tErr =
          jsmn_strdup(input, &tokens[tTok], &tRaw, strDetail, sizeof(strDetail));
      if (tErr != JSMN_STRDUP_OK) {
        if (tErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto kxtrct_cleanup;
      }

      // Trim term.
      size_t tLen = strlen(tRaw);
      size_t tStart = 0;
      while (tStart < tLen && is_ascii_whitespace((unsigned char)tRaw[tStart])) {
        tStart++;
      }
      size_t tEnd = tLen;
      while (tEnd > tStart && is_ascii_whitespace((unsigned char)tRaw[tEnd - 1])) {
        tEnd--;
      }

      const size_t tOutLen = tEnd - tStart;
      if (tOutLen == 0) {
        free(tRaw);
        continue;
      }

      char *t = (char *)malloc(tOutLen + 1);
      if (t == NULL) {
        free(tRaw);
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }
      memcpy(t, tRaw + tStart, tOutLen);
      t[tOutLen] = '\0';
      free(tRaw);

      terms[nTerms++] = t;
      if (tOutLen + 1 > (size_t)termlen) {
        termlen = (int)(tOutLen + 1);
      }
    }

    if (nTerms > 0) {
      termsBuf = (char *)calloc((size_t)nTerms * (size_t)termlen, 1);
      if (termsBuf == NULL) {
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto kxtrct_cleanup;
      }
      for (int i = 0; i < nTerms; i++) {
        // Each term occupies a fixed-width slice of length `termlen` (NUL padded).
        strncpy(termsBuf + (size_t)i * (size_t)termlen, terms[i], (size_t)termlen - 1);
      }
    }

    const int wordsqLen = (int)strlen(wordsqRaw);
    const int wordsqOutMaxBytes = wordsqLen + 1 < 2 ? 2 : wordsqLen + 1;
    const int substrMaxBytes = wordsqLen + 1 < 2 ? 2 : wordsqLen + 1;

    wordsqOut = (char *)calloc((size_t)wordsqOutMaxBytes, 1);
    substr = (char *)calloc((size_t)substrMaxBytes, 1);
    if (wordsqOut == NULL || substr == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto kxtrct_cleanup;
    }

    strncpy(wordsqOut, wordsqRaw, (size_t)wordsqOutMaxBytes - 1);

    SpiceBoolean found = SPICEFALSE;
    kxtrct_c(
        keywd,
        (SpiceInt)termlen,
        (ConstSpiceChar *)termsBuf,
        (SpiceInt)nTerms,
        (SpiceInt)wordsqOutMaxBytes,
        (SpiceInt)substrMaxBytes,
        wordsqOut,
        &found,
        substr);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kxtrct", shortMsg, longMsg, traceMsg);
      goto kxtrct_cleanup;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto kxtrct_cleanup;
    }

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"wordsq\":\"", stdout);
    json_print_escaped(wordsqOut);
    fputs("\",\"substr\":\"", stdout);
    json_print_escaped(substr);
    fputs("\"}}\n", stdout);
    goto kxtrct_cleanup;

  kxtrct_cleanup:
    if (terms != NULL) {
      for (int j = 0; j < nTerms; j++) {
        free(terms[j]);
      }
      free(terms);
    }
    free(keywdRaw);
    free(wordsqRaw);
    free(keywd);
    free(termsBuf);
    free(wordsqOut);
    free(substr);
    goto done;
  }

  case CALL_KERNELS_KPLFRM: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernels.kplfrm expects args[0]=integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      goto done;
    }

    int frmclsTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);

    SpiceInt frmcls = 0;
    parse_result frmclsParse = PARSE_INVALID;
    if (frmclsTok >= 0 && frmclsTok < tokenCount) {
      frmclsParse = jsmn_parse_int(input, &tokens[frmclsTok], &frmcls);
    }

    if (frmclsTok < 0 || frmclsTok >= tokenCount || frmclsParse != PARSE_OK) {
      if (frmclsParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex(
            "invalid_args",
            "kernels.kplfrm expects args[0] to be an integer (SpiceInt range)",
            frmclsParse == PARSE_TOO_LONG ? "numeric literal too long" : NULL,
            NULL,
            NULL,
            NULL);
      }
      goto done;
    }

    // Use a fixed-capacity set cell for parity comparisons.
    SPICEINT_CELL(idset, 1024);
    kplfrm_c(frmcls, &idset);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in kplfrm", shortMsg, longMsg, traceMsg);
      goto done;
    }

    const SpiceInt n = card_c(&idset);
    fputs("{\"ok\":true,\"result\":", stdout);
    json_print_spiceint_array((const SpiceInt *)idset.data, (int)n);
    fputs("}\n", stdout);
    goto done;
  }
  // --- kernel-pool ------------------------------------------------------

  case CALL_GDPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gdpool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / sizeof(SpiceDouble));
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gdpool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceDouble *values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)room);
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gdpool_c(name, start, room, &nOut, values, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gdpool", shortMsg, longMsg, traceMsg);
      free(values);
      goto done;
    }

    if (found != SPICETRUE) {
      free(values);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":", stdout);
    json_print_double_array(values, (int)nOut);
    fputs("}}\n", stdout);
    free(values);
    goto done;
  }

  case CALL_GIPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gipool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / sizeof(SpiceInt));
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gipool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt *values = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)room);
    if (values == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gipool_c(name, start, room, &nOut, values, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gipool", shortMsg, longMsg, traceMsg);
      free(values);
      goto done;
    }

    if (found != SPICETRUE) {
      free(values);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":", stdout);
    json_print_spiceint_array(values, (int)nOut);
    fputs("}}\n", stdout);
    free(values);
    goto done;
  }

  case CALL_GCPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gcpool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / (size_t)KPOOL_STRING_MAX_BYTES);
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gcpool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *cvals = (char *)calloc((size_t)room, (size_t)KPOOL_STRING_MAX_BYTES);
    if (cvals == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gcpool_c(name, start, room, (SpiceInt)KPOOL_STRING_MAX_BYTES, &nOut, cvals, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gcpool", shortMsg, longMsg, traceMsg);
      free(cvals);
      goto done;
    }

    if (found != SPICETRUE) {
      free(cvals);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":[", stdout);
    for (SpiceInt i = 0; i < nOut; i++) {
      if (i != 0) {
        fputc(',', stdout);
      }
      char *s = cvals + (size_t)i * (size_t)KPOOL_STRING_MAX_BYTES;
      trim_fixed_width_c_string_end(s, (size_t)KPOOL_STRING_MAX_BYTES);
      fputc('"', stdout);
      json_print_escaped(s);
      fputc('"', stdout);
    }
    fputs("]}}\n", stdout);
    free(cvals);
    goto done;
  }

  case CALL_GNPOOL: {
    if (tokens[argsTok].size < 3) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[0]=string args[1]=integer args[2]=integer", NULL, NULL, NULL, NULL);
      goto done;
    }

    int templTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int startTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);
    int roomTok = jsmn_get_array_elem(tokens, argsTok, 2, tokenCount);

    if (templTok < 0 || templTok >= tokenCount || tokens[templTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    SpiceInt start = 0;
    parse_result startParse = PARSE_INVALID;
    if (startTok >= 0 && startTok < tokenCount) {
      startParse = jsmn_parse_int(input, &tokens[startTok], &start);
    }
    if (startTok < 0 || startTok >= tokenCount || startParse != PARSE_OK) {
      if (startParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[1] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceInt room = 0;
    parse_result roomParse = PARSE_INVALID;
    if (roomTok >= 0 && roomTok < tokenCount) {
      roomParse = jsmn_parse_int(input, &tokens[roomTok], &room);
    }
    if (roomTok < 0 || roomTok >= tokenCount || roomParse != PARSE_OK) {
      if (roomParse == PARSE_UNSUPPORTED) {
        write_unsupported_spiceint_width_error();
      } else {
        write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[2] to be an integer (SpiceInt range)", NULL, NULL, NULL, NULL);
      }
      goto done;
    }

    if (start < 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[1] to be >= 0", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (room <= 0) {
      write_error_json_ex("invalid_args", "kernel-pool.gnpool expects args[2] to be > 0", NULL, NULL, NULL, NULL);
      goto done;
    }

    const size_t maxRoom = (size_t)(CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES / (size_t)KPOOL_NAME_MAX_BYTES);
    if ((size_t)room > maxRoom) {
      char msg[256];
      snprintf(msg, sizeof(msg),
               "kernel-pool.gnpool args[2]=room too large (max %zu)", maxRoom);
      write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
      goto done;
    }

    char *templ = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t templErr =
        jsmn_strdup(input, &tokens[templTok], &templ, strDetail, sizeof(strDetail));
    if (templErr != JSMN_STRDUP_OK) {
      if (templErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    char *cvals = (char *)calloc((size_t)room, (size_t)KPOOL_NAME_MAX_BYTES);
    if (cvals == NULL) {
      free(templ);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    SpiceInt nOut = 0;
    SpiceBoolean found = SPICEFALSE;
    gnpool_c(templ, start, room, (SpiceInt)KPOOL_NAME_MAX_BYTES, &nOut, cvals, &found);
    free(templ);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in gnpool", shortMsg, longMsg, traceMsg);
      free(cvals);
      goto done;
    }

    if (found != SPICETRUE) {
      free(cvals);
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    if (nOut < 0) nOut = 0;
    if (nOut > room) nOut = room;

    fputs("{\"ok\":true,\"result\":{\"found\":true,\"values\":[", stdout);
    for (SpiceInt i = 0; i < nOut; i++) {
      if (i != 0) {
        fputc(',', stdout);
      }
      char *s = cvals + (size_t)i * (size_t)KPOOL_NAME_MAX_BYTES;
      trim_fixed_width_c_string_end(s, (size_t)KPOOL_NAME_MAX_BYTES);
      fputc('"', stdout);
      json_print_escaped(s);
      fputc('"', stdout);
    }
    fputs("]}}\n", stdout);
    free(cvals);
    goto done;
  }

  case CALL_DTPOOL: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernel-pool.dtpool expects args[0]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.dtpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceBoolean found = SPICEFALSE;
    SpiceInt nOut = 0;
    SpiceChar typeOut[2];
    typeOut[0] = 'X';
    typeOut[1] = '\0';

    dtpool_c(name, &found, &nOut, typeOut);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in dtpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    if (found != SPICETRUE) {
      fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
      goto done;
    }

    fprintf(stdout,
            "{\"ok\":true,\"result\":{\"found\":true,\"n\":%" PRIdMAX ",\"type\":\"%c\"}}\n",
            (intmax_t)nOut,
            (char)typeOut[0]);
    goto done;
  }

  case CALL_PDPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[0]=string args[1]=number[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int valuesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (valuesTok < 0 || valuesTok >= tokenCount || tokens[valuesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    const int nVals = tokens[valuesTok].size;
    SpiceDouble *values = NULL;
    if (nVals > 0) {
      values = (SpiceDouble *)malloc(sizeof(SpiceDouble) * (size_t)nVals);
      if (values == NULL) {
        free(name);
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto done;
      }

      for (int i = 0; i < nVals; i++) {
        int vTok = jsmn_get_array_elem(tokens, valuesTok, i, tokenCount);
        SpiceDouble v = 0.0;
        if (vTok < 0 || vTok >= tokenCount || jsmn_parse_double(input, &tokens[vTok], &v) != PARSE_OK) {
          free(name);
          free(values);
          write_error_json_ex("invalid_args", "kernel-pool.pdpool expects args[1] to contain only numbers", NULL, NULL, NULL, NULL);
          goto done;
        }
        values[i] = v;
      }
    }

    pdpool_c(name, (SpiceInt)nVals, (ConstSpiceDouble *)values);
    free(name);
    free(values);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pdpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_PIPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[0]=string args[1]=integer[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int valuesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (valuesTok < 0 || valuesTok >= tokenCount || tokens[valuesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    const int nVals = tokens[valuesTok].size;
    SpiceInt *values = NULL;
    if (nVals > 0) {
      values = (SpiceInt *)malloc(sizeof(SpiceInt) * (size_t)nVals);
      if (values == NULL) {
        free(name);
        write_error_json("Out of memory", NULL, NULL, NULL);
        goto done;
      }

      for (int i = 0; i < nVals; i++) {
        int vTok = jsmn_get_array_elem(tokens, valuesTok, i, tokenCount);
        SpiceInt v = 0;
        parse_result vParse = PARSE_INVALID;
        if (vTok >= 0 && vTok < tokenCount) {
          vParse = jsmn_parse_int(input, &tokens[vTok], &v);
        }
        if (vTok < 0 || vTok >= tokenCount || vParse != PARSE_OK) {
          free(name);
          free(values);
          if (vParse == PARSE_UNSUPPORTED) {
            write_unsupported_spiceint_width_error();
          } else {
            write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[1] to contain only integers", NULL, NULL, NULL, NULL);
          }
          goto done;
        }
        if (v < -2147483648 || v > 2147483647) {
          free(name);
          free(values);
          write_error_json_ex("invalid_args", "kernel-pool.pipool expects args[1] to contain only 32-bit integers", NULL, NULL, NULL, NULL);
          goto done;
        }
        values[i] = v;
      }
    }

    pipool_c(name, (SpiceInt)nVals, (ConstSpiceInt *)values);
    free(name);
    free(values);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pipool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_PCPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[0]=string args[1]=string[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int valuesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (valuesTok < 0 || valuesTok >= tokenCount || tokens[valuesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    const int nVals = tokens[valuesTok].size;
    // Allocate at least one element so we never pass NULL to CSPICE.
    const int allocN = nVals > 0 ? nVals : 1;
    char *cvals = (char *)calloc((size_t)allocN, (size_t)KPOOL_STRING_MAX_BYTES);
    if (cvals == NULL) {
      free(name);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    for (int i = 0; i < nVals; i++) {
      int sTok = jsmn_get_array_elem(tokens, valuesTok, i, tokenCount);
      if (sTok < 0 || sTok >= tokenCount || tokens[sTok].type != JSMN_STRING) {
        free(name);
        free(cvals);
        write_error_json_ex("invalid_args", "kernel-pool.pcpool expects args[1] to contain only strings", NULL, NULL, NULL, NULL);
        goto done;
      }

      char *s = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t sErr =
          jsmn_strdup(input, &tokens[sTok], &s, strDetail, sizeof(strDetail));
      if (sErr != JSMN_STRDUP_OK) {
        free(name);
        free(cvals);
        if (sErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }

      const size_t sLen = strlen(s);
      if (sLen >= (size_t)KPOOL_STRING_MAX_BYTES) {
        char msg[256];
        snprintf(msg, sizeof(msg),
                 "kernel-pool.pcpool expects args[1][%d] to be <= %d bytes",
                 i, (int)KPOOL_STRING_MAX_BYTES - 1);
        free(s);
        free(name);
        free(cvals);
        write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
        goto done;
      }

      char *slot = cvals + (size_t)i * (size_t)KPOOL_STRING_MAX_BYTES;
      memcpy(slot, s, sLen + 1);
      free(s);
    }

    pcpool_c(name, (SpiceInt)nVals, (SpiceInt)KPOOL_STRING_MAX_BYTES, cvals);
    free(name);
    free(cvals);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in pcpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_SWPOOL: {
    if (tokens[argsTok].size < 2) {
      write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[0]=string args[1]=string[]", NULL, NULL, NULL, NULL);
      goto done;
    }

    int agentTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    int namesTok = jsmn_get_array_elem(tokens, argsTok, 1, tokenCount);

    if (agentTok < 0 || agentTok >= tokenCount || tokens[agentTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }
    if (namesTok < 0 || namesTok >= tokenCount || tokens[namesTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[1] to be an array", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *agent = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t agentErr =
        jsmn_strdup(input, &tokens[agentTok], &agent, strDetail, sizeof(strDetail));
    if (agentErr != JSMN_STRDUP_OK) {
      if (agentErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    const int nNames = tokens[namesTok].size;
    const int allocN = nNames > 0 ? nNames : 1;
    char *names = (char *)calloc((size_t)allocN, (size_t)KPOOL_NAME_MAX_BYTES);
    if (names == NULL) {
      free(agent);
      write_error_json("Out of memory", NULL, NULL, NULL);
      goto done;
    }

    for (int i = 0; i < nNames; i++) {
      int sTok = jsmn_get_array_elem(tokens, namesTok, i, tokenCount);
      if (sTok < 0 || sTok >= tokenCount || tokens[sTok].type != JSMN_STRING) {
        free(agent);
        free(names);
        write_error_json_ex("invalid_args", "kernel-pool.swpool expects args[1] to contain only strings", NULL, NULL, NULL, NULL);
        goto done;
      }

      char *s = NULL;
      strDetail[0] = '\0';
      jsmn_strdup_err_t sErr =
          jsmn_strdup(input, &tokens[sTok], &s, strDetail, sizeof(strDetail));
      if (sErr != JSMN_STRDUP_OK) {
        free(agent);
        free(names);
        if (sErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        goto done;
      }

      const size_t sLen = strlen(s);
      if (sLen >= (size_t)KPOOL_NAME_MAX_BYTES) {
        char msg[256];
        snprintf(msg, sizeof(msg),
                 "kernel-pool.swpool expects args[1][%d] to be <= %d bytes",
                 i, (int)KPOOL_NAME_MAX_BYTES - 1);
        free(s);
        free(agent);
        free(names);
        write_error_json_ex("invalid_args", msg, NULL, NULL, NULL, NULL);
        goto done;
      }

      char *slot = names + (size_t)i * (size_t)KPOOL_NAME_MAX_BYTES;
      memcpy(slot, s, sLen + 1);
      free(s);
    }

    swpool_c(agent, (SpiceInt)nNames, (SpiceInt)KPOOL_NAME_MAX_BYTES, names);
    free(agent);
    free(names);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in swpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":null}\n", stdout);
    goto done;
  }

  case CALL_CVPOOL: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernel-pool.cvpool expects args[0]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int agentTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (agentTok < 0 || agentTok >= tokenCount || tokens[agentTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.cvpool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *agent = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t agentErr =
        jsmn_strdup(input, &tokens[agentTok], &agent, strDetail, sizeof(strDetail));
    if (agentErr != JSMN_STRDUP_OK) {
      if (agentErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    // Prime the agent with an empty watch list (see tspiceRunner).
    // CSPICE requires a non-null `names` pointer even when nnames==0.
    char dummyNames[KPOOL_NAME_MAX_BYTES];
    memset(dummyNames, 0, sizeof(dummyNames));
    swpool_c(agent, 0, (SpiceInt)KPOOL_NAME_MAX_BYTES, dummyNames);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in swpool (cvpool prime)", shortMsg, longMsg, traceMsg);
      free(agent);
      goto done;
    }

    SpiceBoolean update = SPICEFALSE;
    cvpool_c(agent, &update);
    free(agent);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in cvpool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    fputs(update == SPICETRUE ? "true" : "false", stdout);
    fputs("}\n", stdout);
    goto done;
  }

  case CALL_EXPOOL: {
    if (tokens[argsTok].size < 1) {
      write_error_json_ex("invalid_args", "kernel-pool.expool expects args[0]=string", NULL, NULL, NULL, NULL);
      goto done;
    }

    int nameTok = jsmn_get_array_elem(tokens, argsTok, 0, tokenCount);
    if (nameTok < 0 || nameTok >= tokenCount || tokens[nameTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "kernel-pool.expool expects args[0] to be a string", NULL, NULL, NULL, NULL);
      goto done;
    }

    char *name = NULL;
    char strDetail[256];
    strDetail[0] = '\0';
    jsmn_strdup_err_t nameErr =
        jsmn_strdup(input, &tokens[nameTok], &name, strDetail, sizeof(strDetail));
    if (nameErr != JSMN_STRDUP_OK) {
      if (nameErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            strDetail[0] ? strDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      goto done;
    }

    SpiceBoolean found = SPICEFALSE;
    expool_c(name, &found);
    free(name);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg), traceMsg,
                          sizeof(traceMsg));
      write_error_json("SPICE error in expool", shortMsg, longMsg, traceMsg);
      goto done;
    }

    fputs("{\"ok\":true,\"result\":", stdout);
    fputs(found == SPICETRUE ? "true" : "false", stdout);
    fputs("}\n", stdout);
    goto done;
  }

  default:
    write_error_json_ex("unsupported_call", "Unsupported call", NULL, NULL,
                        NULL, NULL);
    goto done;
  }


done:
  // Clear state even though this is a single-shot process.
  kclear_c();
  reset_c();

  free(call);
  free(tokens);
  free(input);
  return exitCode;
}
