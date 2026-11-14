#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "tspice_error.h"
#include <math.h>
#include <string.h>


// A three-double row is the largest per-element buffer in this family.
#define SURFACE_MAX_ROWS (268435456 / (3 * (int)sizeof(double)))
static int surface_words_finite(const double *words, size_t n) {
  if (!words) return 0;
  for (size_t i = 0; i < n; ++i) {
    if (!isfinite(words[i])) return 0;
  }
  return 1;
}

static int surface_status(char *err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, cap);
  return 1;
}

int tspice_latsrf(const char *method, const char *target, double et, const char *fixref, int npts, const double *input, double *out, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!method || !target || !fixref || !out || !isfinite(et) ||
      npts < 0 || npts > SURFACE_MAX_ROWS || !surface_words_finite(input, (size_t)npts * 2))
    return tspice_return_error(err, cap, "Invalid surface grid inputs");
  latsrf_c(method, target, et, fixref, npts, (const double (*)[2])input, (double (*)[3])out);
  return surface_status(err, cap);
}

int tspice_srfnrm(const char *method, const char *target, double et, const char *fixref, int npts, const double *input, double *out, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!method || !target || !fixref || !out || !isfinite(et) ||
      npts < 0 || npts > SURFACE_MAX_ROWS || !surface_words_finite(input, (size_t)npts * 3))
    return tspice_return_error(err, cap, "Invalid surface grid inputs");
  srfnrm_c(method, target, et, fixref, npts, (const double (*)[3])input, (double (*)[3])out);
  return surface_status(err, cap);
}

int tspice_limbpt(const char *method, const char *target, double et, const char *fixref, const char *abcorr, const char *corloc, const char *observer, const double *refvec, double rolstp, int ncuts, double schstp, double soltol, int maxn, int *npts, double *points, double *epochs, double *vectors, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!method || !target || !fixref || !abcorr || !corloc || !observer ||
      !isfinite(et) || !isfinite(rolstp) || !isfinite(schstp) || !isfinite(soltol) ||
      !surface_words_finite(refvec, 3) || maxn > SURFACE_MAX_ROWS ||
      !npts || !points || !epochs || !vectors)
    return tspice_return_error(err, cap, "Invalid surface cut inputs");
  limbpt_c(method, target, et, fixref, abcorr, corloc, observer, refvec, rolstp,
      ncuts, schstp, soltol, maxn, npts, (double (*)[3])points, epochs, (double (*)[3])vectors);
  return surface_status(err, cap);
}

int tspice_termpt(const char *method, const char *ilusrc, const char *target, double et, const char *fixref, const char *abcorr, const char *corloc, const char *observer, const double *refvec, double rolstp, int ncuts, double schstp, double soltol, int maxn, int *npts, double *points, double *epochs, double *vectors, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!method || !ilusrc || !target || !fixref || !abcorr || !corloc || !observer ||
      !isfinite(et) || !isfinite(rolstp) || !isfinite(schstp) || !isfinite(soltol) ||
      !surface_words_finite(refvec, 3) || maxn > SURFACE_MAX_ROWS ||
      !npts || !points || !epochs || !vectors)
    return tspice_return_error(err, cap, "Invalid surface cut inputs");
  termpt_c(method, ilusrc, target, et, fixref, abcorr, corloc, observer, refvec, rolstp,
      ncuts, schstp, soltol, maxn, npts, (double (*)[3])points, epochs, (double (*)[3])vectors);
  return surface_status(err, cap);
}

int tspice_subpnt(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }

  SpiceDouble spoint[3];
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  subpnt_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, spoint, &trgepc, srfvec);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint3) {
    outSpoint3[0] = (double)spoint[0];
    outSpoint3[1] = (double)spoint[1];
    outSpoint3[2] = (double)spoint[2];
  }
  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }

  return 0;
}

