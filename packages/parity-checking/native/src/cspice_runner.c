#define _POSIX_C_SOURCE 200809L

#include "cspice_runner_common.h"
#include "cspice_runner_error.h"
#include "cspice_runner_io.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_json_emit.h"
#include "cspice_runner_setup_kernels.h"
#include "cspice_runner_workflow.h"

int main(void) {
  int exitCode = 0;

  if (setlocale(LC_NUMERIC, "C") == NULL) {
    write_error_json_ex("invalid_request", "Failed to initialize numeric locale",
                        NULL, NULL, NULL, NULL);
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
      exitCode = 1;
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

  int tokenCapacity = 512;
  jsmntok_t *tokens = (jsmntok_t *)malloc(sizeof(jsmntok_t) * (size_t)tokenCapacity);
  if (tokens == NULL) {
    free(input);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return 1;
  }

  int tokenCount = 0;
  while (true) {
    jsmn_parser parser;
    jsmn_init(&parser);

    int parseErr =
        jsmn_parse(&parser, input, inputLen, tokens, (unsigned int)tokenCapacity);
    if (parseErr >= 0) {
      tokenCount = parseErr;
      break;
    }

    if (parseErr == JSMN_ERROR_NOMEM) {
      int nextCapacity = tokenCapacity * 2;
      jsmntok_t *next =
          (jsmntok_t *)realloc(tokens, sizeof(jsmntok_t) * (size_t)nextCapacity);
      if (next == NULL) {
        free(tokens);
        free(input);
        write_error_json("Out of memory", NULL, NULL, NULL);
        return 1;
      }
      tokens = next;
      tokenCapacity = nextCapacity;
      continue;
    }

    if (parseErr == JSMN_ERROR_PART) {
      write_error_json_ex("invalid_request", "Invalid JSON: incomplete payload",
                          NULL, NULL, NULL, NULL);
    } else if (parseErr == JSMN_ERROR_INVAL) {
      write_error_json_ex("invalid_request", "Invalid JSON", NULL, NULL, NULL,
                          NULL);
    } else {
      write_error_json_ex("invalid_request", "Invalid JSON", NULL, NULL, NULL,
                          NULL);
    }

    free(tokens);
    free(input);
    return 1;
  }

  if (tokenCount <= 0 || tokens[0].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request", "Expected top-level JSON object", NULL,
                        NULL, NULL, NULL);
    exitCode = 1;
    goto done;
  }

  int setupTok = jsmn_find_object_key(input, tokens, 0, "setup", tokenCount);
  int schemaVersionTok =
      jsmn_find_object_key(input, tokens, 0, "schemaVersion", tokenCount);

  if (schemaVersionTok < 0 || schemaVersionTok >= tokenCount) {
    write_error_json_ex("invalid_request", "Missing required field: schemaVersion",
                        NULL, NULL, NULL, NULL);
    exitCode = 1;
    goto done;
  }

  int schemaVersion = 0;
  parse_result schemaParse =
      jsmn_parse_int(input, &tokens[schemaVersionTok], &schemaVersion);
  if (schemaParse != PARSE_OK) {
    write_error_json_ex("invalid_request",
                        "schemaVersion must be an integer literal", NULL, NULL,
                        NULL, NULL);
    exitCode = 1;
    goto done;
  }

  if (schemaVersion != 3) {
    char detail[96];
    snprintf(detail, sizeof(detail), "%d", schemaVersion);
    write_error_json_ex("invalid_request",
                        "Unsupported schemaVersion (expected 3)", detail, NULL,
                        NULL, NULL);
    exitCode = 1;
    goto done;
  }

  // Ensure CSPICE errors are captured rather than printed to stdout/stderr.
  kclear_c();
  reset_c();
  erract_c("SET", 0, "RETURN");
  errprt_c("SET", 0, "NONE");

  if (!apply_setup_kernels(input, tokens, tokenCount, setupTok, &exitCode)) {
    goto done;
  }

  if (!execute_canonical_workflow_request(input, tokens, tokenCount)) {
    exitCode = 1;
    goto done;
  }

done:
  // Clear state even though this is a single-shot process.
  kclear_c();
  reset_c();

  free(tokens);
  free(input);
  return exitCode;
}
