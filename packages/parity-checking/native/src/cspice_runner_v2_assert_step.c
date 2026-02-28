#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_assert_step.h"

static bool v2_string_is_blank(const char *value) {
  if (value == NULL || value[0] == '\0') {
    return true;
  }

  for (const unsigned char *p = (const unsigned char *)value; *p; p++) {
    if (!isspace(*p)) {
      return false;
    }
  }

  return true;
}

static bool v2_strdup_string_token_or_error(const char *json,
                                            const jsmntok_t *token,
                                            const char *label,
                                            char **outValue) {
  *outValue = NULL;

  char detail[256];
  detail[0] = '\0';
  jsmn_strdup_err_t err =
      jsmn_strdup(json, token, outValue, detail, sizeof(detail));
  if (err != JSMN_STRDUP_OK) {
    if (err == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          detail[0] ? detail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  if (v2_string_is_blank(*outValue)) {
    char message[256];
    snprintf(message, sizeof(message), "%s must be a non-empty string", label);
    write_error_json_ex("invalid_request", message, NULL, NULL, NULL, NULL);
    free(*outValue);
    *outValue = NULL;
    return false;
  }

  return true;
}

static bool v2_is_assert_operator_supported(const char *operatorName) {
  return strcmp(operatorName, "eq") == 0 ||
         strcmp(operatorName, "ne") == 0 ||
         strcmp(operatorName, "gt") == 0 ||
         strcmp(operatorName, "gte") == 0 ||
         strcmp(operatorName, "lt") == 0 ||
         strcmp(operatorName, "lte") == 0;
}

static bool v2_evaluate_assert_operator(const char *operatorName,
                                        const SpiceInt left,
                                        const SpiceInt right,
                                        bool *outPassed) {
  if (strcmp(operatorName, "eq") == 0) {
    *outPassed = left == right;
    return true;
  }

  if (strcmp(operatorName, "ne") == 0) {
    *outPassed = left != right;
    return true;
  }

  if (strcmp(operatorName, "gt") == 0) {
    *outPassed = left > right;
    return true;
  }

  if (strcmp(operatorName, "gte") == 0) {
    *outPassed = left >= right;
    return true;
  }

  if (strcmp(operatorName, "lt") == 0) {
    *outPassed = left < right;
    return true;
  }

  if (strcmp(operatorName, "lte") == 0) {
    *outPassed = left <= right;
    return true;
  }

  return false;
}

bool v2_execute_assert_step(const char *json, const jsmntok_t *tokens,
                                   const int tokenCount, const int stepTok,
                                   const int argsTok, V2RefEntry *refs,
                                   const int refCount) {
  int testTok = jsmn_find_object_key(json, tokens, stepTok, "test", tokenCount);
  int errorTok = jsmn_find_object_key(json, tokens, stepTok, "error", tokenCount);

  if (testTok < 0 || tokens[testTok].type != JSMN_OBJECT ||
      errorTok < 0 || tokens[errorTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_request",
                        "assert requires object 'test' and object 'error'",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  const int testPairCount = jsmn_object_pair_count(&tokens[testTok]);
  if (testPairCount != 1) {
    write_error_json_ex("invalid_request",
                        "assert.test must define exactly one operator",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  int operatorTok = testTok + 1;
  int operandsTok = operatorTok + 1;
  if (operatorTok < 0 || operatorTok >= tokenCount ||
      tokens[operatorTok].type != JSMN_STRING ||
      operandsTok < 0 || operandsTok >= tokenCount) {
    write_error_json_ex("invalid_request", "assert.test parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  char *operatorName = NULL;
  if (!v2_strdup_string_token_or_error(json,
                                       &tokens[operatorTok],
                                       "assert.test operator",
                                       &operatorName)) {
    return false;
  }

  if (!v2_is_assert_operator_supported(operatorName)) {
    write_error_json_ex("invalid_request",
                        "assert.test operator must be one of \"eq\", \"ne\", \"gt\", \"gte\", \"lt\", \"lte\"",
                        NULL, NULL, NULL, NULL);
    free(operatorName);
    return false;
  }

  if (tokens[operandsTok].type != JSMN_ARRAY || tokens[operandsTok].size != 2) {
    char message[256];
    snprintf(message, sizeof(message), "assert.test.%s must be a 2-item array",
             operatorName);
    write_error_json_ex("invalid_request", message, NULL, NULL, NULL, NULL);
    free(operatorName);
    return false;
  }

  int leftTok = jsmn_get_array_elem(tokens, operandsTok, 0, tokenCount);
  int rightTok = jsmn_get_array_elem(tokens, operandsTok, 1, tokenCount);
  if (leftTok < 0 || rightTok < 0) {
    write_error_json_ex("invalid_request", "assert.test parse error", NULL,
                        NULL, NULL, NULL);
    free(operatorName);
    return false;
  }

  SpiceInt left = 0;
  SpiceInt right = 0;
  char leftLabel[128];
  char rightLabel[128];
  snprintf(leftLabel, sizeof(leftLabel), "assert.test.%s[0]", operatorName);
  snprintf(rightLabel, sizeof(rightLabel), "assert.test.%s[1]", operatorName);

  if (!v2_resolve_spiceint_expr(json, tokens, tokenCount, leftTok, argsTok, refs,
                                refCount, leftLabel, &left)) {
    free(operatorName);
    return false;
  }

  if (!v2_resolve_spiceint_expr(json, tokens, tokenCount, rightTok, argsTok,
                                refs, refCount, rightLabel, &right)) {
    free(operatorName);
    return false;
  }

  int errorCodeTok =
      jsmn_find_object_key(json, tokens, errorTok, "code", tokenCount);
  int errorMessageTok =
      jsmn_find_object_key(json, tokens, errorTok, "message", tokenCount);
  if (errorCodeTok < 0 || tokens[errorCodeTok].type != JSMN_STRING ||
      errorMessageTok < 0 || tokens[errorMessageTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request",
                        "assert.error requires string code and string message",
                        NULL, NULL, NULL, NULL);
    free(operatorName);
    return false;
  }

  char *errorCode = NULL;
  char *errorMessage = NULL;
  if (!v2_strdup_string_token_or_error(json,
                                       &tokens[errorCodeTok],
                                       "assert.error.code",
                                       &errorCode)) {
    free(operatorName);
    return false;
  }

  if (!v2_strdup_string_token_or_error(json,
                                       &tokens[errorMessageTok],
                                       "assert.error.message",
                                       &errorMessage)) {
    free(errorCode);
    free(operatorName);
    return false;
  }

  bool passed = false;
  if (!v2_evaluate_assert_operator(operatorName, left, right, &passed)) {
    write_error_json_ex("invalid_request",
                        "assert.test operator must be one of \"eq\", \"ne\", \"gt\", \"gte\", \"lt\", \"lte\"",
                        NULL, NULL, NULL, NULL);
    free(errorMessage);
    free(errorCode);
    free(operatorName);
    return false;
  }

  free(operatorName);

  if (passed) {
    free(errorMessage);
    free(errorCode);
    return true;
  }

  write_error_json_ex(errorCode, errorMessage, NULL, NULL, NULL, NULL);
  free(errorMessage);
  free(errorCode);
  return false;
}
