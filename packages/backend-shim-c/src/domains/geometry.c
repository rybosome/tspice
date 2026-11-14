#include "tspice_backend_shim.h"

#include "tspice_error.h"
#include "SpiceUsr.h"
#include "SpiceZfc.h"

#include <math.h>
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

static SpicePlane plane_from_components(const double values[4]) {
  SpicePlane plane = {{values[0], values[1], values[2]}, values[3]};
  return plane;
}

static void plane_to_components(const SpicePlane *plane, double out[4]) {
  memcpy(out, plane->normal, sizeof(plane->normal));
  out[3] = plane->constant;
}

static int plane_call_status(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

// Transport holds three consecutive vectors; copy named struct fields so layout
// never relies on padding or on pointer arithmetic across C structure members.
static SpiceEllipse ellipse_from_components(const double in[9]) {
  SpiceEllipse ellipse;
  memcpy(ellipse.center, in, sizeof(ellipse.center));
  memcpy(ellipse.semiMajor, in + 3, sizeof(ellipse.semiMajor));
  memcpy(ellipse.semiMinor, in + 6, sizeof(ellipse.semiMinor));
  return ellipse;
}

static void ellipse_to_components(const SpiceEllipse *ellipse, double out[9]) {
  memcpy(out, ellipse->center, sizeof(ellipse->center));
  memcpy(out + 3, ellipse->semiMajor, sizeof(ellipse->semiMajor));
  memcpy(out + 6, ellipse->semiMinor, sizeof(ellipse->semiMinor));
}

// N0067 INEDPL continues with its private distorted plane after PSV2PL signals
// an error, although its constant has not been initialized. Check the same
// intermediate under the genuine outer traceback before entering that path.
static void probe_inedpl_distortion(double a, double b, double c, const SpicePlane *plane) {
  if (a <= 0 || b <= 0 || c <= 0) return;  // INEDPL diagnoses these before distortion.
  double point[3], span1[3], span2[3];
  SpicePlane distorted = {{0}, 0};
  chkin_c("inedpl_c");
  pl2psv_c(plane, point, span1, span2);
  const double maxRadius = fmax(a, fmax(b, c));
  if (!failed_c() && !(vnorm_c(point) > maxRadius)) {
    const double inverse[3] = {1.0 / a, 1.0 / b, 1.0 / c};
    for (int i = 0; i < 3; i++) {
      point[i] *= inverse[i];
      span1[i] *= inverse[i];
      span2[i] *= inverse[i];
    }
    psv2pl_c(point, span1, span2, &distorted);
  }
  chkout_c("inedpl_c");
}

int tspice_cgv2el(
    const double *center, const double *vec1, const double *vec2, double *outEllipse, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!center || !vec1 || !vec2 || !outEllipse)
    return tspice_return_error(err, errMaxBytes, "Missing cgv2el storage");
  SpiceEllipse ellipse = {{0}, {0}, {0}};
  cgv2el_c(center, vec1, vec2, &ellipse);
  if (plane_call_status(err, errMaxBytes)) return 1;
  ellipse_to_components(&ellipse, outEllipse);
  return 0;
}

int tspice_el2cgv(
    const double *ellipse, double *outCenter, double *outSmajor, double *outSminor, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!ellipse || !outCenter || !outSmajor || !outSminor)
    return tspice_return_error(err, errMaxBytes, "Missing el2cgv storage");
  SpiceEllipse ellipseValue = ellipse_from_components(ellipse);
  SpiceDouble center[3] = {0};
  SpiceDouble smajor[3] = {0};
  SpiceDouble sminor[3] = {0};
  el2cgv_c(&ellipseValue, center, smajor, sminor);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outCenter, center, sizeof(center));
  memcpy(outSmajor, smajor, sizeof(smajor));
  memcpy(outSminor, sminor, sizeof(sminor));
  return 0;
}