int tspice_subslr(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }

  SpiceDouble spoint[3];
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  subslr_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, spoint, &trgepc, srfvec);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint3) {
    outSpoint3[0] = (double)spoint[0];
    outSpoint3[1] = (double)spoint[1];
    outSpoint3[2] = (double)spoint[2];
  }
  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }

  return 0;
}

int tspice_sincpt(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    const char *dref,
    const double *dvec3,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceDouble dvec[3];
  dvec[0] = dvec3 ? (SpiceDouble)dvec3[0] : 0.0;
  dvec[1] = dvec3 ? (SpiceDouble)dvec3[1] : 0.0;
  dvec[2] = dvec3 ? (SpiceDouble)dvec3[2] : 0.0;

  SpiceDouble spoint[3];
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  SpiceBoolean found = SPICEFALSE;

  sincpt_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, dref, dvec, spoint, &trgepc, srfvec, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outSpoint3) {
      outSpoint3[0] = (double)spoint[0];
      outSpoint3[1] = (double)spoint[1];
      outSpoint3[2] = (double)spoint[2];
    }
    if (outTrgepc) {
      *outTrgepc = (double)trgepc;
    }
    if (outSrfvec3) {
      outSrfvec3[0] = (double)srfvec[0];
      outSrfvec3[1] = (double)srfvec[1];
      outSrfvec3[2] = (double)srfvec[2];
    }
  }

  return 0;
}

int tspice_ilumin(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }
  if (outPhase) {
    *outPhase = 0.0;
  }
  if (outIncdnc) {
    *outIncdnc = 0.0;
  }
  if (outEmissn) {
    *outEmissn = 0.0;
  }

  SpiceDouble spoint[3];
  spoint[0] = spoint3 ? (SpiceDouble)spoint3[0] : 0.0;
  spoint[1] = spoint3 ? (SpiceDouble)spoint3[1] : 0.0;
  spoint[2] = spoint3 ? (SpiceDouble)spoint3[2] : 0.0;

  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  SpiceDouble phase = 0.0;
  SpiceDouble incdnc = 0.0;
  SpiceDouble emissn = 0.0;

  ilumin_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, spoint, &trgepc, srfvec, &phase, &incdnc, &emissn);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }
  if (outPhase) {
    *outPhase = (double)phase;
  }
  if (outIncdnc) {
    *outIncdnc = (double)incdnc;
  }
  if (outEmissn) {
    *outEmissn = (double)emissn;
  }

  return 0;
}

int tspice_illumg(
    const char *method,
    const char *target,
    const char *ilusrc,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *obsrvr,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }
  if (outPhase) {
    *outPhase = 0.0;
  }
  if (outIncdnc) {
    *outIncdnc = 0.0;
  }
  if (outEmissn) {
    *outEmissn = 0.0;
  }

  SpiceDouble spoint[3];
  spoint[0] = spoint3 ? (SpiceDouble)spoint3[0] : 0.0;
  spoint[1] = spoint3 ? (SpiceDouble)spoint3[1] : 0.0;
  spoint[2] = spoint3 ? (SpiceDouble)spoint3[2] : 0.0;

  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  SpiceDouble phase = 0.0;
  SpiceDouble incdnc = 0.0;
  SpiceDouble emissn = 0.0;

  illumg_c(
      method,
      target,
      ilusrc,
      (SpiceDouble)et,
      fixref,
      abcorr,
      obsrvr,
      spoint,
      &trgepc,
      srfvec,
      &phase,
      &incdnc,
      &emissn);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }
  if (outPhase) {
    *outPhase = (double)phase;
  }
  if (outIncdnc) {
    *outIncdnc = (double)incdnc;
  }
  if (outEmissn) {
    *outEmissn = (double)emissn;
  }

  return 0;
}

