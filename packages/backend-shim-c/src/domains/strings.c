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
