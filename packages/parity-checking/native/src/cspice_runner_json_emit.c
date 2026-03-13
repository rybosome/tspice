#include "cspice_runner_json_emit.h"

// --- JSON output helpers ----------------------------------------------------

void json_print_escaped(const char *s) {
  // JSON string value (no surrounding quotes).
  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    const unsigned char c = *p;
    switch (c) {
    case '"':
      fputs("\\\"", stdout);
      break;
    case '\\':
      fputs("\\\\", stdout);
      break;
    case '\b':
      fputs("\\b", stdout);
      break;
    case '\f':
      fputs("\\f", stdout);
      break;
    case '\n':
      fputs("\\n", stdout);
      break;
    case '\r':
      fputs("\\r", stdout);
      break;
    case '\t':
      fputs("\\t", stdout);
      break;
    default:
      if (c < 0x20) {
        // Control chars -> \u00XX
        fprintf(stdout, "\\u%04x", (unsigned int)c);
      } else {
        fputc((int)c, stdout);
      }
    }
  }
}

void trim_fixed_width_c_string_end(char *s, size_t maxBytes) {
  if (s == NULL || maxBytes == 0) {
    return;
  }

  // Find the first NUL byte (or stop at maxBytes).
  size_t n = 0;
  while (n < maxBytes && s[n] != '\0') {
    n++;
  }

  // Trim right ASCII whitespace.
  while (n > 0) {
    const unsigned char c = (unsigned char)s[n - 1];
    const bool isWs = (c == ' ') || (c == '\t') || (c == '\n') || (c == '\r') || (c == '\f') || (c == '\v');
    if (!isWs) {
      break;
    }
    n--;
  }

  if (n < maxBytes) {
    s[n] = '\0';
  } else {
    // Defensive: ensure the string is terminated.
    s[maxBytes - 1] = '\0';
  }
}



void json_print_double_array(const SpiceDouble *arr, int n) {
  fputc('[', stdout);
  for (int i = 0; i < n; i++) {
    if (i != 0) {
      fputc(',', stdout);
    }
    fprintf(stdout, "%.17g", (double)arr[i]);
  }
  fputc(']', stdout);
}

void json_print_spiceint_array(const SpiceInt *arr, int n) {
  fputc('[', stdout);
  for (int i = 0; i < n; i++) {
    if (i != 0) {
      fputc(',', stdout);
    }
    fprintf(stdout, "%" PRIdMAX, (intmax_t)arr[i]);
  }
  fputc(']', stdout);
}

void json_print_mat3_rowmajor(const SpiceDouble m[3][3]) {
  fputc('[', stdout);
  for (int r = 0; r < 3; r++) {
    for (int c = 0; c < 3; c++) {
      if (!(r == 0 && c == 0)) {
        fputc(',', stdout);
      }
      fprintf(stdout, "%.17g", (double)m[r][c]);
    }
  }
  fputc(']', stdout);
}

void json_print_string_field(const char *key, const char *value,
                                    bool *first) {
  if (value == NULL || value[0] == '\0') {
    return;
  }
  if (!*first) {
    fputc(',', stdout);
  }
  *first = false;

  fputc('"', stdout);
  json_print_escaped(key);
  fputs("\":\"", stdout);
  json_print_escaped(value);
  fputc('"', stdout);
}

void write_error_json_ex_with_call(const char *code, const char *message,
                                          const char *detail, const char *spiceShort,
                                          const char *spiceLong, const char *spiceTrace,
                                          const char *detailsCall) {
  fputs("{\"ok\":false,\"error\":{", stdout);

  bool first = true;
  json_print_string_field("code", code, &first);
  json_print_string_field("message", message ? message : "error", &first);
  json_print_string_field("detail", detail, &first);
  json_print_string_field("spiceShort", spiceShort, &first);
  json_print_string_field("spiceLong", spiceLong, &first);
  json_print_string_field("spiceTrace", spiceTrace, &first);

  if (detailsCall != NULL && detailsCall[0] != '\0') {
    if (!first) {
      fputc(',', stdout);
    }
    first = false;

    fputs("\"details\":{", stdout);
    bool detailsFirst = true;
    json_print_string_field("call", detailsCall, &detailsFirst);
    fputc('}', stdout);
  }

  fputs("}}\n", stdout);
}

void write_error_json_ex(const char *code, const char *message,
                                const char *detail, const char *spiceShort,
                                const char *spiceLong, const char *spiceTrace) {
  write_error_json_ex_with_call(code, message, detail, spiceShort, spiceLong, spiceTrace, NULL);
}

void write_error_json(const char *message, const char *spiceShort,
                             const char *spiceLong, const char *spiceTrace) {
  write_error_json_ex(NULL, message, NULL, spiceShort, spiceLong, spiceTrace);
}

void write_generated_dispatch_unavailable_json(const char *lane,
                                               const char *callId,
                                               const char *fn) {
  const char *laneValue = (lane != NULL && lane[0] != '\0') ? lane : "cspice";
  const char *callIdValue =
      (callId != NULL && callId[0] != '\0') ? callId : "unknown::0";
  const char *fnValue = (fn != NULL) ? fn : "";

  fputs("{\"ok\":false,\"error\":{", stdout);
  fputs("\"code\":\"generated_dispatch_unavailable\",", stdout);
  fputs("\"lane\":\"", stdout);
  json_print_escaped(laneValue);
  fputs("\",\"callId\":\"", stdout);
  json_print_escaped(callIdValue);
  fputs("\",\"reason\":\"generated-dispatch-unavailable\",", stdout);
  fputs("\"details\":{", stdout);
  fputs("\"dispatchHandoffAttempted\":true,", stdout);
  fputs("\"fallbackUsed\":false,", stdout);
  fputs("\"stopPoint\":\"generated-dispatch-unavailable\",", stdout);
  fputs("\"fn\":\"", stdout);
  json_print_escaped(fnValue);
  fputs("\"}}}\n", stdout);
}
