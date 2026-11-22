#include "tspice_matrix_shapes.h"
#include "tspice_error.h"
#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceZfc.h"

#include <stdint.h>
#include "SpiceZfc.h"
#include "tspice_error.h"
#include <limits.h>
#include <math.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

// Error-free scalar routines need no output allocation or error-state changes.
double tspice_pi(void) {
  return (double)pi_c();
}

double tspice_twopi(void) {
  return (double)twopi_c();
}

double tspice_halfpi(void) {
  return (double)halfpi_c();
}

double tspice_dpr(void) {
  return (double)dpr_c();
}

double tspice_rpd(void) {
  return (double)rpd_c();
}

// Error-free scalar routines need no output allocation or error-state changes.
double tspice_clight(void) {
  return (double)clight_c();
}

double tspice_dpmax(void) {
  return (double)dpmax_c();
}

double tspice_dpmin(void) {
  return (double)dpmin_c();
}

int tspice_intmax(void) {
  return (int)intmax_c();
}

int tspice_intmin(void) {
  return (int)intmin_c();
}

static int tspice_coordinate_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "coordinate conversion requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_cyllat(double radius, double lon, double z, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  cyllat_c(radius, lon, z, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_cylrec(double radius, double lon, double z, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  cylrec_c(radius, lon, z, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_cylsph(double radius, double lon, double z, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  cylsph_c(radius, lon, z, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_latcyl(double radius, double lon, double lat, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  latcyl_c(radius, lon, lat, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_latsph(double radius, double lon, double lat, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  latsph_c(radius, lon, lat, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_reccyl(const double *rect3, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3 || !rect3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  reccyl_c(rect3, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_sphcyl(double radius, double colat, double lon, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  sphcyl_c(radius, colat, lon, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

int tspice_sphlat(double radius, double colat, double lon, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out3) return tspice_coordinate_invalid_arg(err, errMaxBytes);
  out3[0] = out3[1] = out3[2] = 0.0;
  SpiceDouble result[3] = {0.0, 0.0, 0.0};
  sphlat_c(radius, colat, lon, &result[0], &result[1], &result[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out3[0] = (double)result[0];
  out3[1] = (double)result[1];
  out3[2] = (double)result[2];
  return 0;
}

static int tspice_basic_vector_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "vector operation requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_vdist(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  const SpiceDouble value = vdist_c(a, b);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = (double)value;
  return 0;
}