int tspice_illumf(
    const char *method,
    const char *target,
    const char *ilusrc,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *obsrvr,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    int *outVisibl,
    int *outLit,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }
  if (outPhase) {
    *outPhase = 0.0;
  }
  if (outIncdnc) {
    *outIncdnc = 0.0;
  }
  if (outEmissn) {
    *outEmissn = 0.0;
  }
  if (outVisibl) {
    *outVisibl = 0;
  }
  if (outLit) {
    *outLit = 0;
  }

  SpiceDouble spoint[3];
  spoint[0] = spoint3 ? (SpiceDouble)spoint3[0] : 0.0;
  spoint[1] = spoint3 ? (SpiceDouble)spoint3[1] : 0.0;
  spoint[2] = spoint3 ? (SpiceDouble)spoint3[2] : 0.0;

  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  SpiceDouble phase = 0.0;
  SpiceDouble incdnc = 0.0;
  SpiceDouble emissn = 0.0;
  SpiceBoolean visibl = SPICEFALSE;
  SpiceBoolean lit = SPICEFALSE;

  illumf_c(
      method,
      target,
      ilusrc,
      (SpiceDouble)et,
      fixref,
      abcorr,
      obsrvr,
      spoint,
      &trgepc,
      srfvec,
      &phase,
      &incdnc,
      &emissn,
      &visibl,
      &lit);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }
  if (outPhase) {
    *outPhase = (double)phase;
  }
  if (outIncdnc) {
    *outIncdnc = (double)incdnc;
  }
  if (outEmissn) {
    *outEmissn = (double)emissn;
  }
  if (outVisibl) {
    *outVisibl = visibl == SPICETRUE ? 1 : 0;
  }
  if (outLit) {
    *outLit = lit == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_nvc2pl(
    const double *normal3,
    double konst,
    double *outPlane4,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outPlane4) {
    outPlane4[0] = 0.0;
    outPlane4[1] = 0.0;
    outPlane4[2] = 0.0;
    outPlane4[3] = 0.0;
  }

  SpiceDouble normal[3];
  normal[0] = normal3 ? (SpiceDouble)normal3[0] : 0.0;
  normal[1] = normal3 ? (SpiceDouble)normal3[1] : 0.0;
  normal[2] = normal3 ? (SpiceDouble)normal3[2] : 0.0;

  SpicePlane plane;
  nvc2pl_c(normal, (SpiceDouble)konst, &plane);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPlane4) {
    outPlane4[0] = (double)plane.normal[0];
    outPlane4[1] = (double)plane.normal[1];
    outPlane4[2] = (double)plane.normal[2];
    outPlane4[3] = (double)plane.constant;
  }

  return 0;
}

int tspice_pl2nvc(
    const double *plane4,
    double *outNormal3,
    double *outKonst,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNormal3) {
    outNormal3[0] = 0.0;
    outNormal3[1] = 0.0;
    outNormal3[2] = 0.0;
  }
  if (outKonst) {
    *outKonst = 0.0;
  }

  SpicePlane plane;
  plane.normal[0] = plane4 ? (SpiceDouble)plane4[0] : 0.0;
  plane.normal[1] = plane4 ? (SpiceDouble)plane4[1] : 0.0;
  plane.normal[2] = plane4 ? (SpiceDouble)plane4[2] : 0.0;
  plane.constant = plane4 ? (SpiceDouble)plane4[3] : 0.0;

  SpiceDouble normal[3];
  SpiceDouble outK = 0.0;

  pl2nvc_c(&plane, normal, &outK);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outNormal3) {
    outNormal3[0] = (double)normal[0];
    outNormal3[1] = (double)normal[1];
    outNormal3[2] = (double)normal[2];
  }
  if (outKonst) {
    *outKonst = (double)outK;
  }

  return 0;
}

int tspice_occult(
    const char *targ1,
    const char *shape1,
    const char *frame1,
    const char *targ2,
    const char *shape2,
    const char *frame2,
    const char *abcorr,
    const char *observer,
    double et,
    int *outOcltid,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outOcltid) {
    *outOcltid = 0;
  }

  SpiceInt ocltid = 0;
  occult_c(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, (SpiceDouble)et, &ocltid);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outOcltid) {
    *outOcltid = (int)ocltid;
  }
  return 0;
}
