#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>

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
