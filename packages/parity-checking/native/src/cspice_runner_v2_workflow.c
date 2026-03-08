#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_v2_fixtures.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_alloc_steps.h"
#include "cspice_runner_v2_assert_step.h"
#include "cspice_runner_v2_spice_call.h"
#include "cspice_runner_v2_json_buffer.h"
#include "cspice_runner_v2_workflow.h"

#include <sys/wait.h>

#if defined(__APPLE__)
#include <mach-o/dyld.h>
#endif

#define V2_CALL_CONTRACT_CHILD_OUTPUT_MAX_BYTES (1024U * 1024U)

static bool v2_strdup_token_slice(const char *json,
                                  const jsmntok_t *tok,
                                  char **out) {
  if (json == NULL || tok == NULL || out == NULL || tok->start < 0 ||
      tok->end < tok->start) {
    return false;
  }

  const size_t len = (size_t)(tok->end - tok->start);
  if (len > SIZE_MAX - 1U) {
    return false;
  }

  char *copy = (char *)malloc(len + 1U);
  if (copy == NULL) {
    return false;
  }

  memcpy(copy, json + tok->start, len);
  copy[len] = '\0';
  *out = copy;
  return true;
}

static bool v2_write_spice_failure(const char *messagePrefix) {
  char shortMsg[1841];
  char longMsg[1841];
  char traceMsg[1841];
  capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                      traceMsg, sizeof(traceMsg));
  write_error_json_ex("spice_error", messagePrefix, NULL, shortMsg, longMsg,
                      traceMsg);
  return false;
}

static bool v2_write_all_fd(int fd, const char *data, size_t len) {
  if (fd < 0 || data == NULL) {
    return false;
  }

  size_t written = 0;
  while (written < len) {
    ssize_t n = write(fd, data + written, len - written);
    if (n < 0) {
      if (errno == EINTR) {
        continue;
      }
      return false;
    }

    if (n == 0) {
      return false;
    }

    written += (size_t)n;
  }

  return true;
}

