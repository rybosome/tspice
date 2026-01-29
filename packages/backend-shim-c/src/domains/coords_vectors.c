#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

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
