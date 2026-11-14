#include "tspice_backend_shim.h"
#include "SpiceUsr.h"
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <limits.h>
#include <string.h>

static int tspice_string_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "Invalid CSPICE string buffer or byte value", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

static int tspice_string_valid(const char *s) {
  return s && strlen(s) < INT_MAX;
}

// For a valid HEX mantissa of at most 31 digits, its magnitude is zero
// or between 16^-31 and 1 (inclusive after rounding). Beyond +/-1024
// base-16 places, binary64 has already overflowed or underflowed. Bound
// the actual N0067 loop, including its unsafe signed endpoint increments,
// without changing malformed mantissas/exponents or toolkit diagnostics.
static const char *bounded_hx2dp_input(const char *input, char bounded[40]) {
  const char *start = input;
  while (*start == ' ') ++start;
  const char *p = start;
  if (*p == '+' || *p == '-') ++p;
  const char *digits = p;
  while ((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f') || (*p >= 'A' && *p <= 'F')) ++p;
  if (p - digits > 31 || *p != '^') return input;
  const size_t prefix = (size_t)(++p - start);
  while (*p == ' ') ++p;
  const int negative = *p == '-';
  if (*p == '+' || negative) ++p;
  const uint32_t limit = negative ? UINT32_C(2147483648) : UINT32_C(2147483647);
  uint32_t magnitude = 0;
  for (; *p && *p != ' '; ++p) {
    unsigned digit;
    if (*p >= '0' && *p <= '9') digit = (unsigned)(*p - '0');
    else if (*p >= 'a' && *p <= 'f') digit = (unsigned)(*p - 'a') + 10;
    else if (*p >= 'A' && *p <= 'F') digit = (unsigned)(*p - 'A') + 10;
    else return input;
    if (magnitude > (limit - digit) / 16) return input;
    magnitude = magnitude * 16 + digit;
  }
  while (*p == ' ') ++p;
  if (*p || magnitude <= 1024) return input;
  memcpy(bounded, start, prefix);
  strcpy(bounded + prefix, negative ? "-400" : "400");
  return bounded;
}

// INTTXT negates its signed input. REPMCT/REPMOT call INTTXT only
// after the C wrapper's early exits, case validation, and marker match.
static int unsafe_word_integer(const char *input, const char *marker, int value, int rtcase, int lenout) {
  if (value != INT_MIN || lenout < 2 || !*input || !strchr("UuLlCc", rtcase) || !rtcase) return 0;
  while (*marker == ' ') ++marker;
  size_t length = strlen(marker);
  while (length && marker[length-1] == ' ') --length;
  if (!length) return 0;
  const size_t bytes = strlen(input);
  if (length > bytes) return 0;
  for (size_t i = 0; i <= bytes - length; ++i) {
    if (memcmp(input + i, marker, length) == 0) return 1;
  }
  return 0;
}

int tspice_dp2hx(double value, int lenout, char *text, int *size, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!isfinite(value) || !text || !size) return tspice_string_invalid_arg(err, errMaxBytes);
  dp2hx_c(value, lenout, text, size);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_hx2dp(const char *input, int lenout, double *number, int *error, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !number || !error || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  char bounded[40];
  hx2dp_c(bounded_hx2dp_input(input, bounded), lenout, number, error, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_prsdp(const char *input, double *number, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !number) return tspice_string_invalid_arg(err, errMaxBytes);
  prsdp_c(input, number);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_prsint(const char *input, int *number, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !number) return tspice_string_invalid_arg(err, errMaxBytes);
  prsint_c(input, number);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repmc(const char *input, const char *marker, const char *value, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || !tspice_string_valid(value) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  const size_t extra = strlen(value) ? strlen(value) : 1;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repmc_c(input, marker, value, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repmct(const char *input, const char *marker, int value, int rtcase, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || (rtcase < 0 || rtcase > 127) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  if (unsafe_word_integer(input, marker, value, rtcase, lenout)) {
    tspice_string_invalid_arg(err, errMaxBytes);
    if (err && errMaxBytes > 0) snprintf(err, (size_t)errMaxBytes, "N0067 integer word conversion cannot negate INT32_MIN");
    return 1;
  }
  const size_t extra = 145;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repmct_c(input, marker, value, (SpiceChar)rtcase, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repmd(const char *input, const char *marker, double value, int sigdig, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || !isfinite(value) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  const size_t extra = 23;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repmd_c(input, marker, value, sigdig, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repmf(const char *input, const char *marker, double value, int sigdig, int format, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || !isfinite(value) || (format < 0 || format > 127) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  const size_t extra = 56;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repmf_c(input, marker, value, sigdig, (SpiceChar)format, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repmi(const char *input, const char *marker, int value, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  const size_t extra = 11;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repmi_c(input, marker, value, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repml(const char *input, const char *marker, int value, int rtcase, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || (value != 0 && value != 1) || (rtcase < 0 || rtcase > 127) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  const size_t extra = 5;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repml_c(input, marker, value, (SpiceChar)rtcase, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_repmot(const char *input, const char *marker, int value, int rtcase, int lenout, char *text, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!tspice_string_valid(input) || !tspice_string_valid(marker) || (rtcase < 0 || rtcase > 127) || !text) return tspice_string_invalid_arg(err, errMaxBytes);
  if (unsafe_word_integer(input, marker, value, rtcase, lenout)) {
    tspice_string_invalid_arg(err, errMaxBytes);
    if (err && errMaxBytes > 0) snprintf(err, (size_t)errMaxBytes, "N0067 integer word conversion cannot negate INT32_MIN");
    return 1;
  }
  const size_t extra = 147;
  if (strlen(input) > (size_t)INT_MAX - extra - 1) return tspice_string_invalid_arg(err, errMaxBytes);
  repmot_c(input, marker, value, (SpiceChar)rtcase, lenout, text);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_cmprss(int delim, int n, const char *input, int lenout, char *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input) || delim < 0 || delim > 127) return tspice_string_invalid_arg(err, errMaxBytes);
  cmprss_c((SpiceChar)delim, (SpiceInt)n, input, (SpiceInt)lenout, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_eqstr(const char *a, const char *b, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(a) || !tspice_string_valid(b)) return tspice_string_invalid_arg(err, errMaxBytes);
  *out = eqstr_c(a, b) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_iswhsp(const char *input, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input)) return tspice_string_invalid_arg(err, errMaxBytes);
  *out = iswhsp_c(input) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lastnb(const char *input, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input)) return tspice_string_invalid_arg(err, errMaxBytes);
  *out = lastnb_c(input);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lcase(char *input, int lenout, char *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input)) return tspice_string_invalid_arg(err, errMaxBytes);
  lcase_c(input, (SpiceInt)lenout, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_ucase(char *input, int lenout, char *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input)) return tspice_string_invalid_arg(err, errMaxBytes);
  ucase_c(input, (SpiceInt)lenout, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_matchi(const char *input, const char *templ, int wstr, int wchr, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input) || !tspice_string_valid(templ) || wstr < 0 || wstr > 127 || wchr < 0 || wchr > 127) return tspice_string_invalid_arg(err, errMaxBytes);
  *out = matchi_c(input, templ, (SpiceChar)wstr, (SpiceChar)wchr) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_matchw(const char *input, const char *templ, int wstr, int wchr, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !tspice_string_valid(input) || !tspice_string_valid(templ) || wstr < 0 || wstr > 127 || wchr < 0 || wchr > 127) return tspice_string_invalid_arg(err, errMaxBytes);
  *out = matchw_c(input, templ, (SpiceChar)wstr, (SpiceChar)wchr) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}