int tspice_saelgv(
    const double *vec1, const double *vec2, double *outSmajor, double *outSminor, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!vec1 || !vec2 || !outSmajor || !outSminor)
    return tspice_return_error(err, errMaxBytes, "Missing saelgv storage");
  SpiceDouble smajor[3] = {0};
  SpiceDouble sminor[3] = {0};
  saelgv_c(vec1, vec2, smajor, sminor);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outSmajor, smajor, sizeof(smajor));
  memcpy(outSminor, sminor, sizeof(sminor));
  return 0;
}

int tspice_pjelpl(
    const double *ellipse, const double *plane, double *outProjected, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!ellipse || !plane || !outProjected)
    return tspice_return_error(err, errMaxBytes, "Missing pjelpl storage");
  SpiceEllipse ellipseValue = ellipse_from_components(ellipse);
  SpicePlane planeValue = plane_from_components(plane);
  SpiceEllipse projected = {{0}, {0}, {0}};
  pjelpl_c(&ellipseValue, &planeValue, &projected);
  if (plane_call_status(err, errMaxBytes)) return 1;
  ellipse_to_components(&projected, outProjected);
  return 0;
}

int tspice_inedpl(
    double a, double b, double c, const double *plane, double *outEllipse, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!plane || !outEllipse || !outFound)
    return tspice_return_error(err, errMaxBytes, "Missing inedpl storage");
  SpicePlane planeValue = plane_from_components(plane);
  probe_inedpl_distortion(a, b, c, &planeValue);
  if (plane_call_status(err, errMaxBytes)) return 1;
  SpiceEllipse ellipse = {{0}, {0}, {0}};
  SpiceBoolean found = 0;
  inedpl_c(a, b, c, &planeValue, &ellipse, &found);
  if (plane_call_status(err, errMaxBytes)) return 1;
  *outFound = found != SPICEFALSE;
  if (!found) return 0;
  ellipse_to_components(&ellipse, outEllipse);
  return 0;
}

int tspice_inelpl(
    const double *ellipse, const double *plane, int *outNxpts, double *outXpt1, double *outXpt2, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!ellipse || !plane || !outNxpts || !outXpt1 || !outXpt2)
    return tspice_return_error(err, errMaxBytes, "Missing inelpl storage");
  SpiceEllipse ellipseValue = ellipse_from_components(ellipse);
  SpicePlane planeValue = plane_from_components(plane);
  SpiceInt nxpts = 0;
  SpiceDouble xpt1[3] = {0};
  SpiceDouble xpt2[3] = {0};
  inelpl_c(&ellipseValue, &planeValue, &nxpts, xpt1, xpt2);
  if (plane_call_status(err, errMaxBytes)) return 1;
  *outNxpts = nxpts;
  if (nxpts != 1 && nxpts != 2) return 0;
  memcpy(outXpt1, xpt1, sizeof(xpt1));
  memcpy(outXpt2, xpt2, sizeof(xpt2));
  return 0;
}

int tspice_npelpt(
    const double *point, const double *ellipse, double *outPnear, double *outDist, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!point || !ellipse || !outPnear || !outDist)
    return tspice_return_error(err, errMaxBytes, "Missing npelpt storage");
  SpiceEllipse ellipseValue = ellipse_from_components(ellipse);
  SpiceDouble pnear[3] = {0};
  SpiceDouble dist = 0;
  npelpt_c(point, &ellipseValue, pnear, &dist);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outPnear, pnear, sizeof(pnear));
  *outDist = dist;
  return 0;
}

// SURFPT_C copies a private logical after early errors, before it was assigned
// by SURFPT. Use the linked implementation and the public wrapper's trace frame.
static void checked_surfpt(const double position[3], const double direction[3],
                           double a, double b, double c, double point[3], SpiceBoolean *found) {
  logical hit = 0;
  chkin_c("surfpt_c");
  surfpt_((doublereal *)position, (doublereal *)direction, &a, &b, &c, point, &hit);
  chkout_c("surfpt_c");
  if (!failed_c()) *found = hit != 0;
}