static bool v2_read_all_fd_capped(int fd, char **out) {
  if (fd < 0 || out == NULL) {
    return false;
  }

  *out = NULL;
  size_t cap = 4096;
  size_t len = 0;
  char *buf = (char *)malloc(cap);
  if (buf == NULL) {
    return false;
  }

  while (true) {
    if (len + 1 >= cap) {
      size_t nextCap = cap * 2U;
      if (nextCap <= cap || nextCap > V2_CALL_CONTRACT_CHILD_OUTPUT_MAX_BYTES) {
        free(buf);
        write_error_json_ex("invalid_request",
                            "callContract child output too large",
                            NULL,
                            NULL,
                            NULL,
                            NULL);
        return false;
      }

      char *next = (char *)realloc(buf, nextCap);
      if (next == NULL) {
        free(buf);
        return false;
      }
      buf = next;
      cap = nextCap;
    }

    ssize_t n = read(fd, buf + len, cap - len - 1U);
    if (n < 0) {
      if (errno == EINTR) {
        continue;
      }
      free(buf);
      return false;
    }

    if (n == 0) {
      break;
    }

    len += (size_t)n;
    if (len > V2_CALL_CONTRACT_CHILD_OUTPUT_MAX_BYTES) {
      free(buf);
      write_error_json_ex("invalid_request",
                          "callContract child output too large",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }
  }

  buf[len] = '\0';
  *out = buf;
  return true;
}

static bool v2_parse_json_tokens(const char *json,
                                 jsmntok_t **outTokens,
                                 int *outTokenCount) {
  if (json == NULL || outTokens == NULL || outTokenCount == NULL) {
    return false;
  }

  const size_t inputLen = strlen(json);
  int tokenCap = 256;
  jsmn_parser parser;
  jsmntok_t *tokens = NULL;

  while (true) {
    tokens = (jsmntok_t *)malloc(sizeof(jsmntok_t) * (size_t)tokenCap);
    if (tokens == NULL) {
      return false;
    }

    jsmn_init(&parser);
    const int tokenCount =
        jsmn_parse(&parser, json, inputLen, tokens, (unsigned int)tokenCap);
    if (tokenCount >= 0) {
      *outTokens = tokens;
      *outTokenCount = tokenCount;
      return true;
    }

    free(tokens);
    tokens = NULL;

    if (tokenCount == -1) {
      tokenCap *= 2;
      if (tokenCap > 8192) {
        return false;
      }
      continue;
    }

    return false;
  }
}

static bool v2_strdup_json_token_value(const char *json,
                                       const jsmntok_t *tok,
                                       char **out) {
  if (json == NULL || tok == NULL || out == NULL || tok->start < 0 ||
      tok->end < tok->start) {
    return false;
  }

  int start = tok->start;
  int end = tok->end;

  if (tok->type == JSMN_STRING) {
    start -= 1;
    end += 1;
    if (start < 0 || end <= start) {
      return false;
    }
  }

  const size_t len = (size_t)(end - start);
  if (len > SIZE_MAX - 1U) {
    return false;
  }

  char *copy = (char *)malloc(len + 1U);
  if (copy == NULL) {
    return false;
  }

  memcpy(copy, json + start, len);
  copy[len] = '\0';
  *out = copy;
  return true;
}

static bool v2_emit_child_error_response(const char *responseJson) {
  if (responseJson == NULL) {
    return false;
  }

  const char *start = responseJson;
  while (*start != '\0' && isspace((unsigned char)*start)) {
    start++;
  }

  const char *end = responseJson + strlen(responseJson);
  while (end > start && isspace((unsigned char)*(end - 1))) {
    end--;
  }

  if (end <= start) {
    return false;
  }

  fwrite(start, 1U, (size_t)(end - start), stdout);
  fputc('\n', stdout);
  return true;
}

static bool v2_extract_child_result_json(const char *responseJson,
                                         char **outResultJson) {
  if (responseJson == NULL || outResultJson == NULL) {
    return false;
  }

  *outResultJson = NULL;

  jsmntok_t *tokens = NULL;
  int tokenCount = 0;
  if (!v2_parse_json_tokens(responseJson, &tokens, &tokenCount) ||
      tokens == NULL || tokenCount <= 0 || tokens[0].type != JSMN_OBJECT) {
    free(tokens);
    write_error_json_ex("invalid_request",
                        "callContract child returned invalid JSON",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  int okTok =
      jsmn_find_object_key(responseJson, tokens, 0, "ok", tokenCount);
  if (okTok < 0 || tokens[okTok].type != JSMN_PRIMITIVE) {
    free(tokens);
    write_error_json_ex("invalid_request",
                        "callContract child response missing ok",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  const bool okValue = jsmn_token_streq(responseJson, &tokens[okTok], "true");
  if (!okValue) {
    free(tokens);
    if (!v2_emit_child_error_response(responseJson)) {
      write_error_json_ex("invalid_request",
                          "callContract child returned empty error response",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
    }
    return false;
  }

  int resultTok =
      jsmn_find_object_key(responseJson, tokens, 0, "result", tokenCount);
  if (resultTok < 0) {
    free(tokens);
    write_error_json_ex("invalid_request",
                        "callContract child response missing result",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char *resultJson = NULL;
  const bool copied =
      v2_strdup_json_token_value(responseJson, &tokens[resultTok], &resultJson);
  free(tokens);
  if (!copied || resultJson == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  *outResultJson = resultJson;
  return true;
}

static bool v2_build_legacy_call_contract_request(
    const char *json,
    const jsmntok_t *tokens,
    const int tokenCount,
    const int stepTok,
    const int argsTok,
    char **outRequestJson) {
  if (json == NULL || tokens == NULL || outRequestJson == NULL) {
    return false;
  }

  *outRequestJson = NULL;

  int callTok = jsmn_find_object_key(json, tokens, stepTok, "call", tokenCount);
  if (callTok >= 0 && tokens[callTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "callContract.call must be a string",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (callTok < 0) {
    int contractTok =
        jsmn_find_object_key(json, tokens, 0, "contract", tokenCount);
    if (contractTok < 0 || tokens[contractTok].type != JSMN_OBJECT) {
      write_error_json_ex("invalid_request",
                          "v2 request requires contract object",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    callTok = jsmn_find_object_key(json,
                                   tokens,
                                   contractTok,
                                   "contractMethod",
                                   tokenCount);
    if (callTok < 0 || tokens[callTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "contract.contractMethod must be a string",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }
  }

  if (argsTok < 0 || argsTok >= tokenCount || tokens[argsTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request",
                        "v3 callContract expects args to be an array",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  int setupTok = jsmn_find_object_key(json, tokens, 0, "setup", tokenCount);
  if (setupTok >= 0 && tokens[setupTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "setup must be an object when provided",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  const size_t callLen = (size_t)(tokens[callTok].end - tokens[callTok].start);
  const size_t argsLen = (size_t)(tokens[argsTok].end - tokens[argsTok].start);
  const size_t setupLen =
      setupTok >= 0 ? (size_t)(tokens[setupTok].end - tokens[setupTok].start) : 0U;

  const size_t fixedPrefixLen = strlen("{\"call\":\"");
  const size_t fixedMiddleLen = strlen("\",\"args\":");
  const size_t fixedSetupPrefixLen = strlen(",\"setup\":");

  size_t totalLen = fixedPrefixLen + callLen + fixedMiddleLen + argsLen + 1U;
  if (setupTok >= 0) {
    totalLen += fixedSetupPrefixLen + setupLen;
  }

  char *requestJson = (char *)malloc(totalLen);
  if (requestJson == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  char *cursor = requestJson;
  memcpy(cursor, "{\"call\":\"", fixedPrefixLen);
  cursor += fixedPrefixLen;
  memcpy(cursor, json + tokens[callTok].start, callLen);
  cursor += callLen;

  memcpy(cursor, "\",\"args\":", fixedMiddleLen);
  cursor += fixedMiddleLen;
  memcpy(cursor, json + tokens[argsTok].start, argsLen);
  cursor += argsLen;

  if (setupTok >= 0) {
    memcpy(cursor, ",\"setup\":", fixedSetupPrefixLen);
    cursor += fixedSetupPrefixLen;
    memcpy(cursor, json + tokens[setupTok].start, setupLen);
    cursor += setupLen;
  }

  *cursor++ = '}';
  *cursor = '\0';

  *outRequestJson = requestJson;
  return true;
}

static bool v2_run_legacy_request_subprocess(const char *requestJson,
                                             char **outResponseJson) {
  if (requestJson == NULL || outResponseJson == NULL) {
    return false;
  }

  *outResponseJson = NULL;

  int stdinPipe[2] = {-1, -1};
  int stdoutPipe[2] = {-1, -1};

  char selfPath[PATH_MAX];
  memset(selfPath, 0, sizeof(selfPath));
#if defined(__linux__)
  {
    const ssize_t selfPathLen = readlink("/proc/self/exe", selfPath,
                                         sizeof(selfPath) - 1U);
    if (selfPathLen <= 0 ||
        (size_t)selfPathLen >= sizeof(selfPath)) {
      write_error_json_ex("invalid_request",
                          "callContract could not resolve runner executable path",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }
    selfPath[selfPathLen] = '\0';
  }
#elif defined(__APPLE__)
  {
    uint32_t size = (uint32_t)sizeof(selfPath);
    if (_NSGetExecutablePath(selfPath, &size) != 0) {
      write_error_json_ex("invalid_request",
                          "callContract could not resolve runner executable path",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    char resolved[PATH_MAX];
    if (realpath(selfPath, resolved) != NULL) {
      const size_t resolvedLen = strlen(resolved);
      if (resolvedLen + 1U > sizeof(selfPath)) {
        write_error_json_ex("invalid_request",
                            "callContract resolved runner path is too long",
                            NULL,
                            NULL,
                            NULL,
                            NULL);
        return false;
      }

      memcpy(selfPath, resolved, resolvedLen + 1U);
    }
  }
#else
  write_error_json_ex("invalid_request",
                      "callContract native execution is unsupported on this platform",
                      NULL,
                      NULL,
                      NULL,
                      NULL);
  return false;
#endif

  if (pipe(stdinPipe) != 0 || pipe(stdoutPipe) != 0) {
    if (stdinPipe[0] >= 0) {
      close(stdinPipe[0]);
      close(stdinPipe[1]);
    }
    if (stdoutPipe[0] >= 0) {
      close(stdoutPipe[0]);
      close(stdoutPipe[1]);
    }
    write_error_json_ex("invalid_request",
                        "callContract could not create child pipes",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  pid_t pid = fork();
  if (pid < 0) {
    close(stdinPipe[0]);
    close(stdinPipe[1]);
    close(stdoutPipe[0]);
    close(stdoutPipe[1]);
    write_error_json_ex("invalid_request",
                        "callContract could not fork child process",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (pid == 0) {
    (void)dup2(stdinPipe[0], STDIN_FILENO);
    (void)dup2(stdoutPipe[1], STDOUT_FILENO);

    close(stdinPipe[0]);
    close(stdinPipe[1]);
    close(stdoutPipe[0]);
    close(stdoutPipe[1]);

    execl(selfPath, "cspice-runner", (char *)NULL);
    _exit(127);
  }

  close(stdinPipe[0]);
  close(stdoutPipe[1]);

  const size_t requestLen = strlen(requestJson);
  bool writeOk = v2_write_all_fd(stdinPipe[1], requestJson, requestLen);
  if (writeOk) {
    writeOk = v2_write_all_fd(stdinPipe[1], "\n", 1U);
  }
  close(stdinPipe[1]);

  if (!writeOk) {
    close(stdoutPipe[0]);
    (void)waitpid(pid, NULL, 0);
    write_error_json_ex("invalid_request",
                        "callContract could not write child request",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char *childOutput = NULL;
  bool readOk = v2_read_all_fd_capped(stdoutPipe[0], &childOutput);
  close(stdoutPipe[0]);

  int status = 0;
  (void)waitpid(pid, &status, 0);

  if (!readOk || childOutput == NULL) {
    free(childOutput);
    write_error_json_ex("invalid_request",
                        "callContract could not read child response",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  *outResponseJson = childOutput;
  return true;
}

static bool v2_resolve_string_expr(const char *json,
                                   const jsmntok_t *tokens,
                                   const int tokenCount,
                                   const int exprTok,
                                   const int argsTok,
                                   V2RefEntry *refs,
                                   const int refCount,
                                   const char *label,
                                   char **out) {
  if (exprTok < 0 || exprTok >= tokenCount ||
      tokens[exprTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Expression must be a string", label,
                        NULL, NULL, NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, &tokens[exprTok], &expr, detail, sizeof(detail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0 || tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "Missing or invalid v2 string argument",
                          argName, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    char *value = NULL;
    bool ok = v2_strdup_token_slice(json, &tokens[valueTok], &value);
    free(expr);
    if (!ok) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    *out = value;
    return true;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    if (strchr(refName, '.') != NULL) {
      write_error_json_ex("invalid_args", "Ref must use $refs.<name>", refName,
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

    if (refs[refIndex].type != V2_REF_PATH || refs[refIndex].pathValue == NULL) {
      write_error_json_ex("invalid_args", "v2 ref is not a path", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    char *value = strdup(refs[refIndex].pathValue);
    free(expr);
    if (value == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    *out = value;
    return true;
  }

  *out = expr;
  return true;
}

static bool v2_execute_materialize_step(const char *json,
                                        const jsmntok_t *tokens,
                                        const int tokenCount,
                                        const int stepTok,
                                        V2RefEntry *refs,
                                        int *refCount) {
  int fixtureTok =
      jsmn_find_object_key(json, tokens, stepTok, "fixture", tokenCount);
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (fixtureTok < 0 || tokens[fixtureTok].type != JSMN_STRING || asTok < 0 ||
      tokens[asTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "materialize requires string fixture/as", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  char *fixture = NULL;
  char *asName = NULL;
  if (!v2_strdup_token_slice(json, &tokens[fixtureTok], &fixture) ||
      !v2_strdup_token_slice(json, &tokens[asTok], &asName)) {
    free(fixture);
    free(asName);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  char pathBuf[PATH_MAX];
  bool ok = false;
  if (strcmp(fixture, "minimalDsk") == 0) {
    ok = v2_write_minimal_dsk_file("v2-materialize-minimal-dsk", pathBuf,
                                   sizeof(pathBuf));
  } else if (strcmp(fixture, "virtualOutputSpk") == 0) {
    char detail[256];
    detail[0] = '\0';
    int tempFd = -1;
    if (!build_file_io_temp_path("v2-materialize-virtual-output",
                                 ".bsp",
                                 pathBuf,
                                 sizeof(pathBuf),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create virtual output temp path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
    } else {
      if (tempFd >= 0) {
        close(tempFd);
      }
      unlink(pathBuf);

      SpiceInt handle = 0;
      spkopn_c(pathBuf, "TSPICE", 0, &handle);
      if (failed_c() == SPICETRUE) {
        unlink(pathBuf);
        ok = v2_write_spice_failure("SPICE error in spkopn_c");
      } else {
        spkw08_c(handle,
                 1000,
                 0,
                 "J2000",
                 0,
                 60,
                 "TSPICE_V2_READ_VO",
                 1,
                 (SpiceDouble(*)[6])READ_VIRTUAL_OUTPUT_STATES,
                 0,
                 60);
        if (failed_c() == SPICETRUE) {
          spkcls_c(handle);
          unlink(pathBuf);
          ok = v2_write_spice_failure("SPICE error in spkw08_c");
        } else {
          spkcls_c(handle);
          if (failed_c() == SPICETRUE) {
            unlink(pathBuf);
            ok = v2_write_spice_failure("SPICE error in spkcls_c");
          } else {
            ok = true;
          }
        }
      }
    }
  } else {
    write_error_json_ex("invalid_args", "Unknown materialize fixture", fixture,
                        NULL, NULL, NULL);
    ok = false;
  }

  if (ok) {
    ok = v2_add_ref_path(refs, refCount, asName, pathBuf);
  }

  free(fixture);
  free(asName);
  return ok;
}

static bool v2_execute_das_open_step(const char *json,
                                     const jsmntok_t *tokens,
                                     const int tokenCount,
                                     const int stepTok,
                                     const int argsTok,
                                     V2RefEntry *refs,
                                     int *refCount) {
  int pathTok = jsmn_find_object_key(json, tokens, stepTok, "path", tokenCount);
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (pathTok < 0 || asTok < 0 || tokens[asTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "dasOpen requires path/as", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  char *path = NULL;
  if (!v2_resolve_string_expr(json,
                              tokens,
                              tokenCount,
                              pathTok,
                              argsTok,
                              refs,
                              *refCount,
                              "dasOpen.path",
                              &path)) {
    return false;
  }

  char *asName = NULL;
  if (!v2_strdup_token_slice(json, &tokens[asTok], &asName)) {
    free(path);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceInt handle = 0;
  dasopr_c(path, &handle);
  free(path);
  if (failed_c() == SPICETRUE) {
    free(asName);
    return v2_write_spice_failure("SPICE error in dasopr_c");
  }

  bool ok = v2_add_ref_das_handle(refs, refCount, asName, handle);
  free(asName);
  return ok;
}

static bool v2_execute_dla_begin_forward_search_step(
    const char *json, const jsmntok_t *tokens, const int tokenCount,
    const int stepTok, V2RefEntry *refs, int *refCount) {
  int handleTok =
      jsmn_find_object_key(json, tokens, stepTok, "handle", tokenCount);
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (handleTok < 0 || asTok < 0 || tokens[asTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "dlaBeginForwardSearch requires handle/as", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  int handleRefIndex = -1;
  if (!v2_resolve_das_handle_ref(json,
                                 tokens,
                                 tokenCount,
                                 handleTok,
                                 refs,
                                 *refCount,
                                 "dlaBeginForwardSearch.handle",
                                 &handleRefIndex)) {
    return false;
  }

  char *asName = NULL;
  if (!v2_strdup_token_slice(json, &tokens[asTok], &asName)) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceBoolean found = SPICEFALSE;
  SpiceDLADescr descr;
  memset(&descr, 0, sizeof(descr));
  dlabfs_c(refs[handleRefIndex].handleValue, &descr, &found);
  if (failed_c() == SPICETRUE) {
    free(asName);
    return v2_write_spice_failure("SPICE error in dlabfs_c");
  }

  if (found != SPICETRUE) {
    write_error_json_ex("invalid_request",
                        "dlaBeginForwardSearch expected a DLA segment",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    free(asName);
    return false;
  }

  bool ok = v2_add_ref_dla_descr(refs, refCount, asName, &descr);
  free(asName);
  return ok;
}

static bool v2_execute_das_close_step(const char *json,
                                      const jsmntok_t *tokens,
                                      const int tokenCount,
                                      const int stepTok,
                                      V2RefEntry *refs,
                                      const int refCount) {
  int targetTok =
      jsmn_find_object_key(json, tokens, stepTok, "target", tokenCount);
  if (targetTok < 0) {
    write_error_json_ex("invalid_request", "dasClose requires target", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int refIndex = -1;
  if (!v2_resolve_das_handle_ref(json,
                                 tokens,
                                 tokenCount,
                                 targetTok,
                                 refs,
                                 refCount,
                                 "dasClose.target",
                                 &refIndex)) {
    return false;
  }

  dascls_c(refs[refIndex].handleValue);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in dascls_c");
  }

  v2_free_ref_entry(&refs[refIndex]);
  return true;
}

static bool v2_execute_unlink_step(const char *json,
                                   const jsmntok_t *tokens,
                                   const int tokenCount,
                                   const int stepTok,
                                   V2RefEntry *refs,
                                   const int refCount) {
  int targetTok =
      jsmn_find_object_key(json, tokens, stepTok, "target", tokenCount);
  if (targetTok < 0) {
    write_error_json_ex("invalid_request", "unlink requires target", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  int refIndex = -1;
  if (!v2_resolve_path_ref(json,
                           tokens,
                           tokenCount,
                           targetTok,
                           refs,
                           refCount,
                           "unlink.target",
                           &refIndex)) {
    return false;
  }

  if (refs[refIndex].pathValue != NULL) {
    unlink(refs[refIndex].pathValue);
  }

  v2_free_ref_entry(&refs[refIndex]);
  return true;
}

static bool v2_copy_switch_value_token(const char *json,
                                       const jsmntok_t *tokens,
                                       const int tokenCount,
                                       const int valueTok,
                                       char **outKey) {
  if (valueTok < 0 || valueTok >= tokenCount || outKey == NULL) {
    write_error_json_ex("invalid_request", "switch.on could not resolve token",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[valueTok];
  if (tok->type == JSMN_PRIMITIVE) {
    if (!v2_strdup_token_slice(json, tok, outKey)) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
    return true;
  }

  if (tok->type == JSMN_STRING) {
    char detail[256];
    detail[0] = '\0';
    char *value = NULL;
    jsmn_strdup_err_t err =
        jsmn_strdup(json, tok, &value, detail, sizeof(detail));
    if (err != JSMN_STRDUP_OK) {
      if (err == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            detail[0] ? detail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      return false;
    }

    *outKey = value;
    return true;
  }

  write_error_json_ex("invalid_args",
                      "switch.on expression must resolve to primitive or string",
                      NULL,
                      NULL,
                      NULL,
                      NULL);
  return false;
}

static bool v2_resolve_switch_case_key(const char *json,
                                       const jsmntok_t *tokens,
                                       const int tokenCount,
                                       const int onTok,
                                       const int argsTok,
                                       const V2RefEntry *refs,
                                       const int refCount,
                                       char **outKey) {
  *outKey = NULL;

  if (onTok < 0 || onTok >= tokenCount) {
    write_error_json_ex("invalid_request", "switch requires on expression", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const jsmntok_t *tok = &tokens[onTok];
  if (tok->type == JSMN_PRIMITIVE) {
    if (!v2_strdup_token_slice(json, tok, outKey)) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }
    return true;
  }

  if (tok->type != JSMN_STRING) {
    write_error_json_ex("invalid_args",
                        "switch.on must be primitive or string expression",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char detail[256];
  detail[0] = '\0';
  char *expr = NULL;
  jsmn_strdup_err_t exprErr =
      jsmn_strdup(json, tok, &expr, detail, sizeof(detail));
  if (exprErr != JSMN_STRDUP_OK) {
    if (exprErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int argTok = jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (argTok < 0) {
      write_error_json_ex("invalid_args", "Missing v2 argument", argName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    bool ok = v2_copy_switch_value_token(json,
                                         tokens,
                                         tokenCount,
                                         argTok,
                                         outKey);
    free(expr);
    return ok;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    int refIndex = v2_find_ref_index(refs, refCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    if (refs[refIndex].type != V2_REF_INT) {
      write_error_json_ex("invalid_args", "switch.on ref must be integer",
                          refName, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    char intText[64];
    const int n = snprintf(intText,
                           sizeof(intText),
                           "%" PRIdMAX,
                           (intmax_t)refs[refIndex].intValue);
    if (n < 0 || (size_t)n >= sizeof(intText)) {
      free(expr);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    char *copy = strdup(intText);
    if (copy == NULL) {
      free(expr);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    *outKey = copy;
    free(expr);
    return true;
  }

  *outKey = expr;
  return true;
}

static bool v2_execute_step_array(
    const char *json, const jsmntok_t *tokens, const int tokenCount,
    const int stepsTok, const int argsTok, V2RefEntry *refs, int *refCount,
    const bool captureProjectResult, char **projectResultObjectJson,
    const char *invalidStepMessage, const char *missingOpMessage,
    const char *unsupportedOpMessage) {
  if (stepsTok < 0 || stepsTok >= tokenCount ||
      tokens[stepsTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", invalidStepMessage, NULL, NULL, NULL,
                        NULL);
    return false;
  }

  for (int i = 0; i < tokens[stepsTok].size; i++) {
    int stepTok = jsmn_get_array_elem(tokens, stepsTok, i, tokenCount);
    if (stepTok < 0 || tokens[stepTok].type != JSMN_OBJECT) {
      write_error_json_ex("invalid_request", invalidStepMessage, NULL, NULL,
                          NULL, NULL);
      return false;
    }

    int opTok = jsmn_find_object_key(json, tokens, stepTok, "op", tokenCount);
    if (opTok < 0 || tokens[opTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", missingOpMessage, NULL, NULL, NULL,
                          NULL);
      return false;
    }

    if (!v2_dispatch_workflow_step(json,
                                   tokens,
                                   tokenCount,
                                   stepTok,
                                   opTok,
                                   argsTok,
                                   refs,
                                   refCount,
                                   captureProjectResult,
                                   projectResultObjectJson,
                                   unsupportedOpMessage)) {
      return false;
    }
  }

  return true;
}

static bool v2_execute_project_step(const char *json,
                                    const jsmntok_t *tokens,
                                    const int tokenCount,
                                    const int stepTok,
                                    const int argsTok,
                                    V2RefEntry *refs,
                                    int *refCount) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok < 0 || outTok >= tokenCount || tokens[outTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "project.out must be an object", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const int pairCount = jsmn_object_pair_count(&tokens[outTok]);
  if (pairCount < 0) {
    write_error_json_ex("invalid_request", "project.out parse error", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  int idx = outTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "project.out parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char *key = NULL;
    jsmn_strdup_err_t keyErr =
        jsmn_strdup(json, &tokens[keyTok], &key, detail, sizeof(detail));
    if (keyErr != JSMN_STRDUP_OK) {
      if (keyErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            detail[0] ? detail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      return false;
    }

    char label[256];
    const int labelLen =
        snprintf(label, sizeof(label), "project.out.%s", key);
    if (labelLen < 0 || (size_t)labelLen >= sizeof(label)) {
      free(key);
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    SpiceInt projected = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  valueTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  label,
                                  &projected)) {
      free(key);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, key, projected);
    free(key);
    if (!ok) {
      return false;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "project.out parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

static bool v2_execute_call_contract_step(
    const char *json,
    const jsmntok_t *tokens,
    const int tokenCount,
    const int stepTok,
    const int argsTok,
    const bool captureProjectResult,
    char **projectResultObjectJson) {
  if (!captureProjectResult || projectResultObjectJson == NULL) {
    write_error_json_ex("invalid_request",
                        "callContract is only supported in workflow.steps",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char *requestJson = NULL;
  if (!v2_build_legacy_call_contract_request(
          json, tokens, tokenCount, stepTok, argsTok, &requestJson)) {
    free(requestJson);
    return false;
  }

  char *responseJson = NULL;
  const bool invoked =
      v2_run_legacy_request_subprocess(requestJson, &responseJson);
  free(requestJson);
  if (!invoked) {
    free(responseJson);
    return false;
  }

  char *resultJson = NULL;
  const bool extracted = v2_extract_child_result_json(responseJson, &resultJson);
  free(responseJson);
  if (!extracted) {
    free(resultJson);
    return false;
  }

  free(*projectResultObjectJson);
  *projectResultObjectJson = resultJson;
  return true;
}

static bool v2_execute_switch_step(
    const char *json, const jsmntok_t *tokens, const int tokenCount,
    const int stepTok, const int argsTok, V2RefEntry *refs, int *refCount,
    const bool captureProjectResult, char **projectResultObjectJson) {
  int onTok = jsmn_find_object_key(json, tokens, stepTok, "on", tokenCount);
  int casesTok =
      jsmn_find_object_key(json, tokens, stepTok, "cases", tokenCount);
  int defaultTok =
      jsmn_find_object_key(json, tokens, stepTok, "default", tokenCount);

  if (onTok < 0) {
    write_error_json_ex("invalid_request", "switch requires on", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  if (casesTok < 0 || casesTok >= tokenCount ||
      tokens[casesTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "switch.cases must be an object",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char *switchKey = NULL;
  if (!v2_resolve_switch_case_key(json,
                                  tokens,
                                  tokenCount,
                                  onTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  &switchKey)) {
    return false;
  }

  int pairCount = jsmn_object_pair_count(&tokens[casesTok]);
  if (pairCount < 0) {
    free(switchKey);
    write_error_json_ex("invalid_request", "switch.cases parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = casesTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int branchTok = idx + 1;
    if (branchTok >= tokenCount || tokens[keyTok].type != JSMN_STRING) {
      free(switchKey);
      write_error_json_ex("invalid_request", "switch.cases parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char *caseName = NULL;
    jsmn_strdup_err_t keyErr =
        jsmn_strdup(json, &tokens[keyTok], &caseName, detail, sizeof(detail));
    if (keyErr != JSMN_STRDUP_OK) {
      free(switchKey);
      if (keyErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            detail[0] ? detail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      return false;
    }

    bool match = (strcmp(caseName, switchKey) == 0);
    free(caseName);

    if (match) {
      if (!v2_execute_step_array(
              json,
              tokens,
              tokenCount,
              branchTok,
              argsTok,
              refs,
              refCount,
              captureProjectResult,
              projectResultObjectJson,
              "switch case must be an array",
              "switch case step missing op",
              "Unsupported v2 switch op")) {
        free(switchKey);
        return false;
      }

      free(switchKey);
      return true;
    }

    idx = jsmn_skip_subtree(tokens, branchTok, tokenCount);
    if (idx < 0) {
      free(switchKey);
      write_error_json_ex("invalid_request", "switch.cases parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  if (defaultTok >= 0) {
    bool ok = v2_execute_step_array(json,
                                    tokens,
                                    tokenCount,
                                    defaultTok,
                                    argsTok,
                                    refs,
                                    refCount,
                                    captureProjectResult,
                                    projectResultObjectJson,
                                    "switch.default must be an array",
                                    "switch default step missing op",
                                    "Unsupported v2 switch op");
    free(switchKey);
    return ok;
  }

  write_error_json_ex("invalid_request",
                      "switch.on has no matching case and no default",
                      switchKey,
                      NULL,
                      NULL,
                      NULL);
  free(switchKey);
  return false;
}

bool v2_dispatch_workflow_step(
    const char *json, const jsmntok_t *tokens, const int tokenCount,
    const int stepTok, const int opTok, const int argsTok, V2RefEntry *refs,
    int *refCount, const bool captureProjectResult,
    char **projectResultObjectJson, const char *unsupportedOpMessage) {
  if (jsmn_token_streq(json, &tokens[opTok], "allocCell")) {
    return v2_execute_alloc_cell_step(json, tokens, tokenCount, stepTok, argsTok,
                                      refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "allocWindow")) {
    return v2_execute_alloc_window_step(json, tokens, tokenCount, stepTok,
                                        argsTok, refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "materialize")) {
    return v2_execute_materialize_step(
        json, tokens, tokenCount, stepTok, refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "dasOpen")) {
    return v2_execute_das_open_step(
        json, tokens, tokenCount, stepTok, argsTok, refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "dlaBeginForwardSearch")) {
    return v2_execute_dla_begin_forward_search_step(
        json, tokens, tokenCount, stepTok, refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "dasClose")) {
    return v2_execute_das_close_step(
        json, tokens, tokenCount, stepTok, refs, *refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "unlink")) {
    return v2_execute_unlink_step(json, tokens, tokenCount, stepTok, refs,
                                  *refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "spiceCall")) {
    return v2_execute_spice_call_step(json, tokens, tokenCount, stepTok, argsTok,
                                      refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "callContract")) {
    return v2_execute_call_contract_step(json,
                                         tokens,
                                         tokenCount,
                                         stepTok,
                                         argsTok,
                                         captureProjectResult,
                                         projectResultObjectJson);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "assert")) {
    return v2_execute_assert_step(json, tokens, tokenCount, stepTok, argsTok,
                                  refs, *refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "project")) {
    return v2_execute_project_step(json, tokens, tokenCount, stepTok, argsTok,
                                   refs, refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "switch")) {
    return v2_execute_switch_step(json,
                                  tokens,
                                  tokenCount,
                                  stepTok,
                                  argsTok,
                                  refs,
                                  refCount,
                                  captureProjectResult,
                                  projectResultObjectJson);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "projectResult")) {
    int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
    char *nextProjectResult = NULL;
    if (!v2_materialize_project_result_object_json(
            json, tokens, tokenCount, outTok, argsTok, refs, *refCount,
            &nextProjectResult)) {
      return false;
    }

    if (captureProjectResult && projectResultObjectJson != NULL) {
      free(*projectResultObjectJson);
      *projectResultObjectJson = nextProjectResult;
    } else {
      free(nextProjectResult);
    }

    return true;
  }

  if (jsmn_token_streq(json, &tokens[opTok], "freeCell")) {
    return v2_execute_free_cell_step(json, tokens, tokenCount, stepTok, argsTok,
                                     refs, *refCount);
  }

  if (jsmn_token_streq(json, &tokens[opTok], "freeWindow")) {
    return v2_execute_free_window_step(json, tokens, tokenCount, stepTok,
                                       argsTok, refs, *refCount);
  }

  write_error_json_ex("unsupported_call", unsupportedOpMessage, NULL, NULL, NULL,
                      NULL);
  return false;
}

static bool v2_write_project_result_success_json(
    const char *projectResultObjectJson) {
  if (projectResultObjectJson == NULL) {
    write_error_json_ex("invalid_request",
                        "v2 workflow must include projectResult", NULL, NULL,
                        NULL, NULL);
    return false;
  }

  fputs("{\"ok\":true,\"result\":", stdout);
  fputs(projectResultObjectJson, stdout);
  fputs("}\n", stdout);
  return true;
}

static void v2_cleanup_live_refs_best_effort(V2RefEntry *refs,
                                             int refCount) {
  for (int i = 0; i < refCount; i++) {
    if (refs[i].name == NULL) {
      continue;
    }

    if (refs[i].type == V2_REF_DAS_HANDLE) {
      dascls_c(refs[i].handleValue);
      if (failed_c() == SPICETRUE) {
        reset_c();
      }
      continue;
    }

    if (refs[i].type == V2_REF_PATH && refs[i].pathValue != NULL) {
      unlink(refs[i].pathValue);
      continue;
    }
  }
}

static bool v2_step_array_contains_op(const char *json,
                                      const jsmntok_t *tokens,
                                      const int tokenCount,
                                      const int stepsTok,
                                      const char *opName,
                                      bool *outContains) {
  if (outContains == NULL) {
    return false;
  }

  *outContains = false;

  if (stepsTok < 0 || stepsTok >= tokenCount ||
      tokens[stepsTok].type != JSMN_ARRAY) {
    return false;
  }

  for (int i = 0; i < tokens[stepsTok].size; i++) {
    const int stepTok = jsmn_get_array_elem(tokens, stepsTok, i, tokenCount);
    if (stepTok < 0 || stepTok >= tokenCount ||
        tokens[stepTok].type != JSMN_OBJECT) {
      return false;
    }

    const int opTok =
        jsmn_find_object_key(json, tokens, stepTok, "op", tokenCount);
    if (opTok < 0 || opTok >= tokenCount || tokens[opTok].type != JSMN_STRING) {
      return false;
    }

    if (jsmn_token_streq(json, &tokens[opTok], opName)) {
      *outContains = true;
      return true;
    }
  }

  return true;
}

static bool v2_is_single_call_contract_workflow(const char *json,
                                                const jsmntok_t *tokens,
                                                const int tokenCount,
                                                const int stepsTok,
                                                bool *outIsSingle) {
  if (outIsSingle == NULL) {
    return false;
  }

  *outIsSingle = false;

  if (stepsTok < 0 || stepsTok >= tokenCount ||
      tokens[stepsTok].type != JSMN_ARRAY || tokens[stepsTok].size != 1) {
    return true;
  }

  const int onlyStepTok = jsmn_get_array_elem(tokens, stepsTok, 0, tokenCount);
  if (onlyStepTok < 0 || onlyStepTok >= tokenCount ||
      tokens[onlyStepTok].type != JSMN_OBJECT) {
    return false;
  }

  const int opTok =
      jsmn_find_object_key(json, tokens, onlyStepTok, "op", tokenCount);
  if (opTok < 0 || opTok >= tokenCount || tokens[opTok].type != JSMN_STRING) {
    return false;
  }

  *outIsSingle = jsmn_token_streq(json, &tokens[opTok], "callContract");
  return true;
}

bool v2_execute_workflow_request(const char *json, const jsmntok_t *tokens,
                                 const int tokenCount) {
  int argsTok = jsmn_find_object_key(json, tokens, 0, "args", tokenCount);
  if (argsTok < 0) {
    write_error_json_ex("invalid_request", "v2 request requires args", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int workflowTok =
      jsmn_find_object_key(json, tokens, 0, "workflow", tokenCount);
  if (workflowTok < 0 || tokens[workflowTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "v2 request requires workflow object",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int stepsTok =
      jsmn_find_object_key(json, tokens, workflowTok, "steps", tokenCount);
  if (stepsTok < 0 || tokens[stepsTok].type != JSMN_ARRAY ||
      tokens[stepsTok].size <= 0) {
    write_error_json_ex("invalid_request",
                        "v2 workflow.steps must be a non-empty array", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int cleanupTok =
      jsmn_find_object_key(json, tokens, workflowTok, "cleanup", tokenCount);
  if (cleanupTok >= 0 && tokens[cleanupTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "v2 workflow.cleanup must be an array",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  bool isSingleCallContract = false;
  if (!v2_is_single_call_contract_workflow(
          json, tokens, tokenCount, stepsTok, &isSingleCallContract)) {
    write_error_json_ex("invalid_request",
                        "v2 workflow.steps parse error",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  bool hasWorkflowCallContract = false;
  if (!v2_step_array_contains_op(json,
                                 tokens,
                                 tokenCount,
                                 stepsTok,
                                 "callContract",
                                 &hasWorkflowCallContract)) {
    write_error_json_ex("invalid_request",
                        "v2 workflow.steps parse error",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  bool hasCleanupCallContract = false;
  if (cleanupTok >= 0 &&
      !v2_step_array_contains_op(json,
                                 tokens,
                                 tokenCount,
                                 cleanupTok,
                                 "callContract",
                                 &hasCleanupCallContract)) {
    write_error_json_ex("invalid_request",
                        "v2 workflow.cleanup parse error",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (hasCleanupCallContract) {
    write_error_json_ex("invalid_request",
                        "v3 callContract workflow must not define cleanup steps",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (hasWorkflowCallContract && !isSingleCallContract) {
    write_error_json_ex("invalid_request",
                        "v3 callContract is only supported as a single-step workflow",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (isSingleCallContract) {
    if (tokens[argsTok].type != JSMN_ARRAY) {
      write_error_json_ex("invalid_args",
                          "v3 callContract expects case args to be an array",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    if (cleanupTok >= 0 && tokens[cleanupTok].size > 0) {
      write_error_json_ex("invalid_request",
                          "v3 callContract workflow must not define cleanup steps",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }
  } else if (tokens[argsTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "v2 request requires object args",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  V2RefEntry refs[V2_MAX_REFS];
  memset(refs, 0, sizeof(refs));
  int refCount = 0;

  char *projectResultObjectJson = NULL;
  bool ok = true;

  ok = v2_execute_step_array(json,
                             tokens,
                             tokenCount,
                             stepsTok,
                             argsTok,
                             refs,
                             &refCount,
                             true,
                             &projectResultObjectJson,
                             "v2 workflow step must be an object",
                             "v2 workflow step missing string op",
                             "Unsupported v2 workflow op");

  if (ok && projectResultObjectJson == NULL) {
    write_error_json_ex("invalid_request",
                        "v2 workflow must include projectResult", NULL, NULL,
                        NULL, NULL);
    ok = false;
  }

  if (ok && cleanupTok >= 0) {
    ok = v2_execute_step_array(json,
                               tokens,
                               tokenCount,
                               cleanupTok,
                               argsTok,
                               refs,
                               &refCount,
                               false,
                               NULL,
                               "v2 cleanup step must be an object",
                               "v2 cleanup step missing op",
                               "Unsupported v2 cleanup op");
  }

  if (ok) {
    ok = v2_write_project_result_success_json(projectResultObjectJson);
  }

  v2_cleanup_live_refs_best_effort(refs, refCount);
  free(projectResultObjectJson);
  v2_free_all_refs(refs, refCount);
  return ok;
}