int tspice_vequ(const double *v, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vequ_c(v, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vpack(double x, double y, double z, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vpack_c(x, y, z, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vupack(const double *v, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vupack_c(v, &value[0], &value[1], &value[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vzero(const double *v, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceBoolean value = vzero_c(v);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value ? 1 : 0;
  return 0;
}

int tspice_unorm(const double *v, double *outUnit3, double *outNorm, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !outUnit3 || !outNorm) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  outUnit3[0] = outUnit3[1] = outUnit3[2] = 0.0;
  *outNorm = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  SpiceDouble norm = 0.0;
  unorm_c(v, value, &norm);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  outUnit3[0] = value[0];
  outUnit3[1] = value[1];
  outUnit3[2] = value[2];
  *outNorm = norm;
  return 0;
}

int tspice_ucrss(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  ucrss_c(a, b, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vsep(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_basic_vector_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  const SpiceDouble value = vsep_c(a, b);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = (double)value;
  return 0;
}
#include <stdint.h>
#include <stdint.h>
#include <stdint.h>

static void FillMat33(SpiceDouble out[3][3], const double *m3x3) {
  int i;
  int j;
  for (i = 0; i < 3; i++) {
    for (j = 0; j < 3; j++) {
      out[i][j] = 0.0;
    }
  }
  if (!m3x3) {
    return;
  }
  for (i = 0; i < 3; i++) {
    for (j = 0; j < 3; j++) {
      out[i][j] = (SpiceDouble)m3x3[i * 3 + j];
    }
  }
}

static int tspice_combination_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "vector operation requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_vlcom(double a, const double *v1, double b, const double *v2, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v1 || !v2 || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vlcom_c(a, v1, b, v2, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vlcom3(double a, const double *v1, double b, const double *v2, double c, const double *v3, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v1 || !v2 || !v3 || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vlcom3_c(a, v1, b, v2, c, v3, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vperp(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vperp_c(a, b, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vproj(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vproj_c(a, b, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vrel(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  const SpiceDouble value = vrel_c(a, b);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = (double)value;
  return 0;
}

int tspice_vrotv(const double *v, const double *axis, double theta, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !axis || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  vrotv_c(v, axis, theta, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_rotvec(const double *v, double angle, int axis, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  rotvec_c(v, angle, (SpiceInt)axis, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_vtmv(const double *v1, const double *matrix, const double *v2, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v1 || !matrix || !v2 || !out) return tspice_combination_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  SpiceDouble m[3][3];
  FillMat33(m, matrix);
  const SpiceDouble value = vtmv_c(v1, m, v2);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = (double)value;
  return 0;
}

static int tspice_convention_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "coordinate conversion requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_azlrec(double range, double az, double el, int azccw, int elplsz, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  azlrec_c(range, az, el, (SpiceBoolean)azccw, (SpiceBoolean)elplsz, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_recazl(const double *rect, int azccw, int elplsz, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!rect || !out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  recazl_c(rect, (SpiceBoolean)azccw, (SpiceBoolean)elplsz, &value[0], &value[1], &value[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_pgrrec(const char *body, double lon, double lat, double alt, double re, double f, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!body || !out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  pgrrec_c(body, lon, lat, alt, re, f, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_recpgr(const char *body, const double *rect, double re, double f, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!body || !rect || !out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  SpiceDouble rectCopy[3] = {rect[0], rect[1], rect[2]};
  recpgr_c(body, rectCopy, re, f, &value[0], &value[1], &value[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_radrec(double range, double ra, double dec, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  radrec_c(range, ra, dec, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_recrad(const double *rect, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!rect || !out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  recrad_c(rect, &value[0], &value[1], &value[2]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

int tspice_srfrec(int body, double lon, double lat, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_convention_invalid_arg(err, errMaxBytes);
  out[0] = out[1] = out[2] = 0.0;
  SpiceDouble value[3] = {0.0, 0.0, 0.0};
  srfrec_c((SpiceInt)body, lon, lat, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  return 0;
}

static int tspice_scalar_math_invalid_arg(const char *message, char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, message, (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_brcktd(double value, double end1, double end2, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_scalar_math_invalid_arg("brcktd() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  const double result = brcktd_c(value, end1, end2);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = result;
  return 0;
}

int tspice_brckti(int value, int end1, int end2, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_scalar_math_invalid_arg("brckti() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  const int result = brckti_c(value, end1, end2);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = result;
  return 0;
}

int tspice_convrt(double value, const char *inUnit, const char *outUnit, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || !inUnit || !outUnit) return tspice_scalar_math_invalid_arg("convrt() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  SpiceDouble converted = 0.0;
  convrt_c(value, inUnit, outUnit, &converted);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = converted;
  return 0;
}

int tspice_sumad(const double *values, int count, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || count < 0 || (count > 0 && !values)) return tspice_scalar_math_invalid_arg("sumad() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  const double result = sumad_c(values, (SpiceInt)count);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = result;
  return 0;
}

int tspice_sumai(const int *values, int count, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || count < 0 || (count > 0 && !values)) return tspice_scalar_math_invalid_arg("sumai() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  // The pinned implementation accumulates in SpiceInt; do not invoke it
  // when any ordered prefix would have undefined signed-overflow behavior.
  int64_t prefix = 0;
  for (int i = 0; i < count; i++) {
    prefix += values[i];
    if (prefix < INT32_MIN || prefix > INT32_MAX)
      return tspice_scalar_math_invalid_arg("sumai(values) prefix sums must fit signed 32-bit integers", err, errMaxBytes);
  }
  const int result = sumai_c(values, (SpiceInt)count);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = result;
  return 0;
}

int tspice_maxd(const double *values, int count, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || count < 0 || (count > 0 && !values) || count > 30) return tspice_scalar_math_invalid_arg("maxd() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  double value = 0;
  // Call the actual variadic routine with exactly count typed scalars.
  switch (count) {
    case 0: value = maxd_c(0); break;
    case 1: value = maxd_c(1, values[0]); break;
    case 2: value = maxd_c(2, values[0], values[1]); break;
    case 3: value = maxd_c(3, values[0], values[1], values[2]); break;
    case 4: value = maxd_c(4, values[0], values[1], values[2], values[3]); break;
    case 5: value = maxd_c(5, values[0], values[1], values[2], values[3], values[4]); break;
    case 6: value = maxd_c(6, values[0], values[1], values[2], values[3], values[4], values[5]); break;
    case 7: value = maxd_c(7, values[0], values[1], values[2], values[3], values[4], values[5], values[6]); break;
    case 8: value = maxd_c(8, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]); break;
    case 9: value = maxd_c(9, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8]); break;
    case 10: value = maxd_c(10, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9]); break;
    case 11: value = maxd_c(11, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10]); break;
    case 12: value = maxd_c(12, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11]); break;
    case 13: value = maxd_c(13, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12]); break;
    case 14: value = maxd_c(14, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13]); break;
    case 15: value = maxd_c(15, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14]); break;
    case 16: value = maxd_c(16, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15]); break;
    case 17: value = maxd_c(17, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16]); break;
    case 18: value = maxd_c(18, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17]); break;
    case 19: value = maxd_c(19, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18]); break;
    case 20: value = maxd_c(20, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19]); break;
    case 21: value = maxd_c(21, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20]); break;
    case 22: value = maxd_c(22, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21]); break;
    case 23: value = maxd_c(23, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22]); break;
    case 24: value = maxd_c(24, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23]); break;
    case 25: value = maxd_c(25, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24]); break;
    case 26: value = maxd_c(26, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25]); break;
    case 27: value = maxd_c(27, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26]); break;
    case 28: value = maxd_c(28, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27]); break;
    case 29: value = maxd_c(29, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28]); break;
    case 30: value = maxd_c(30, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28], values[29]); break;
    default: return tspice_scalar_math_invalid_arg("unsupported variadic count", err, errMaxBytes);
  }
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_maxi(const int *values, int count, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || count < 0 || (count > 0 && !values) || count > 30) return tspice_scalar_math_invalid_arg("maxi() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  int value = 0;
  // Call the actual variadic routine with exactly count typed scalars.
  switch (count) {
    case 0: value = maxi_c(0); break;
    case 1: value = maxi_c(1, values[0]); break;
    case 2: value = maxi_c(2, values[0], values[1]); break;
    case 3: value = maxi_c(3, values[0], values[1], values[2]); break;
    case 4: value = maxi_c(4, values[0], values[1], values[2], values[3]); break;
    case 5: value = maxi_c(5, values[0], values[1], values[2], values[3], values[4]); break;
    case 6: value = maxi_c(6, values[0], values[1], values[2], values[3], values[4], values[5]); break;
    case 7: value = maxi_c(7, values[0], values[1], values[2], values[3], values[4], values[5], values[6]); break;
    case 8: value = maxi_c(8, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]); break;
    case 9: value = maxi_c(9, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8]); break;
    case 10: value = maxi_c(10, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9]); break;
    case 11: value = maxi_c(11, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10]); break;
    case 12: value = maxi_c(12, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11]); break;
    case 13: value = maxi_c(13, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12]); break;
    case 14: value = maxi_c(14, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13]); break;
    case 15: value = maxi_c(15, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14]); break;
    case 16: value = maxi_c(16, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15]); break;
    case 17: value = maxi_c(17, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16]); break;
    case 18: value = maxi_c(18, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17]); break;
    case 19: value = maxi_c(19, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18]); break;
    case 20: value = maxi_c(20, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19]); break;
    case 21: value = maxi_c(21, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20]); break;
    case 22: value = maxi_c(22, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21]); break;
    case 23: value = maxi_c(23, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22]); break;
    case 24: value = maxi_c(24, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23]); break;
    case 25: value = maxi_c(25, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24]); break;
    case 26: value = maxi_c(26, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25]); break;
    case 27: value = maxi_c(27, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26]); break;
    case 28: value = maxi_c(28, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27]); break;
    case 29: value = maxi_c(29, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28]); break;
    case 30: value = maxi_c(30, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28], values[29]); break;
    default: return tspice_scalar_math_invalid_arg("unsupported variadic count", err, errMaxBytes);
  }
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_mind(const double *values, int count, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || count < 0 || (count > 0 && !values) || count > 30) return tspice_scalar_math_invalid_arg("mind() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  double value = 0;
  // Call the actual variadic routine with exactly count typed scalars.
  switch (count) {
    case 0: value = mind_c(0); break;
    case 1: value = mind_c(1, values[0]); break;
    case 2: value = mind_c(2, values[0], values[1]); break;
    case 3: value = mind_c(3, values[0], values[1], values[2]); break;
    case 4: value = mind_c(4, values[0], values[1], values[2], values[3]); break;
    case 5: value = mind_c(5, values[0], values[1], values[2], values[3], values[4]); break;
    case 6: value = mind_c(6, values[0], values[1], values[2], values[3], values[4], values[5]); break;
    case 7: value = mind_c(7, values[0], values[1], values[2], values[3], values[4], values[5], values[6]); break;
    case 8: value = mind_c(8, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]); break;
    case 9: value = mind_c(9, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8]); break;
    case 10: value = mind_c(10, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9]); break;
    case 11: value = mind_c(11, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10]); break;
    case 12: value = mind_c(12, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11]); break;
    case 13: value = mind_c(13, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12]); break;
    case 14: value = mind_c(14, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13]); break;
    case 15: value = mind_c(15, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14]); break;
    case 16: value = mind_c(16, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15]); break;
    case 17: value = mind_c(17, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16]); break;
    case 18: value = mind_c(18, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17]); break;
    case 19: value = mind_c(19, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18]); break;
    case 20: value = mind_c(20, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19]); break;
    case 21: value = mind_c(21, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20]); break;
    case 22: value = mind_c(22, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21]); break;
    case 23: value = mind_c(23, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22]); break;
    case 24: value = mind_c(24, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23]); break;
    case 25: value = mind_c(25, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24]); break;
    case 26: value = mind_c(26, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25]); break;
    case 27: value = mind_c(27, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26]); break;
    case 28: value = mind_c(28, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27]); break;
    case 29: value = mind_c(29, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28]); break;
    case 30: value = mind_c(30, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28], values[29]); break;
    default: return tspice_scalar_math_invalid_arg("unsupported variadic count", err, errMaxBytes);
  }
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_mini(const int *values, int count, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out || count < 0 || (count > 0 && !values) || count > 30) return tspice_scalar_math_invalid_arg("mini() invalid buffer or count", err, errMaxBytes);
  *out = 0;
  int value = 0;
  // Call the actual variadic routine with exactly count typed scalars.
  switch (count) {
    case 0: value = mini_c(0); break;
    case 1: value = mini_c(1, values[0]); break;
    case 2: value = mini_c(2, values[0], values[1]); break;
    case 3: value = mini_c(3, values[0], values[1], values[2]); break;
    case 4: value = mini_c(4, values[0], values[1], values[2], values[3]); break;
    case 5: value = mini_c(5, values[0], values[1], values[2], values[3], values[4]); break;
    case 6: value = mini_c(6, values[0], values[1], values[2], values[3], values[4], values[5]); break;
    case 7: value = mini_c(7, values[0], values[1], values[2], values[3], values[4], values[5], values[6]); break;
    case 8: value = mini_c(8, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]); break;
    case 9: value = mini_c(9, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8]); break;
    case 10: value = mini_c(10, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9]); break;
    case 11: value = mini_c(11, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10]); break;
    case 12: value = mini_c(12, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11]); break;
    case 13: value = mini_c(13, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12]); break;
    case 14: value = mini_c(14, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13]); break;
    case 15: value = mini_c(15, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14]); break;
    case 16: value = mini_c(16, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15]); break;
    case 17: value = mini_c(17, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16]); break;
    case 18: value = mini_c(18, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17]); break;
    case 19: value = mini_c(19, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18]); break;
    case 20: value = mini_c(20, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19]); break;
    case 21: value = mini_c(21, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20]); break;
    case 22: value = mini_c(22, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21]); break;
    case 23: value = mini_c(23, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22]); break;
    case 24: value = mini_c(24, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23]); break;
    case 25: value = mini_c(25, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24]); break;
    case 26: value = mini_c(26, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25]); break;
    case 27: value = mini_c(27, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26]); break;
    case 28: value = mini_c(28, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27]); break;
    case 29: value = mini_c(29, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28]); break;
    case 30: value = mini_c(30, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], values[10], values[11], values[12], values[13], values[14], values[15], values[16], values[17], values[18], values[19], values[20], values[21], values[22], values[23], values[24], values[25], values[26], values[27], values[28], values[29]); break;
    default: return tspice_scalar_math_invalid_arg("unsupported variadic count", err, errMaxBytes);
  }
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

