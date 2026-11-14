#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "SpiceZfc.h"

#include <limits.h>
#include <math.h>
#include <stdio.h>
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


static int geometry_input_error(char *err, int errMaxBytes, const char *message) {
  tspice_clear_last_error_buffers();
  if (err && errMaxBytes > 0) snprintf(err, (size_t)errMaxBytes, "%s", message);
  return 1;
}

static int geometry_status(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

static int check_geometry_arguments(double et, const char *const *strings, size_t count,
                                    double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return geometry_status(err, errMaxBytes);
  if (!isfinite(et) || !out) return geometry_input_error(err, errMaxBytes, "Expected finite ET and output storage");
  for (size_t i = 0; i < count; ++i) {
    if (!strings[i] || strlen(strings[i]) >= INT_MAX)
      return geometry_input_error(err, errMaxBytes, "Invalid geometry string or byte length");
  }
  return 0;
}
// ZZBODKER builds the ID hash from paired name/code mappings. N0067
// ZZHASHI takes signed abs(code), which has no representation for INT_MIN.
static int check_body_mapping_codes(char *err, int errMaxBytes) {
  SpiceBoolean found = SPICEFALSE;
  SpiceInt names = 0, codes = 0;
  SpiceChar type[2] = {0};
  dtpool_c("NAIF_BODY_NAME", &found, &names, type);
  if (failed_c()) return geometry_status(err, errMaxBytes);
  if (!found || type[0] != 'C' || names > 14983) return 0;
  dtpool_c("NAIF_BODY_CODE", &found, &codes, type);
  if (failed_c()) return geometry_status(err, errMaxBytes);
  if (!found || type[0] != 'N' || names != codes) return 0;
  int unsafe = 0;
  for (SpiceInt start = 0; start < codes; start += 64) {
    SpiceDouble values[64];
    SpiceInt used = 0;
    gdpool_c("NAIF_BODY_CODE", start, 64, &used, values, &found);
    if (failed_c()) return geometry_status(err, errMaxBytes);
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
    if (failed_c()) return geometry_status(err, errMaxBytes);
    for (SpiceInt i = 0; i < used; ++i) {
      if (!rows[i][0]) return 0;
    }
  }
  return geometry_input_error(err, errMaxBytes, "NAIF_BODY_CODE outside the safe N0067 body hash range");
}


// A text PCK phase degree is converted by i_dnnt before TISBOD checks it.
// Require exactly one readable, safely roundable value when the phase table
// is present. Ordinary representable unsupported degrees keep CSPICE errors.
static int check_phase_degree(int body, char *err, int errMaxBytes) {
  int system = body >= 100 && body <= 999 ? body / 100 :
               body >= 10000 && body <= 99999 ? body / 10000 : body;
  char item[48], type[2];
  SpiceBoolean found = SPICEFALSE;
  SpiceInt n = 0;
  snprintf(item, sizeof(item), "BODY%d_NUT_PREC_ANGLES", system);
  dtpool_c(item, &found, &n, type);
  if (failed_c()) return geometry_status(err, errMaxBytes);
  if (!found) return 0;
  snprintf(item, sizeof(item), "BODY%d_MAX_PHASE_DEGREE", system);
  dtpool_c(item, &found, &n, type);
  if (failed_c()) return geometry_status(err, errMaxBytes);
  if (!found) return 0;
  if (type[0] == 'N' && n == 1) {
    SpiceDouble degree = 0;
    gdpool_c(item, 0, 1, &n, &degree, &found);
    if (failed_c()) return geometry_status(err, errMaxBytes);
    if (degree > (double)INT_MIN - 0.5 && degree < (double)INT_MAX + 0.5) return 0;
  }
  return geometry_input_error(err, errMaxBytes, "Invalid N0067 PCK phase degree storage or integer range");
}


// The pinned body-name cache copies its output code even on a miss. Resolve
// first with initialized storage and preserve the caller's original trace.
static int resolve_geometry_body(const char *text, SpiceInt *code, logical *found) {
  *code = 0;
  *found = SPICEFALSE;
  chkin_c("ZZBODS2C");
  bods2c_((char *)text, code, found, (ftnlen)strlen(text));
  chkout_c("ZZBODS2C");
  return failed_c();
}

static void phase_lookup_error(const char *role, const char *name) {
  setmsg_c("The #, '#', is not a recognized name for an ephemeris object. "
           "The cause of this problem may be that you need an updated version of the SPICE Toolkit. ");
  errch_c("#", role);
  errch_c("#", name);
  sigerr_c("SPICE(IDCODENOTFOUND)");
}

int tspice_phaseq(double et, const char *target, const char *illmn, const char *observer, const char *abcorr, double *out, char *err, int errMaxBytes) {
  const char *strings[] = {target, illmn, observer, abcorr};
  if (check_geometry_arguments(et, strings, 4, out, err, errMaxBytes)) return 1;
  if (*target && *illmn && *observer && *abcorr) {
    if (check_body_mapping_codes(err, errMaxBytes)) return 1;
    const char *roles[] = {"target", "illuminator", "observer"};
    int unsupported = 0;
    chkin_c("phaseq_c"); chkin_c("PHASEQ");
    for (size_t i = 0; i < 3; ++i) {
      SpiceInt code;
      logical found;
      if (resolve_geometry_body(strings[i], &code, &found)) break;
      if (!found) { phase_lookup_error(roles[i], strings[i]); break; }
      if (code == INT_MIN) { unsupported = 1; break; }
    }
    chkout_c("PHASEQ"); chkout_c("phaseq_c");
    if (failed_c()) return geometry_status(err, errMaxBytes);
    if (unsupported) return geometry_input_error(err, errMaxBytes, "Body outside the N0067 signed hash domain");
  }
  *out = phaseq_c(et, target, illmn, observer, abcorr);
  return geometry_status(err, errMaxBytes);
}

int tspice_trgsep(double et, const char *targ1, const char *shape1, const char *frame1, const char *targ2, const char *shape2, const char *frame2, const char *observer, const char *abcorr, double *out, char *err, int errMaxBytes) {
  const char *strings[] = {targ1, shape1, frame1, targ2, shape2, frame2, observer, abcorr};
  if (check_geometry_arguments(et, strings, 8, out, err, errMaxBytes)) return 1;
  int allNonempty = 1;
  for (size_t i = 0; i < 8; ++i) if (!*strings[i]) allNonempty = 0;
  if (allNonempty) {
    if (check_body_mapping_codes(err, errMaxBytes)) return 1;
    const char *bodies[] = {targ1, targ2, observer};
    int unsupported = 0;
    chkin_c("trgsep_c"); chkin_c("TRGSEP"); chkin_c("ZZSPIN");
    for (size_t i = 0; i < 3; ++i) {
      SpiceInt code = 0;
      logical found = SPICEFALSE;
      bods2c_((char *)bodies[i], &code, &found, (ftnlen)strlen(bodies[i]));
      if (failed_c() || !found) break;
      if (code == INT_MIN) { unsupported = 1; break; }
    }
    chkout_c("ZZSPIN"); chkout_c("TRGSEP"); chkout_c("trgsep_c");
    if (failed_c()) return geometry_status(err, errMaxBytes);
    if (unsupported) return geometry_input_error(err, errMaxBytes, "Body outside the N0067 signed hash domain");
  }
  *out = trgsep_c(et, targ1, shape1, frame1, targ2, shape2, frame2, observer, abcorr);
  return geometry_status(err, errMaxBytes);
}

int tspice_lspcn(const char *body, double et, const char *abcorr, double *out, char *err, int errMaxBytes) {
  const char *strings[] = {body, abcorr};
  if (check_geometry_arguments(et, strings, 2, out, err, errMaxBytes)) return 1;
  // The native string guard returns before any translated orientation work.
  if (!*body) { *out = lspcn_c(body, et, abcorr); return geometry_status(err, errMaxBytes); }
  if (check_body_mapping_codes(err, errMaxBytes)) return 1;
  chkin_c("lspcn_c"); chkin_c("LSPCN");
  SpiceInt id = 0, sun = 10, z = 3, y = 2;
  logical found;
  int status = 0;
  SpiceDouble tip[9] = {0}, state[6] = {0}, ss[6] = {0}, pole[3], axis[3], frame[9];
  SpiceDouble pos[3], lt = 0, range = 0, lat = 0, angle = 0;
  if (resolve_geometry_body(body, &id, &found)) goto done;
  if (!found) {
    setmsg_c("The body name # could not be translated to a NAIF ID code.  The cause of this problem may be that you need an updated version of the SPICE Toolkit.");
    errch_c("#",body); sigerr_c("SPICE(NOTRANSLATION)"); goto done;
  }
  if (id == INT_MIN) {
    status = geometry_input_error(err, errMaxBytes, "Body outside the N0067 signed hash domain");
    goto done;
  }
  status = check_phase_degree(id, err, errMaxBytes);
  if (status) goto done;
  // N0067 LSPCN reads TIPBOD, SPKGEO and SPKEZR outputs without testing
  // their statuses. Use the same linked routines and check before each read.
  tipbod_("J2000", &id, &et, tip, 5);
  if (failed_c()) goto done;
  pole[0] = tip[2]; pole[1] = tip[5]; pole[2] = tip[8];
  spkgeo_(&id, &et, "J2000", &sun, state, &lt, 5);
  if (failed_c()) goto done;
  ucrss_(state, state + 3, axis);
  twovec_(axis, &z, pole, &y, frame);
  if (failed_c()) goto done;
  spkezr_("SUN", &et, "J2000", (char *)abcorr, (char *)body, ss, &lt, 3, 5,
          (ftnlen)strlen(abcorr), (ftnlen)strlen(body));
  if (failed_c()) goto done;
  mxv_(frame, ss, pos);
  recrad_(pos, &range, &angle, &lat);
  if (!failed_c()) *out = angle;
done:
  chkout_c("LSPCN"); chkout_c("lspcn_c");
  return status ? status : geometry_status(err, errMaxBytes);
}
