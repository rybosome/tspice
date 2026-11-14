#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "SpiceZfc.h"
#include "tspice_error.h"
#include <limits.h>
#include <math.h>
#include <string.h>

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

static int tspice_fixed_matrix_invalid_arg(char *err, int errMaxBytes) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) {
    strncpy(err, "matrix operation requires non-NULL input/output buffers", (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
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
