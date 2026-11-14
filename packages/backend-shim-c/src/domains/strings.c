#include "tspice_backend_shim.h"
#include "SpiceUsr.h"
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

// The translated parsers advance their one-based cursor as far as length+2.
static int token_input_valid(const char *input) {
  return input && strlen(input) <= INT_MAX - 2;
}

static int finish_token_call(char *err, int errMaxBytes) {
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_nextwd(const char *input, int nexlen, int reslen, char *next, char *rest, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !next || !rest) return tspice_string_invalid_arg(err, errMaxBytes);
  nextwd_c(input, nexlen, reslen, next, rest);
  return finish_token_call(err, errMaxBytes);
}

int tspice_nthwd(const char *input, int nth, int worlen, char *word, int *loc, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !word || !loc) return tspice_string_invalid_arg(err, errMaxBytes);
  // Every accepted byte string has fewer than INT_MAX words.
  nthwd_c(input, nth == INT_MAX ? -1 : nth, worlen, word, loc);
  return finish_token_call(err, errMaxBytes);
}

int tspice_lparse(const char *list, const char *delim, int nmax, int itemln, int *n, char *items, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(list) || !tspice_string_valid(delim) || !n || !items ||
      (nmax > 0 && itemln >= 2 && nmax > INT_MAX / itemln)) return tspice_string_invalid_arg(err, errMaxBytes);
  lparse_c(list, delim, nmax, itemln, n, items);
  return finish_token_call(err, errMaxBytes);
}

int tspice_lparsm(const char *list, const char *delims, int nmax, int itemln, int *n, char *items, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(list) || !tspice_string_valid(delims) || !n || !items ||
      (nmax > 0 && itemln >= 2 && nmax > INT_MAX / itemln)) return tspice_string_invalid_arg(err, errMaxBytes);
  lparsm_c(list, delims, nmax, itemln, n, items);
  return finish_token_call(err, errMaxBytes);
}

int tspice_lx4dec(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !last || !nchar) return tspice_string_invalid_arg(err, errMaxBytes);
  // Map out-of-bounds starts before N0067's signed one-based conversion.
  const int safe = first < 0 || (size_t)first >= strlen(input) ? -1 : first;
  int end = safe - 1;
  int count = 0;
  lx4dec_c(input, safe, &end, &count);
  *nchar = count;
  *last = safe != first && *input ? (double)first - 1.0 : (double)end;
  return finish_token_call(err, errMaxBytes);
}

int tspice_lx4num(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !last || !nchar) return tspice_string_invalid_arg(err, errMaxBytes);
  // Map out-of-bounds starts before N0067's signed one-based conversion.
  const int safe = first < 0 || (size_t)first >= strlen(input) ? -1 : first;
  int end = safe - 1;
  int count = 0;
  lx4num_c(input, safe, &end, &count);
  *nchar = count;
  *last = safe != first && *input ? (double)first - 1.0 : (double)end;
  return finish_token_call(err, errMaxBytes);
}

int tspice_lx4sgn(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !last || !nchar) return tspice_string_invalid_arg(err, errMaxBytes);
  // Map out-of-bounds starts before N0067's signed one-based conversion.
  const int safe = first < 0 || (size_t)first >= strlen(input) ? -1 : first;
  int end = safe - 1;
  int count = 0;
  lx4sgn_c(input, safe, &end, &count);
  *nchar = count;
  *last = safe != first && *input ? (double)first - 1.0 : (double)end;
  return finish_token_call(err, errMaxBytes);
}

int tspice_lx4uns(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !last || !nchar) return tspice_string_invalid_arg(err, errMaxBytes);
  // Map out-of-bounds starts before N0067's signed one-based conversion.
  const int safe = first < 0 || (size_t)first >= strlen(input) ? -1 : first;
  // LX4UNS leaves both outputs untouched for the empty input. Seed its specified miss.
  int end = safe - 1;
  int count = 0;
  lx4uns_c(input, safe, &end, &count);
  *nchar = count;
  *last = safe != first ? (double)first - 1.0 : (double)end;
  return finish_token_call(err, errMaxBytes);
}

int tspice_lxqstr(const char *input, int qchar, int first, double *last, int *nchar, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!token_input_valid(input) || !last || !nchar || qchar < 0 || qchar > 127) return tspice_string_invalid_arg(err, errMaxBytes);
  // Map out-of-bounds starts before N0067's signed one-based conversion.
  const int safe = first < 0 || (size_t)first >= strlen(input) ? -1 : first;
  int end = safe - 1;
  int count = 0;
  lxqstr_c(input, (SpiceChar)qchar, safe, &end, &count);
  *nchar = count;
  *last = safe != first ? (double)first - 1.0 : (double)end;
  return finish_token_call(err, errMaxBytes);
}