static int tspice_state_derivative_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "state derivative requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_ducrss(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_state_derivative_invalid_arg(err, errMaxBytes);
  SpiceDouble value[6] = {0.0};
  ducrss_c(a, b, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, value, sizeof(value));
  return 0;
}

int tspice_dvcrss(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_state_derivative_invalid_arg(err, errMaxBytes);
  SpiceDouble value[6] = {0.0};
  dvcrss_c(a, b, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, value, sizeof(value));
  return 0;
}

int tspice_dvdot(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_state_derivative_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  const SpiceDouble value = dvdot_c(a, b);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_dvhat(const double *state, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!state || !out) return tspice_state_derivative_invalid_arg(err, errMaxBytes);
  SpiceDouble value[6] = {0.0};
  dvhat_c(state, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, value, sizeof(value));
  return 0;
}

int tspice_dvnorm(const double *state, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!state || !out) return tspice_state_derivative_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  const SpiceDouble value = dvnorm_c(state);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_dvsep(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_state_derivative_invalid_arg(err, errMaxBytes);
  *out = 0.0;
  const SpiceDouble value = dvsep_c(a, b);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

static int tspice_polynomial_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "Invalid polynomial buffer or dimension", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_chbder(const double *cp, int ncoeff, const double x2s[2], double x, int nderiv, double *workspace, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!cp || !x2s || !workspace || !out || ncoeff <= 0 || nderiv < 0 || nderiv > 715827881 || (size_t)(nderiv + 1) > SIZE_MAX / (3 * sizeof(double)) || (size_t)ncoeff > SIZE_MAX / sizeof(double)) return tspice_polynomial_invalid_arg(err, errMaxBytes);
  double transform[2] = {x2s[0], x2s[1]};
  chbder_c(cp, (SpiceInt)(ncoeff - 1), transform, x, (SpiceInt)nderiv, workspace, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_chbigr(const double *cp, int ncoeff, const double x2s[2], double x, double *outP, double *outIntegral, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!cp || !x2s || !outP || !outIntegral || ncoeff < 0 || (size_t)ncoeff > SIZE_MAX / sizeof(double)) return tspice_polynomial_invalid_arg(err, errMaxBytes);
  chbigr_c((SpiceInt)(ncoeff - 1), cp, x2s, x, outP, outIntegral);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_chbint(const double *cp, int ncoeff, const double x2s[2], double x, double *outP, double *outDerivative, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!cp || !x2s || !outP || !outDerivative || ncoeff <= 0 || (size_t)ncoeff > SIZE_MAX / sizeof(double)) return tspice_polynomial_invalid_arg(err, errMaxBytes);
  chbint_c(cp, (SpiceInt)(ncoeff - 1), x2s, x, outP, outDerivative);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_chbval(const double *cp, int ncoeff, const double x2s[2], double x, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!cp || !x2s || !out || ncoeff <= 0 || (size_t)ncoeff > SIZE_MAX / sizeof(double)) return tspice_polynomial_invalid_arg(err, errMaxBytes);
  chbval_c(cp, (SpiceInt)(ncoeff - 1), x2s, x, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_polyds(const double *coeffs, int ncoeff, int nderiv, double t, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!coeffs || !out || ncoeff < 0 || nderiv > 2147483646 || (nderiv >= 0 && (size_t)(nderiv + 1) > SIZE_MAX / sizeof(double)) || (size_t)ncoeff > SIZE_MAX / sizeof(double)) return tspice_polynomial_invalid_arg(err, errMaxBytes);
  polyds_c(coeffs, (SpiceInt)(ncoeff - 1), (SpiceInt)nderiv, t, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_rquad(double a, double b, double c, double root1[2], double root2[2], char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!root1 || !root2) return tspice_polynomial_invalid_arg(err, errMaxBytes);
  rquad_c(a, b, c, root1, root2);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

static int tspice_interpolation_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "Invalid interpolation buffer or dimension", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_hrmesp(int n, double first, double step, const double *yvals, double x, double *outF, double *outDerivative, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // CSPICE allocates 32*n bytes through a signed32 byte count.
  if (!yvals || !outF || !outDerivative || n < 0 || n > 67108863 || (size_t)n > SIZE_MAX / (4 * sizeof(double))) return tspice_interpolation_invalid_arg(err, errMaxBytes);
  hrmesp_c((SpiceInt)n, first, step, yvals, x, outF, outDerivative);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_hrmint(int n, const double *xvals, const double *yvals, double x, double *work, double *outF, double *outDerivative, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // Keep unreduced translated index (2*n-1)+4*n within signed32.
  if (!xvals || !yvals || !work || !outF || !outDerivative || n < 0 || n > 357913941 || (size_t)n > SIZE_MAX / (4 * sizeof(double))) return tspice_interpolation_invalid_arg(err, errMaxBytes);
  hrmint_c((SpiceInt)n, xvals, yvals, x, work, outF, outDerivative);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lgresp(int n, double first, double step, const double *yvals, double x, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // CSPICE allocates 8*n bytes through a signed32 byte count.
  if (!yvals || !out || n < 0 || n > 268435455 || (size_t)n > SIZE_MAX / (1 * sizeof(double))) return tspice_interpolation_invalid_arg(err, errMaxBytes);
  *out = lgresp_c((SpiceInt)n, first, step, yvals, x);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lgrind(int n, const double *xvals, const double *yvals, double *work, double x, double *outP, double *outDerivative, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // Keep unreduced translated index i+2*n (i<=n) within signed32.
  if (!xvals || !yvals || !work || !outP || !outDerivative || n < 0 || n > 715827882 || (size_t)n > SIZE_MAX / (2 * sizeof(double))) return tspice_interpolation_invalid_arg(err, errMaxBytes);
  lgrind_c((SpiceInt)n, xvals, yvals, work, x, outP, outDerivative);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lgrint(int n, const double *xvals, const double *yvals, double x, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // CSPICE allocates 8*n bytes through a signed32 byte count.
  if (!xvals || !yvals || !out || n < 0 || n > 268435455 || (size_t)n > SIZE_MAX / (1 * sizeof(double))) return tspice_interpolation_invalid_arg(err, errMaxBytes);
  *out = lgrint_c((SpiceInt)n, xvals, yvals, x);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_qderiv(int n, const double *f0, const double *f2, double delta, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // Avoid overflow of the translated vlcomg inclusive loop counter.
  if (!f0 || !f2 || !out || n < 1 || n > 2147483646 || (size_t)n > SIZE_MAX / (1 * sizeof(double))) return tspice_interpolation_invalid_arg(err, errMaxBytes);
  qderiv_c((SpiceInt)n, f0, f2, delta, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

static int InvalidStorageBuffer(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "Invalid storage count or buffer length", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_clearc(
    int ndim, int arrlen, unsigned char *bytes, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // With positive count, CSPICE diagnoses widths below two before writing.
  if (!bytes || length < 0 || (ndim > 0 && arrlen >= 2 && ndim > length / arrlen)) {
    return InvalidStorageBuffer(err, errMaxBytes);
  }
  clearc_c(ndim, arrlen, bytes);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_cleard(
    int ndim, double *values, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || length < 0 || ndim > length || (size_t)length > SIZE_MAX / sizeof(double)) {
    return InvalidStorageBuffer(err, errMaxBytes);
  }
  cleard_c(ndim, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_cleari(
    int ndim, int *values, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || length < 0 || ndim > length || (size_t)length > SIZE_MAX / sizeof(int)) {
    return InvalidStorageBuffer(err, errMaxBytes);
  }
  cleari_c(ndim, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_filld(
    double value, int ndim, double *values, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || length < 0 || ndim > length || (size_t)length > SIZE_MAX / sizeof(double)) {
    return InvalidStorageBuffer(err, errMaxBytes);
  }
  filld_c(value, ndim, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_filli(
    int value, int ndim, int *values, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || length < 0 || ndim > length || (size_t)length > SIZE_MAX / sizeof(int)) {
    return InvalidStorageBuffer(err, errMaxBytes);
  }
  filli_c(value, ndim, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_moved(
    const double *source, int sourceLength, int ndim, double *destination, int destinationLength, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  // The pinned MOVED macro converts ndim to an unsigned memmove byte count.
  if (!source || !destination || ndim < 0 || ndim > sourceLength || ndim > destinationLength ||
      (size_t)ndim > SIZE_MAX / sizeof(double)) {
    return InvalidStorageBuffer(err, errMaxBytes);
  }
  moved_c(source, ndim, destination);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

static int tspice_fixed_matrix_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "matrix operation requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_eul2m(double angle3, double angle2, double angle1, int axis3, int axis2, int axis1, double *r, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!r) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  /* N0067 eul2m_c transposes a private matrix even when EUL2M fails
     before writing it. Use its exact traced SPICELIB operation; only read
     the initialized column-major matrix after the toolkit reports success. */
  doublereal angles[3] = {angle3, angle2, angle1}, result[9] = {0};
  integer axes[3] = {axis3, axis2, axis1};
  chkin_c("eul2m_c");
  eul2m_(&angles[0], &angles[1], &angles[2], &axes[0], &axes[1], &axes[2], result);
  chkout_c("eul2m_c");
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  for (int row = 0; row < 3; ++row)
    for (int col = 0; col < 3; ++col) r[3*row+col] = result[3*col+row];
  return 0;
}

int tspice_m2eul(const double * m, int axis3, int axis2, int axis1, double *angle3, double *angle2, double *angle1, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!m || !angle3 || !angle2 || !angle1) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble matrix[3][3];
  FillMat33(matrix,m);
  m2eul_c(matrix, axis3, axis2, axis1, angle3, angle2, angle1);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  return 0;
}

int tspice_m2q(const double * m, double *q, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!m || !q) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble matrix[3][3];
  FillMat33(matrix,m);
  m2q_c(matrix, q);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  return 0;
}

int tspice_q2m(const double * q, double *r, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!q || !r) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble result[3][3] = {{0}};
  q2m_c(q, result);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  for (int i = 0; i < 3; ++i) for (int j = 0; j < 3; ++j) r[3*i+j] = result[i][j];
  return 0;
}

int tspice_qxq(const double * q1, const double * q2, double *qout, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!q1 || !q2 || !qout) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  qxq_c(q1, q2, qout);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  return 0;
}

int tspice_qdq2av(const double * q, const double * dq, double *av, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!q || !dq || !av) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  qdq2av_c(q, dq, av);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  return 0;
}

int tspice_raxisa(const double * m, double *axis, double *angle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!m || !axis || !angle) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble matrix[3][3];
  FillMat33(matrix,m);
  raxisa_c(matrix, axis, angle);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err,errMaxBytes); return 1; }
  return 0;
}

static int jacobian_status(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

static int jacobian_invalid(char *err, int errMaxBytes, const char *message) {
  tspice_clear_last_error_buffers();
  return tspice_return_error(err, errMaxBytes, message);
}

// ZZBODKER builds the ID hash from paired name/code mappings. N0067
// ZZHASHI takes signed abs(code), which has no representation for INT_MIN.
static int check_body_mapping_codes(char *err, int errMaxBytes) {
  SpiceBoolean found = SPICEFALSE;
  SpiceInt names = 0, codes = 0;
  SpiceChar type[2] = {0};
  dtpool_c("NAIF_BODY_NAME", &found, &names, type);
  if (failed_c()) return jacobian_status(err, errMaxBytes);
  if (!found || type[0] != 'C' || names > 14983) return 0;
  dtpool_c("NAIF_BODY_CODE", &found, &codes, type);
  if (failed_c()) return jacobian_status(err, errMaxBytes);
  if (!found || type[0] != 'N' || names != codes) return 0;
  int unsafe = 0;
  for (SpiceInt start = 0; start < codes; start += 64) {
    SpiceDouble values[64];
    SpiceInt used = 0;
    gdpool_c("NAIF_BODY_CODE", start, 64, &used, values, &found);
    if (failed_c()) return jacobian_status(err, errMaxBytes);
    for (SpiceInt i = 0; i < used; ++i) {
      // GIPOOL validates and rounds all codes before any hashes are built.
      // Let it report its own conversion error, including in a mixed table.
      if (!(values[i] >= (double)INT_MIN && values[i] <= (double)INT_MAX)) return 0;
      if (values[i] <= (double)INT_MIN + 0.5) unsafe = 1;
    }
  }
  if (!unsafe) return 0;
  // ZZBODKER also diagnoses blank names (in a 36-byte record) before
  // entering ZZBODINI. Preserve that ordinary error and its traceback.
  for (SpiceInt start = 0; start < names; start += 64) {
    SpiceChar rows[64][37];
    SpiceInt used = 0;
    gcpool_c("NAIF_BODY_NAME", start, 64, 37, &used, rows, &found);
    if (failed_c()) return jacobian_status(err, errMaxBytes);
    for (SpiceInt i = 0; i < used; ++i) {
      if (!rows[i][0]) return 0;
    }
  }
  return jacobian_invalid(err, errMaxBytes, "NAIF_BODY_CODE outside the safe N0067 body hash range");
}

// ZZBODS2C caches the caller's integer even when BODS2C did not find a code.
// Both planetographic routines supply an uninitialized local there. Resolve
// into initialized storage first, under the original trace, and preserve the
// routine's original IDCODENOTFOUND diagnostic for an unrecognized name.
static int check_jacobian_body(const char *body, const char *outer, const char *inner,
                               char *err, int errMaxBytes) {
  if (body[0] == '\0') return 0;  // CHKFSTR diagnoses an empty name before lookup.
  size_t length = strlen(body);
  if (length > INT_MAX) return jacobian_invalid(err, errMaxBytes, "Body name exceeds the N0067 string length");
  if (check_body_mapping_codes(err, errMaxBytes)) return 1;
  integer code = 0, saved = 0, counter[2];
  logical found = 0, savedFound = 0;
  char savedName[36] = {0};
  chkin_c(outer);
  chkin_c(inner);
  zzctruin_(counter);
  zzbods2c_(counter, savedName, &saved, &savedFound, (char *)body, &code, &found, 36, (ftnlen)length);
  if (!failed_c() && !found) {
    setmsg_c("The value of the input argument BODY is #, this is not a recognized name of an ephemeris object. The cause of this problem may be that you need an updated version of the SPICE Toolkit. ");
    errch_c("#", body);
    sigerr_c("SPICE(IDCODENOTFOUND)");
  }
  chkout_c(inner);
  chkout_c(outer);
  return jacobian_status(err, errMaxBytes);
}

// RECGEO's unchecked NEARPT error path feeds an unwritten local normal to
// error-free RECLAT. Run the same NEARPT with owned output before dispatch.
// Its only downstream SURFNM error is a non-positive axis, already tested by NEARPT.
static int check_geodetic_surface(double x, double y, double z, double re, double f,
                                  int planetographic, char *err, int errMaxBytes) {
  if (re <= 0 || f >= 1 || (x == 0 && y == 0)) return 0;
  double polar = re - f * re;
  if (!isfinite(polar) || (polar > 0 && !isfinite(1.0 / fmin(re, polar))))
    return jacobian_invalid(err, errMaxBytes, "Reference axes exceed the N0067 nearest-point scaling range");
  double point[3] = {x, y, z}, surface[3] = {0}, altitude = 0;
  const char *outer = planetographic ? "dpgrdr_c" : "dgeodr_c";
  chkin_c(outer);
  if (planetographic) chkin_c("DPGRDR");
  chkin_c("DGEODR");
  chkin_c("RECGEO");
  nearpt_(point, &re, &re, &polar, surface, &altitude);
  chkout_c("RECGEO");
  chkout_c("DGEODR");
  if (planetographic) chkout_c("DPGRDR");
  chkout_c(outer);
  return jacobian_status(err, errMaxBytes);
}

int tspice_dazldr(double x, double y, double z, int azccw, int elplsz, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  dazldr_c(x, y, z, azccw, elplsz, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_dcyldr(double x, double y, double z, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  dcyldr_c(x, y, z, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_dgeodr(double x, double y, double z, double re, double f, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  if (check_geodetic_surface(x, y, z, re, f, 0, err, errMaxBytes)) return 1;
  dgeodr_c(x, y, z, re, f, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_dlatdr(double x, double y, double z, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  dlatdr_c(x, y, z, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_dpgrdr(const char *body, double x, double y, double z, double re, double f, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out || !body) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  if (check_jacobian_body(body, "dpgrdr_c", "DPGRDR", err, errMaxBytes)) return 1;
  if (*body && re > 0 && f < 1 && (x != 0 || y != 0)) {
    // Resolve this same body's longitude policy first so its error takes
    // precedence over errors from the subsequent geometric calculation.
    SpiceDouble checked[3][3] = {{0}};
    dpgrdr_c(body, 1.0, 0.0, 0.0, 1.0, 0.0, checked);
    if (jacobian_status(err, errMaxBytes)) return 1;
    if (check_geodetic_surface(x, y, z, re, f, 1, err, errMaxBytes)) return 1;
  }
  dpgrdr_c(body, x, y, z, re, f, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_drdazl(double range, double az, double el, int azccw, int elplsz, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  drdazl_c(range, az, el, azccw, elplsz, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_drdcyl(double radius, double lon, double z, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  drdcyl_c(radius, lon, z, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_drdgeo(double lon, double lat, double alt, double re, double f, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  drdgeo_c(lon, lat, alt, re, f, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_drdlat(double radius, double lon, double lat, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  drdlat_c(radius, lon, lat, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_drdpgr(const char *body, double lon, double lat, double alt, double re, double f, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out || !body) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  if (check_jacobian_body(body, "drdpgr_c", "DRDPGR", err, errMaxBytes)) return 1;
  drdpgr_c(body, lon, lat, alt, re, f, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_drdsph(double radius, double colat, double lon, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  drdsph_c(radius, colat, lon, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_dsphdr(double x, double y, double z, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (jacobian_status(err, errMaxBytes)) return 1;
  if (!out) return jacobian_invalid(err, errMaxBytes, "Missing Jacobian storage");
  SpiceDouble matrix[3][3] = {{0}};
  dsphdr_c(x, y, z, matrix);
  if (jacobian_status(err, errMaxBytes)) return 1;
  memcpy(out, matrix, sizeof(matrix));
  return 0;
}

int tspice_det(const double *m, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  const SpiceDouble value = det_c(mLocal);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = (double)value;
  return 0;
}

int tspice_diags2(const double *symmat, double *diag, double *rotate, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!symmat || !diag || !rotate) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble symmatLocal[2][2] = {{symmat[0], symmat[1]}, {symmat[2], symmat[3]}};
  SpiceDouble diagLocal[2][2] = {{0.0}};
  SpiceDouble rotateLocal[2][2] = {{0.0}};
  diags2_c(symmatLocal, diagLocal, rotateLocal);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 2; i++) {
    for (int j = 0; j < 2; j++) {
      diag[i * 2 + j] = diagLocal[i][j];
      rotate[i * 2 + j] = rotateLocal[i][j];
    }
  }
  return 0;
}

int tspice_ident(double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble value[3][3] = {{0.0}};
  ident_c(value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

int tspice_invert(const double *m, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  SpiceDouble value[3][3] = {{0.0}};
  invert_c(mLocal, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

int tspice_invort(const double *m, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  SpiceDouble value[3][3] = {{0.0}};
  invort_c(mLocal, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

int tspice_isrot(const double *m, double ntol, double dtol, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  const SpiceBoolean value = isrot_c(mLocal, ntol, dtol);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value ? 1 : 0;
  return 0;
}

int tspice_mequ(const double *m, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  SpiceDouble value[3][3] = {{0.0}};
  mequ_c(mLocal, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

int tspice_mtxm(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble aLocal[3][3];
  FillMat33(aLocal, a);
  SpiceDouble bLocal[3][3];
  FillMat33(bLocal, b);
  SpiceDouble value[3][3] = {{0.0}};
  mtxm_c(aLocal, bLocal, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

int tspice_mxmt(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble aLocal[3][3];
  FillMat33(aLocal, a);
  SpiceDouble bLocal[3][3];
  FillMat33(bLocal, b);
  SpiceDouble value[3][3] = {{0.0}};
  mxmt_c(aLocal, bLocal, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

int tspice_trace(const double *m, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  const SpiceDouble value = trace_c(mLocal);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = (double)value;
  return 0;
}

int tspice_xpose(const double *m, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!m || !out) return tspice_fixed_matrix_invalid_arg(err, errMaxBytes);
  SpiceDouble mLocal[3][3];
  FillMat33(mLocal, m);
  SpiceDouble value[3][3] = {{0.0}};
  xpose_c(mLocal, value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) out[i * 3 + j] = value[i][j];
  }
  return 0;
}

static int tspice_general_vector_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "general vector operation requires valid dimension and non-NULL buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

int tspice_mequg(
    const double *m1,
    int nr,
    int nc,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  if (!m1 || !out ||
      !tspice_matrix_count(nr, nc, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  mequg_c(m1, nr, nc, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_mtxmg(
    const double *m1,
    const double *m2,
    int nc1,
    int nr1r2,
    int nc2,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  const int k = nr1r2 < 0 ? 0 : nr1r2;
  if (!m1 || !m2 || !out ||
      nc1 > TSPICE_MATRIX_MAX_ELEMENTS ||
      !tspice_matrix_count(k, nc1, &count) ||
      !tspice_matrix_count(k, nc2, &count) ||
      !tspice_matrix_count(nc1, nc2, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  mtxmg_c(m1, m2, nc1, nr1r2, nc2, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_mtxvg(
    const double *m1,
    const double *v2,
    int nc1,
    int nr1r2,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  if (!m1 || !v2 || !out ||
      !tspice_matrix_count(nr1r2, nc1, &count) ||
      !tspice_matrix_count(nr1r2, 1, &count) ||
      !tspice_matrix_count(nc1, 1, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  mtxvg_c(m1, v2, nc1, nr1r2, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_mxmg(
    const double *m1,
    const double *m2,
    int nr1,
    int nc1r2,
    int nc2,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  const int k = nc1r2 < 0 ? 0 : nc1r2;
  if (!m1 || !m2 || !out ||
      nr1 > TSPICE_MATRIX_MAX_ELEMENTS ||
      !tspice_matrix_count(nr1, k, &count) ||
      !tspice_matrix_count(k, nc2, &count) ||
      !tspice_matrix_count(nr1, nc2, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  mxmg_c(m1, m2, nr1, nc1r2, nc2, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_mxmtg(
    const double *m1,
    const double *m2,
    int nr1,
    int nc1c2,
    int nr2,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  if (!m1 || !m2 || !out ||
      nr1 > TSPICE_MATRIX_MAX_ELEMENTS ||
      !tspice_matrix_count(nr1, nc1c2, &count) ||
      !tspice_matrix_count(nr2, nc1c2, &count) ||
      !tspice_matrix_count(nr1, nr2, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  mxmtg_c(m1, m2, nr1, nc1c2, nr2, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_mxvg(
    const double *m1,
    const double *v2,
    int nr1,
    int nc1r2,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  if (!m1 || !v2 || !out ||
      !tspice_matrix_count(nr1, nc1r2, &count) ||
      !tspice_matrix_count(nc1r2, 1, &count) ||
      !tspice_matrix_count(nr1, 1, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  mxvg_c(m1, v2, nr1, nc1r2, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_vtmvg(
    const double *v1,
    const double *matrix,
    const double *v2,
    int nrow,
    int ncol,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  if (!v1 || !matrix || !v2 || !out ||
      !tspice_matrix_count(nrow, 1, &count) ||
      !tspice_matrix_count(nrow, ncol, &count) ||
      !tspice_matrix_count(ncol, 1, &count) ||
      !tspice_matrix_count(1, 1, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  *out = vtmvg_c(v1, matrix, v2, nrow, ncol);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_xposeg(
    const double *matrix,
    int nrow,
    int ncol,
    double *out,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  int count;
  const int r = nrow <= 0 || ncol <= 0 ? 0 : nrow;
  const int c = r == 0 ? 0 : ncol;
  if (!matrix || !out ||
      !tspice_matrix_count(r, c, &count)) return tspice_return_error(err, errMaxBytes, "Invalid matrix dimensions or storage");
  xposeg_c(matrix, nrow, ncol, out);
  if (failed_c()) { tspice_get_spice_error_message_and_reset(err, errMaxBytes); return 1; }
  return 0;
}

int tspice_vaddg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vaddg_c(a, b, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vdistg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceDouble value = vdistg_c(a, b, (SpiceInt)ndim);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_vdotg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceDouble value = vdotg_c(a, b, (SpiceInt)ndim);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_vequg(const double *v, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vequg_c(v, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vhatg(const double *v, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vhatg_c(v, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vlcomg(double a, const double *v1, double b, const double *v2, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v1 || !v2 || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vlcomg_c((SpiceInt)ndim, a, v1, b, v2, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vminug(const double *v, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vminug_c(v, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vnormg(const double *v, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceDouble value = vnormg_c(v, (SpiceInt)ndim);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_vprojg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || ndim > 2147483646 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  // Keep f2c one-based loop counters below their signed32 overflow limit.
  vprojg_c(a, b, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vrelg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceDouble value = vrelg_c(a, b, (SpiceInt)ndim);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_vsclg(double s, const double *v, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vsclg_c(s, v, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vsepg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceDouble value = vsepg_c(a, b, (SpiceInt)ndim);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value;
  return 0;
}

int tspice_vsubg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!a || !b || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  vsubg_c(a, b, (SpiceInt)ndim, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_vzerog(const double *v, int ndim, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !out || ndim < 0 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  *out = 0;
  const SpiceBoolean value = vzerog_c(v, (SpiceInt)ndim);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = value ? 1 : 0;
  return 0;
}

int tspice_unormg(const double *v, int ndim, double *outUnit, double *outNorm, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!v || !outUnit || !outNorm || ndim < 0 || ndim > 2147483646 || (size_t)ndim > SIZE_MAX / sizeof(double)) return tspice_general_vector_invalid_arg(err, errMaxBytes);
  // Keep f2c one-based loop counters below their signed32 overflow limit.
  *outNorm = 0.0;
  unormg_c(v, (SpiceInt)ndim, outUnit, outNorm);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

static int SearchInputError(const char *message, char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, message, (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

static int InvalidSortedBound(char *err, int errMaxBytes) {
  return SearchInputError("Invalid sorted search buffer or count", err, errMaxBytes);
}

// BSCHOC indexes character rows directly; BSCHOI translates these indices to
// one-based integers and also allocates an n*sizeof(SpiceInt) private copy.
static int CheckSearchOrder(const int *order, int n, char *err, int errMaxBytes) {
  if (!order || n < 0 || n > INT32_MAX / (int)sizeof(SpiceInt))
    return InvalidSortedBound(err, errMaxBytes);
  if (n == 0) return 0;
  unsigned char *seen = (unsigned char *)calloc((size_t)n, sizeof(*seen));
  if (!seen)
    return SearchInputError("Could not allocate search order validation buffer", err, errMaxBytes);
  for (int i = 0; i < n; ++i) {
    const int index = order[i];
    if (index < 0 || index >= n || seen[index]) {
      free(seen);
      return SearchInputError("Expected a permutation of zero-based search indices", err, errMaxBytes);
    }
    seen[index] = 1;
  }
  free(seen);
  return 0;
}

int tspice_bschoc(
    const char *key, int n, int width, const char *rows, const int *order, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!key || !rows || !out || width < 2 || n < 0 || n > INT32_MAX / width)
    return InvalidSortedBound(err, errMaxBytes);
  if (CheckSearchOrder(order, n, err, errMaxBytes)) return 1;
  const int index = bschoc_c(key, n, width, rows, order);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_bschoi(
    int key, int n, const int *values, const int *order, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || n > INT32_MAX / (int)sizeof(SpiceInt) || (size_t)n > SIZE_MAX / sizeof(int))
    return InvalidSortedBound(err, errMaxBytes);
  if (CheckSearchOrder(order, n, err, errMaxBytes)) return 1;
  const int index = bschoi_c(key, n, values, order);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_bsrchc(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!key || !rows || !out || width < 2 || n < 0 || n > INT32_MAX / width)
    return InvalidSortedBound(err, errMaxBytes);
  const int index = bsrchc_c(key, n, width, rows);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_bsrchd(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || n > INT32_MAX / 2 || (size_t)n > SIZE_MAX / sizeof(double))
    return InvalidSortedBound(err, errMaxBytes);
  const int index = bsrchd_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_bsrchi(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || n > INT32_MAX / 2 || (size_t)n > SIZE_MAX / sizeof(int))
    return InvalidSortedBound(err, errMaxBytes);
  const int index = bsrchi_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_isrchc(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!key || !rows || !out || width < 2 || n < 0 || n > INT32_MAX / width)
    return InvalidSortedBound(err, errMaxBytes);
  const int index = isrchc_c(key, n, width, rows);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_isrchd(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || n > INT32_MAX - 1 || (size_t)n > SIZE_MAX / sizeof(double))
    return InvalidSortedBound(err, errMaxBytes);
  const int index = isrchd_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_isrchi(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || n > INT32_MAX - 1 || (size_t)n > SIZE_MAX / sizeof(int))
    return InvalidSortedBound(err, errMaxBytes);
  const int index = isrchi_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *out = index;
  return 0;
}

int tspice_lstlec(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!key || !rows || !out || n < 0 || width < 2 || n > INT32_MAX / width) {
    return InvalidSortedBound(err, errMaxBytes);
  }
  *out = lstlec_c(key, n, width, rows);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lstled(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || (size_t)n > SIZE_MAX / sizeof(double)) {
    return InvalidSortedBound(err, errMaxBytes);
  }
  *out = lstled_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lstlei(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || (size_t)n > SIZE_MAX / sizeof(int)) {
    return InvalidSortedBound(err, errMaxBytes);
  }
  *out = lstlei_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lstltc(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!key || !rows || !out || n < 0 || width < 2 || n > INT32_MAX / width) {
    return InvalidSortedBound(err, errMaxBytes);
  }
  *out = lstltc_c(key, n, width, rows);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lstltd(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || (size_t)n > SIZE_MAX / sizeof(double)) {
    return InvalidSortedBound(err, errMaxBytes);
  }
  *out = lstltd_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_lstlti(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!values || !out || n < 0 || (size_t)n > SIZE_MAX / sizeof(int)) {
    return InvalidSortedBound(err, errMaxBytes);
  }
  *out = lstlti_c(key, n, values);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_reclat(
    const double *rect3,
    double *outRadius,
    double *outLon,
    double *outLat,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRadius) {
    *outRadius = 0.0;
  }
  if (outLon) {
    *outLon = 0.0;
  }
  if (outLat) {
    *outLat = 0.0;
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  if (rect3) {
    rect[0] = (SpiceDouble)rect3[0];
    rect[1] = (SpiceDouble)rect3[1];
    rect[2] = (SpiceDouble)rect3[2];
  }

  SpiceDouble radius = 0.0;
  SpiceDouble lon = 0.0;
  SpiceDouble lat = 0.0;
  reclat_c(rect, &radius, &lon, &lat);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outRadius) {
    *outRadius = (double)radius;
  }
  if (outLon) {
    *outLon = (double)lon;
  }
  if (outLat) {
    *outLat = (double)lat;
  }

  return 0;
}

int tspice_latrec(
    double radius,
    double lon,
    double lat,
    double *outRect3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  latrec_c((SpiceDouble)radius, (SpiceDouble)lon, (SpiceDouble)lat, rect);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outRect3) {
    outRect3[0] = (double)rect[0];
    outRect3[1] = (double)rect[1];
    outRect3[2] = (double)rect[2];
  }

  return 0;
}

int tspice_recsph(
    const double *rect3,
    double *outRadius,
    double *outColat,
    double *outLon,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRadius) {
    *outRadius = 0.0;
  }
  if (outColat) {
    *outColat = 0.0;
  }
  if (outLon) {
    *outLon = 0.0;
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  if (rect3) {
    rect[0] = (SpiceDouble)rect3[0];
    rect[1] = (SpiceDouble)rect3[1];
    rect[2] = (SpiceDouble)rect3[2];
  }

  SpiceDouble radius = 0.0;
  SpiceDouble colat = 0.0;
  SpiceDouble lon = 0.0;
  recsph_c(rect, &radius, &colat, &lon);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outRadius) {
    *outRadius = (double)radius;
  }
  if (outColat) {
    *outColat = (double)colat;
  }
  if (outLon) {
    *outLon = (double)lon;
  }

  return 0;
}

int tspice_sphrec(
    double radius,
    double colat,
    double lon,
    double *outRect3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  sphrec_c((SpiceDouble)radius, (SpiceDouble)colat, (SpiceDouble)lon, rect);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outRect3) {
    outRect3[0] = (double)rect[0];
    outRect3[1] = (double)rect[1];
    outRect3[2] = (double)rect[2];
  }

  return 0;
}

int tspice_vnorm(const double *v3, double *outNorm, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNorm) {
    *outNorm = 0.0;
  }

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  const SpiceDouble norm = vnorm_c(v);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outNorm) {
    *outNorm = (double)norm;
  }

  return 0;
}

int tspice_vhat(const double *v3, double *outVhat3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outVhat3) {
    outVhat3[0] = 0.0;
    outVhat3[1] = 0.0;
    outVhat3[2] = 0.0;
  }

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  // NAIF defines vhat_c(0) = 0 (no error). We special-case here so we can
  // immediately return the zero vector without calling into CSPICE.
  if (v[0] == 0.0 && v[1] == 0.0 && v[2] == 0.0) {
    return 0;
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vhat_c(v, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outVhat3) {
    outVhat3[0] = (double)out[0];
    outVhat3[1] = (double)out[1];
    outVhat3[2] = (double)out[2];
  }

  return 0;
}

int tspice_vdot(const double *a3, const double *b3, double *outDot, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDot) {
    *outDot = 0.0;
  }

  SpiceDouble a[3] = {0.0, 0.0, 0.0};
  SpiceDouble b[3] = {0.0, 0.0, 0.0};
  if (a3) {
    a[0] = (SpiceDouble)a3[0];
    a[1] = (SpiceDouble)a3[1];
    a[2] = (SpiceDouble)a3[2];
  }
  if (b3) {
    b[0] = (SpiceDouble)b3[0];
    b[1] = (SpiceDouble)b3[1];
    b[2] = (SpiceDouble)b3[2];
  }

  const SpiceDouble dot = vdot_c(a, b);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDot) {
    *outDot = (double)dot;
  }

  return 0;
}

int tspice_vcrss(
    const double *a3,
    const double *b3,
    double *outCross3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble a[3] = {0.0, 0.0, 0.0};
  SpiceDouble b[3] = {0.0, 0.0, 0.0};
  if (a3) {
    a[0] = (SpiceDouble)a3[0];
    a[1] = (SpiceDouble)a3[1];
    a[2] = (SpiceDouble)a3[2];
  }
  if (b3) {
    b[0] = (SpiceDouble)b3[0];
    b[1] = (SpiceDouble)b3[1];
    b[2] = (SpiceDouble)b3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vcrss_c(a, b, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCross3) {
    outCross3[0] = (double)out[0];
    outCross3[1] = (double)out[1];
    outCross3[2] = (double)out[2];
  }

  return 0;
}

int tspice_mxv(const double *m3x3, const double *v3, double *outV3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  FillMat33(m, m3x3);

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  mxv_c(m, v, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outV3) {
    outV3[0] = (double)out[0];
    outV3[1] = (double)out[1];
    outV3[2] = (double)out[2];
  }

  return 0;
}

int tspice_mtxv(const double *m3x3, const double *v3, double *outV3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  FillMat33(m, m3x3);

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  mtxv_c(m, v, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outV3) {
    outV3[0] = (double)out[0];
    outV3[1] = (double)out[1];
    outV3[2] = (double)out[2];
  }

  return 0;
}


int tspice_mxm(
    const double *a3x3,
    const double *b3x3,
    double *outM3x3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outM3x3) {
    for (int i = 0; i < 9; i++) {
      outM3x3[i] = 0.0;
    }
  }

  SpiceDouble a[3][3];
  FillMat33(a, a3x3);
  SpiceDouble b[3][3];
  FillMat33(b, b3x3);

  SpiceDouble out[3][3];
  mxm_c(a, b, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outM3x3) {
    outM3x3[0] = (double)out[0][0];
    outM3x3[1] = (double)out[0][1];
    outM3x3[2] = (double)out[0][2];

    outM3x3[3] = (double)out[1][0];
    outM3x3[4] = (double)out[1][1];
    outM3x3[5] = (double)out[1][2];

    outM3x3[6] = (double)out[2][0];
    outM3x3[7] = (double)out[2][1];
    outM3x3[8] = (double)out[2][2];
  }

  return 0;
}

int tspice_vadd(
    const double *a3,
    const double *b3,
    double *out3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out3) {
    out3[0] = 0.0;
    out3[1] = 0.0;
    out3[2] = 0.0;
  }

  SpiceDouble a[3] = {0.0, 0.0, 0.0};
  SpiceDouble b[3] = {0.0, 0.0, 0.0};
  if (a3) {
    a[0] = (SpiceDouble)a3[0];
    a[1] = (SpiceDouble)a3[1];
    a[2] = (SpiceDouble)a3[2];
  }
  if (b3) {
    b[0] = (SpiceDouble)b3[0];
    b[1] = (SpiceDouble)b3[1];
    b[2] = (SpiceDouble)b3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vadd_c(a, b, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (out3) {
    out3[0] = (double)out[0];
    out3[1] = (double)out[1];
    out3[2] = (double)out[2];
  }

  return 0;
}

int tspice_vsub(
    const double *a3,
    const double *b3,
    double *out3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out3) {
    out3[0] = 0.0;
    out3[1] = 0.0;
    out3[2] = 0.0;
  }

  SpiceDouble a[3] = {0.0, 0.0, 0.0};
  SpiceDouble b[3] = {0.0, 0.0, 0.0};
  if (a3) {
    a[0] = (SpiceDouble)a3[0];
    a[1] = (SpiceDouble)a3[1];
    a[2] = (SpiceDouble)a3[2];
  }
  if (b3) {
    b[0] = (SpiceDouble)b3[0];
    b[1] = (SpiceDouble)b3[1];
    b[2] = (SpiceDouble)b3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vsub_c(a, b, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (out3) {
    out3[0] = (double)out[0];
    out3[1] = (double)out[1];
    out3[2] = (double)out[2];
  }

  return 0;
}

int tspice_vminus(const double *v3, double *out3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out3) {
    out3[0] = 0.0;
    out3[1] = 0.0;
    out3[2] = 0.0;
  }

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vminus_c(v, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (out3) {
    out3[0] = (double)out[0];
    out3[1] = (double)out[1];
    out3[2] = (double)out[2];
  }

  return 0;
}

int tspice_vscl(
    double s,
    const double *v3,
    double *out3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out3) {
    out3[0] = 0.0;
    out3[1] = 0.0;
    out3[2] = 0.0;
  }

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vscl_c((SpiceDouble)s, v, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (out3) {
    out3[0] = (double)out[0];
    out3[1] = (double)out[1];
    out3[2] = (double)out[2];
  }

  return 0;
}

int tspice_rotate(double angle, int axis, double *outM3x3, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outM3x3) {
    for (int i = 0; i < 9; i++) {
      outM3x3[i] = 0.0;
    }
  }

  SpiceDouble out[3][3];
  rotate_c((SpiceDouble)angle, (SpiceInt)axis, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outM3x3) {
    outM3x3[0] = (double)out[0][0];
    outM3x3[1] = (double)out[0][1];
    outM3x3[2] = (double)out[0][2];

    outM3x3[3] = (double)out[1][0];
    outM3x3[4] = (double)out[1][1];
    outM3x3[5] = (double)out[1][2];

    outM3x3[6] = (double)out[2][0];
    outM3x3[7] = (double)out[2][1];
    outM3x3[8] = (double)out[2][2];
  }

  return 0;
}

int tspice_rotmat(
    const double *m3x3,
    double angle,
    int axis,
    double *outM3x3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outM3x3) {
    for (int i = 0; i < 9; i++) {
      outM3x3[i] = 0.0;
    }
  }

  SpiceDouble m[3][3];
  FillMat33(m, m3x3);

  SpiceDouble out[3][3];
  rotmat_c(m, (SpiceDouble)angle, (SpiceInt)axis, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outM3x3) {
    outM3x3[0] = (double)out[0][0];
    outM3x3[1] = (double)out[0][1];
    outM3x3[2] = (double)out[0][2];

    outM3x3[3] = (double)out[1][0];
    outM3x3[4] = (double)out[1][1];
    outM3x3[5] = (double)out[1][2];

    outM3x3[6] = (double)out[2][0];
    outM3x3[7] = (double)out[2][1];
    outM3x3[8] = (double)out[2][2];
  }

  return 0;
}

int tspice_axisar(
    const double *axis3,
    double angle,
    double *outM3x3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outM3x3) {
    for (int i = 0; i < 9; i++) {
      outM3x3[i] = 0.0;
    }
  }

  SpiceDouble axis[3] = {0.0, 0.0, 0.0};
  if (axis3) {
    axis[0] = (SpiceDouble)axis3[0];
    axis[1] = (SpiceDouble)axis3[1];
    axis[2] = (SpiceDouble)axis3[2];
  }

  SpiceDouble out[3][3];
  axisar_c(axis, (SpiceDouble)angle, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outM3x3) {
    outM3x3[0] = (double)out[0][0];
    outM3x3[1] = (double)out[0][1];
    outM3x3[2] = (double)out[0][2];

    outM3x3[3] = (double)out[1][0];
    outM3x3[4] = (double)out[1][1];
    outM3x3[5] = (double)out[1][2];

    outM3x3[6] = (double)out[2][0];
    outM3x3[7] = (double)out[2][1];
    outM3x3[8] = (double)out[2][2];
  }

  return 0;
}

int tspice_georec(
    double lon,
    double lat,
    double alt,
    double re,
    double f,
    double *outRect3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRect3) {
    outRect3[0] = 0.0;
    outRect3[1] = 0.0;
    outRect3[2] = 0.0;
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  georec_c((SpiceDouble)lon, (SpiceDouble)lat, (SpiceDouble)alt, (SpiceDouble)re, (SpiceDouble)f, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outRect3) {
    outRect3[0] = (double)out[0];
    outRect3[1] = (double)out[1];
    outRect3[2] = (double)out[2];
  }

  return 0;
}

int tspice_recgeo(
    const double *rect3,
    double re,
    double f,
    double *outLon,
    double *outLat,
    double *outAlt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outLon) {
    *outLon = 0.0;
  }
  if (outLat) {
    *outLat = 0.0;
  }
  if (outAlt) {
    *outAlt = 0.0;
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  if (rect3) {
    rect[0] = (SpiceDouble)rect3[0];
    rect[1] = (SpiceDouble)rect3[1];
    rect[2] = (SpiceDouble)rect3[2];
  }

  SpiceDouble lon = 0.0;
  SpiceDouble lat = 0.0;
  SpiceDouble alt = 0.0;
  recgeo_c(rect, (SpiceDouble)re, (SpiceDouble)f, &lon, &lat, &alt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outLon) {
    *outLon = (double)lon;
  }
  if (outLat) {
    *outLat = (double)lat;
  }
  if (outAlt) {
    *outAlt = (double)alt;
  }

  return 0;
}