// NPEDLN and EDLIMB continue reading private plane/ellipse storage after some
// nested errors. Probe the same fallible intermediate constructors into
// initialized storage, preserving the canonical outer trace and error order.
static int check_edlimb_path(double a, double b, double c, const double view[3],
                             char *err, int cap) {
  if (a <= 0 || b <= 0 || c <= 0) return 0;
  const double scale = fmax(a, fmax(b,c));
  const double radii[3] = {a/scale,b/scale,c/scale};
  double normal[3], v[3], squares[3];
  vscl_c(1.0/scale,view,v);
  for (int i=0; i<3; ++i) {
    squares[i]=radii[i]*radii[i];
    if (squares[i]==0) return 0;
    normal[i]=v[i]/squares[i];
  }
  const double level=v[0]*v[0]/squares[0]+v[1]*v[1]/squares[1]+v[2]*v[2]/squares[2];
  if (level<1) return 0;
  SpicePlane limbPlane={{0},0};
  chkin_c("edlimb_c");
  nvc2pl_c(normal,1.0,&limbPlane);
  if (!failed_c()) probe_inedpl_distortion(radii[0],radii[1],radii[2],&limbPlane);
  chkout_c("edlimb_c");
  return plane_call_status(err,cap);
}

static int check_npedln_path(double a, double b, double c, const double point[3],
                             const double direction[3], char *err, int cap) {
  double unit[3], magnitude;
  unorm_c(direction,unit,&magnitude);
  if (magnitude==0 || a<=0 || b<=0 || c<=0) return 0;
  const double scale=fmax(a,fmax(b,c));
  const double radii[3]={a/scale,b/scale,c/scale};
  double scaled[3], normal[3], opposite[3], hit[3]={0};
  for (int i=0; i<3; ++i) {
    const double square=radii[i]*radii[i];
    if (square==0) return 0;
    scaled[i]=point[i]/scale;
    normal[i]=unit[i]/square;
  }
  chkin_c("npedln_c");
  SpiceBoolean found=0;
  checked_surfpt(scaled,unit,radii[0],radii[1],radii[2],hit,&found);
  if (!failed_c() && !found) {
    vminus_c(unit,opposite);
    checked_surfpt(scaled,opposite,radii[0],radii[1],radii[2],hit,&found);
  }
  if (!failed_c() && !found) {
    SpicePlane candidatePlane={{0},0}, projection={{0},0};
    SpiceEllipse candidate={{0},{0},{0}}, projected={{0},{0},{0}};
    nvc2pl_c(normal,0.0,&candidatePlane);
    if (!failed_c()) probe_inedpl_distortion(radii[0],radii[1],radii[2],&candidatePlane);
    if (!failed_c()) inedpl_c(radii[0],radii[1],radii[2],&candidatePlane,&candidate,&found);
    if (!failed_c() && found) {
      double projectedPoint[3]={0}, nearest[3]={0}, distance=0;
      nvc2pl_c(unit,0.0,&projection);
      if (!failed_c()) pjelpl_c(&candidate,&projection,&projected);
      if (!failed_c()) vprjp_c(scaled,&projection,projectedPoint);
      if (!failed_c()) {
        // The following call uses a private NEARPT solution. Its documented
        // domain requires a representable translation and scale.
        const double major=vnorm_c(projected.semiMajor);
        const double minor=vnorm_c(projected.semiMinor);
        if (major!=0 && minor!=0) {
          double local[3];
          vsub_c(projectedPoint,projected.center,local);
          vscl_c(1.0/major,local,local);
          if (!isfinite(major) || !isfinite(minor) || !isfinite(1.0/major) ||
              !isfinite(local[0]) || !isfinite(local[1]) || !isfinite(local[2])) {
            chkout_c("npedln_c");
            return tspice_return_error(err,cap,"npedln: projected nearest-point coordinates exceed finite workspace");
          }
        }
        npelpt_c(projectedPoint,&projected,nearest,&distance);
      }
    }
  }
  chkout_c("npedln_c");
  return plane_call_status(err,cap);
}

