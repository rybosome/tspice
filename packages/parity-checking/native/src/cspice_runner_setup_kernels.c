#include "cspice_runner_json_core.h"
#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_setup_kernels.h"

bool apply_setup_kernels(const char *input, const jsmntok_t *tokens,
                                const int tokenCount, const int setupTok,
                                int *exitCode) {
  if (setupTok < 0 || tokens[setupTok].type != JSMN_OBJECT) {
    return true;
  }

  int kernelsTok =
      jsmn_find_object_key(input, tokens, setupTok, "kernels", tokenCount);
  if (kernelsTok < 0) {
    return true;
  }

  if (tokens[kernelsTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "setup.kernels must be an array", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int nKernels = tokens[kernelsTok].size;
  int idx = kernelsTok + 1;
  char strDetail[256];

  for (int i = 0; i < nKernels; i++) {
    if (idx >= tokenCount) {
      write_error_json_ex("invalid_request", "setup.kernels parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char *kernelPath = NULL;
    char *restrictToDir = NULL;

    if (tokens[idx].type == JSMN_STRING) {
      strDetail[0] = '\0';
      jsmn_strdup_err_t kErr =
          jsmn_strdup(input, &tokens[idx], &kernelPath, strDetail,
                      sizeof(strDetail));
      if (kErr != JSMN_STRDUP_OK) {
        if (kErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL,
                              NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        return false;
      }
    } else if (tokens[idx].type == JSMN_OBJECT) {
      int pathTok =
          jsmn_find_object_key(input, tokens, idx, "path", tokenCount);
      if (pathTok < 0 || tokens[pathTok].type != JSMN_STRING) {
        write_error_json_ex(
            "invalid_request",
            "setup.kernels entries must have a string 'path' field", NULL,
            NULL, NULL, NULL);
        return false;
      }

      strDetail[0] = '\0';
      jsmn_strdup_err_t pathErr =
          jsmn_strdup(input, &tokens[pathTok], &kernelPath, strDetail,
                      sizeof(strDetail));
      if (pathErr != JSMN_STRDUP_OK) {
        if (pathErr == JSMN_STRDUP_INVALID) {
          write_error_json_ex("invalid_request", "Invalid JSON string escape",
                              strDetail[0] ? strDetail : NULL, NULL, NULL,
                              NULL);
        } else {
          write_error_json("Out of memory", NULL, NULL, NULL);
        }
        return false;
      }

      int restrictTok = jsmn_find_object_key(input, tokens, idx, "restrictToDir",
                                             tokenCount);
      if (restrictTok >= 0) {
        if (tokens[restrictTok].type != JSMN_STRING) {
          write_error_json_ex("invalid_request",
                              "setup.kernels[].restrictToDir must be a string",
                              NULL, NULL, NULL, NULL);
          free(kernelPath);
          return false;
        }

        strDetail[0] = '\0';
        jsmn_strdup_err_t restrictErr =
            jsmn_strdup(input, &tokens[restrictTok], &restrictToDir, strDetail,
                        sizeof(strDetail));
        if (restrictErr != JSMN_STRDUP_OK) {
          if (restrictErr == JSMN_STRDUP_INVALID) {
            write_error_json_ex("invalid_request", "Invalid JSON string escape",
                                strDetail[0] ? strDetail : NULL, NULL, NULL,
                                NULL);
          } else {
            write_error_json("Out of memory", NULL, NULL, NULL);
          }
          free(kernelPath);
          return false;
        }
      }
    } else {
      write_error_json_ex("invalid_request",
                          "setup.kernels entries must be strings or objects",
                          NULL, NULL, NULL, NULL);
      return false;
    }

    char *prevCwd = NULL;
    if (restrictToDir != NULL) {
      prevCwd = getcwd(NULL, 0);
      if (prevCwd == NULL) {
        write_error_json("Failed to getcwd before kernel load", NULL, NULL, NULL);
        *exitCode = 1;
        free(kernelPath);
        free(restrictToDir);
        return false;
      }

      if (chdir(restrictToDir) != 0) {
        char msg[512];
        snprintf(msg, sizeof(msg),
                 "Failed to chdir to restrictToDir: %s (dir=%s)",
                 strerror(errno), restrictToDir);
        write_error_json(msg, NULL, NULL, NULL);
        *exitCode = 1;
        free(prevCwd);
        free(kernelPath);
        free(restrictToDir);
        return false;
      }
    }

    furnsh_c(kernelPath);

    if (prevCwd != NULL) {
      if (chdir(prevCwd) != 0) {
        char msg[512];
        snprintf(msg, sizeof(msg),
                 "Failed to restore cwd after kernel load: %s (cwd=%s)",
                 strerror(errno), prevCwd);
        write_error_json(msg, NULL, NULL, NULL);
        *exitCode = 1;
        free(prevCwd);
        free(kernelPath);
        free(restrictToDir);
        return false;
      }
      free(prevCwd);
    }

    free(kernelPath);
    free(restrictToDir);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json("SPICE error in furnsh", shortMsg, longMsg, traceMsg);
      return false;
    }

    idx = jsmn_skip_subtree(tokens, idx, tokenCount);
  }

  return true;
}