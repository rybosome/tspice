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

// Each N0067 position wrapper converts start to Fortran indexing by adding
// one. Both INT_MAX and INT_MAX-1 are past every possible last candidate
// (the payload and NUL together must fit SpiceInt). Use the latter carrier
// only for INT_MAX, retaining the canonical forward and reverse searches.
static int search_start(int start) {
  return start == INT_MAX ? INT_MAX - 1 : start;
}

static int search_result(int result, int *out, char *err, int errMaxBytes) {
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = result;
  return 0;
}

int tspice_cpos(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(text) || !tspice_string_valid(chars))
    return tspice_string_invalid_arg(err, errMaxBytes);
  const int result = cpos_c(text, chars, search_start(start));
  return search_result(result, out, err, errMaxBytes);
}

int tspice_cposr(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(text) || !tspice_string_valid(chars))
    return tspice_string_invalid_arg(err, errMaxBytes);
  const int result = cposr_c(text, chars, search_start(start));
  return search_result(result, out, err, errMaxBytes);
}

int tspice_ncpos(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(text) || !tspice_string_valid(chars))
    return tspice_string_invalid_arg(err, errMaxBytes);
  const int result = ncpos_c(text, chars, search_start(start));
  return search_result(result, out, err, errMaxBytes);
}

int tspice_ncposr(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(text) || !tspice_string_valid(chars))
    return tspice_string_invalid_arg(err, errMaxBytes);
  const int result = ncposr_c(text, chars, search_start(start));
  return search_result(result, out, err, errMaxBytes);
}

int tspice_pos(const char *text, const char *substr, int start, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(text) || !tspice_string_valid(substr))
    return tspice_string_invalid_arg(err, errMaxBytes);
  const int result = pos_c(text, substr, search_start(start));
  return search_result(result, out, err, errMaxBytes);
}

int tspice_posr(const char *text, const char *substr, int start, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(text) || !tspice_string_valid(substr))
    return tspice_string_invalid_arg(err, errMaxBytes);
  const int result = posr_c(text, substr, search_start(start));
  return search_result(result, out, err, errMaxBytes);
}

int tspice_esrchc(const char *value, int count, int width, const char *rows, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !tspice_string_valid(value) || !rows || count < 0 || width < 2 || count > INT_MAX / width)
    return tspice_string_invalid_arg(err, errMaxBytes);
  // ESRCHC uses signed row offsets and EQSTR reads each row as a C string.
  for (int i = 0; i < count; i++)
    if (!memchr(rows + i * width, 0, (size_t)width))
      return tspice_string_invalid_arg(err, errMaxBytes);
  return search_result(esrchc_c(value, count, width, rows), out, err, errMaxBytes);
}