int tspice_nearpt(
    const double *position, double a, double b, double c, double *outNpoint, double *outAlt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!position || !outNpoint || !outAlt)
    return tspice_return_error(err, errMaxBytes, "Missing nearpt storage");
  SpiceDouble npoint[3] = {0};
  SpiceDouble alt = 0;
  nearpt_c(position, a, b, c, npoint, &alt);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outNpoint, npoint, sizeof(npoint));
  *outAlt = alt;
  return 0;
}

int tspice_npedln(
    double a, double b, double c, const double *linept, const double *linedr, double *outPnear, double *outDist, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!linept || !linedr || !outPnear || !outDist)
    return tspice_return_error(err, errMaxBytes, "Missing npedln storage");
  if (check_npedln_path(a,b,c,linept,linedr,err,errMaxBytes)) return 1;
  SpiceDouble pnear[3] = {0};
  SpiceDouble dist = 0;
  npedln_c(a, b, c, linept, linedr, pnear, &dist);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outPnear, pnear, sizeof(pnear));
  *outDist = dist;
  return 0;
}

int tspice_edlimb(
    double a, double b, double c, const double *viewpt, double *outLimb, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!viewpt || !outLimb)
    return tspice_return_error(err, errMaxBytes, "Missing edlimb storage");
  if (check_edlimb_path(a,b,c,viewpt,err,errMaxBytes)) return 1;
  SpiceEllipse limb = {{0}, {0}, {0}};
  edlimb_c(a, b, c, viewpt, &limb);
  if (plane_call_status(err, errMaxBytes)) return 1;
  ellipse_to_components(&limb, outLimb);
  return 0;
}

int tspice_ednmpt(
    double a, double b, double c, const double *normal, double *outPoint, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!normal || !outPoint)
    return tspice_return_error(err, errMaxBytes, "Missing ednmpt storage");
  SpiceDouble point[3] = {0};
  ednmpt_c(a, b, c, normal, point);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outPoint, point, sizeof(point));
  return 0;
}

int tspice_edpnt(
    const double *point, double a, double b, double c, double *outSurface, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!point || !outSurface)
    return tspice_return_error(err, errMaxBytes, "Missing edpnt storage");
  SpiceDouble surface[3] = {0};
  edpnt_c(point, a, b, c, surface);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outSurface, surface, sizeof(surface));
  return 0;
}

int tspice_surfnm(
    double a, double b, double c, const double *point, double *outNormal, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!point || !outNormal)
    return tspice_return_error(err, errMaxBytes, "Missing surfnm storage");
  SpiceDouble normal[3] = {0};
  surfnm_c(a, b, c, point, normal);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outNormal, normal, sizeof(normal));
  return 0;
}

int tspice_surfpt(
    const double *position, const double *direction, double a, double b, double c, double *outPoint, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (plane_call_status(err, errMaxBytes)) return 1;
  if (!position || !direction || !outPoint || !outFound)
    return tspice_return_error(err, errMaxBytes, "Missing surfpt storage");
  SpiceDouble point[3] = {0};
  SpiceBoolean found = 0;
  checked_surfpt(position, direction, a, b, c, point, &found);
  if (plane_call_status(err, errMaxBytes)) return 1;
  *outFound = found != SPICEFALSE;
  if (!found) return 0;
  memcpy(outPoint, point, sizeof(point));
  return 0;
}

int tspice_nvp2pl(
    const double *normal,
    const double *point,
    double *outResult,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!normal || !point || !outResult) return tspice_return_error(err, errMaxBytes, "Missing nvp2pl storage");
  SpicePlane result = {{0}, 0};
  nvp2pl_c(normal, point, &result);
  if (plane_call_status(err, errMaxBytes)) return 1;
  plane_to_components(&result, outResult);
  return 0;
}

int tspice_pl2nvp(
    const double *plane,
    double *outNormal,
    double *outPoint,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!plane || !outNormal || !outPoint) return tspice_return_error(err, errMaxBytes, "Missing pl2nvp storage");
  SpicePlane planeValue = plane_from_components(plane);
  SpiceDouble normal[3] = {0};
  SpiceDouble point[3] = {0};
  pl2nvp_c(&planeValue, normal, point);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outNormal, normal, sizeof(normal));
  memcpy(outPoint, point, sizeof(point));
  return 0;
}

int tspice_pl2psv(
    const double *plane,
    double *outPoint,
    double *outSpan1,
    double *outSpan2,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!plane || !outPoint || !outSpan1 || !outSpan2) return tspice_return_error(err, errMaxBytes, "Missing pl2psv storage");
  SpicePlane planeValue = plane_from_components(plane);
  SpiceDouble point[3] = {0};
  SpiceDouble span1[3] = {0};
  SpiceDouble span2[3] = {0};
  pl2psv_c(&planeValue, point, span1, span2);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outPoint, point, sizeof(point));
  memcpy(outSpan1, span1, sizeof(span1));
  memcpy(outSpan2, span2, sizeof(span2));
  return 0;
}

int tspice_psv2pl(
    const double *point,
    const double *span1,
    const double *span2,
    double *outResult,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!point || !span1 || !span2 || !outResult) return tspice_return_error(err, errMaxBytes, "Missing psv2pl storage");
  SpicePlane result = {{0}, 0};
  psv2pl_c(point, span1, span2, &result);
  if (plane_call_status(err, errMaxBytes)) return 1;
  plane_to_components(&result, outResult);
  return 0;
}

int tspice_inrypl(
    const double *vertex,
    const double *dir,
    const double *plane,
    int *outNxpts,
    double *outXpt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!vertex || !dir || !plane || !outNxpts || !outXpt) return tspice_return_error(err, errMaxBytes, "Missing inrypl storage");
  SpicePlane planeValue = plane_from_components(plane);
  SpiceInt nxpts = 0;
  SpiceDouble xpt[3] = {0};
  inrypl_c(vertex, dir, &planeValue, &nxpts, xpt);
  if (plane_call_status(err, errMaxBytes)) return 1;
  *outNxpts = nxpts;
  memcpy(outXpt, xpt, sizeof(xpt));
  return 0;
}

int tspice_vprjp(
    const double *vin,
    const double *plane,
    double *outVout,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!vin || !plane || !outVout) return tspice_return_error(err, errMaxBytes, "Missing vprjp storage");
  SpicePlane planeValue = plane_from_components(plane);
  SpiceDouble vout[3] = {0};
  vprjp_c(vin, &planeValue, vout);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outVout, vout, sizeof(vout));
  return 0;
}

int tspice_vprjpi(
    const double *vin,
    const double *projpl,
    const double *invpl,
    double *outVout,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!vin || !projpl || !invpl || !outVout || !outFound) return tspice_return_error(err, errMaxBytes, "Missing vprjpi storage");
  SpicePlane projplValue = plane_from_components(projpl);
  SpicePlane invplValue = plane_from_components(invpl);
  SpiceDouble vout[3] = {0};
  SpiceBoolean found = SPICEFALSE;
  vprjpi_c(vin, &projplValue, &invplValue, vout, &found);
  if (plane_call_status(err, errMaxBytes)) return 1;
  *outFound = found != SPICEFALSE;
  if (!found) return 0;
  memcpy(outVout, vout, sizeof(vout));
  return 0;
}

int tspice_nplnpt(
    const double *linpt,
    const double *lindir,
    const double *point,
    double *outPnear,
    double *outDist,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!linpt || !lindir || !point || !outPnear || !outDist) return tspice_return_error(err, errMaxBytes, "Missing nplnpt storage");
  SpiceDouble pnear[3] = {0};
  SpiceDouble dist = 0;
  nplnpt_c(linpt, lindir, point, pnear, &dist);
  if (plane_call_status(err, errMaxBytes)) return 1;
  memcpy(outPnear, pnear, sizeof(pnear));
  *outDist = dist;
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
