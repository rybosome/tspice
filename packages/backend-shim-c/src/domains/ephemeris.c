#include <limits.h>
#include <math.h>
#include <stdlib.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../handle_validation.h"
#include "SpiceZfc.h"
#include "SpiceUsr.h"
#include "tspice_backend_shim.h"

static int tspice_ephemeris_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // Stable ABI boundary: never invoke CSPICE with invalid pointers/lengths.
  // Also clear structured last-error buffers so higher-level callers don't
  // accidentally attach stale SPICE fields to these validation errors.
  tspice_clear_last_error_buffers();

  if (err && errMaxBytes > 0) {
    if (msg) {
      strncpy(err, msg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    } else {
      err[0] = '\0';
    }
  }

  return 1;
}

static int tspice_int_to_spice_int_checked(
    int value,
    SpiceInt *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_int_to_spice_int_checked(): out must be non-null");
  }

  const SpiceInt v = (SpiceInt)value;
  if ((int)v != value) {
    char buf[200];
    snprintf(buf, sizeof(buf), "%s: int value out of SpiceInt range (%d)", ctx, value);
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, buf);
  }

  *out = v;
  return 0;
}

static int tspice_spice_int_to_int_checked(
    SpiceInt value,
    int *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spice_int_to_int_checked(): out must be non-null");
  }

  const int v = (int)value;
  if ((SpiceInt)v != value) {
    char buf[220];
    snprintf(buf, sizeof(buf), "%s: SpiceInt value out of int range (%ld)", ctx, (long)value);
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, buf);
  }

  *out = v;
  return 0;
}

int tspice_conics(const double *elts, double et, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!elts || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing conics storage");
  SpiceDouble result[6] = {0};
  conics_c(elts, et, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, 6 * sizeof(SpiceDouble));
  return 0;
}

int tspice_eqncpv(double et, double epoch, const double *eqel, double rapol, double decpol, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!eqel || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing eqncpv storage");
  SpiceDouble result[6] = {0};
  eqncpv_c(et, epoch, eqel, rapol, decpol, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, 6 * sizeof(SpiceDouble));
  return 0;
}

int tspice_oscelt(const double *state, double et, double mu, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!state || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing oscelt storage");
  SpiceDouble result[8] = {0};
  oscelt_c(state, et, mu, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, 8 * sizeof(SpiceDouble));
  return 0;
}

int tspice_oscltx(const double *state, double et, double mu, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!state || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing oscltx storage");
  // N0067 clears all reserved words, although only the first eleven have defined meanings.
  SpiceDouble result[SPICE_OSCLTX_NELTS] = {0};
  oscltx_c(state, et, mu, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, 11 * sizeof(SpiceDouble));
  return 0;
}

int tspice_prop2b(double gm, const double *pvinit, double dt, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!pvinit || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing prop2b storage");
  SpiceDouble result[6] = {0};
  prop2b_c(gm, pvinit, dt, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, 6 * sizeof(SpiceDouble));
  return 0;
}

// The calendar converter uses signed integer day counts. A rejected large epoch
// still gets the toolkit's own syntax and kernel diagnostics on a safe surrogate.
int tspice_getelm(int firstYear, int stride, const char *lines, double *epoch, double *elems, char *err,
                  int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!lines || !epoch || !elems || stride < 8 || stride > 134217728)
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Invalid TLE row storage");
  const char *row2 = lines + stride;
  const char *end1 = memchr(lines, 0, (size_t)stride);
  const char *end2 = memchr(row2, 0, (size_t)stride);
  if (!end1 || !end2 || (end1 - lines < 7 && end2 - row2 < 7))
    return tspice_ephemeris_invalid_arg(err, errMaxBytes,
                                        "TLE records require a terminator and space for the ID");
  int unsafeYear = firstYear < -5000000 || firstYear > 5000000;
  int unsafeDay = 0;
  if (end1 - lines >= 32) {
    SpiceDouble day = 0;
    SpiceInt pos = 0;
    char field[12], diagnostic[160];
    memcpy(field, lines + 20, sizeof(field));
    nparsd_(field, &day, diagnostic, &pos, 12, 160);
    // At either year bound the absolute Gregorian day count is <1.83e9.
    // This allowance also leaves headroom for epoch reference-day subtraction.
    unsafeDay = diagnostic[0] == ' ' && (!isfinite(day) || fabs(day) > 300000000.0);
  }
  char *safeLines = NULL;
  if (unsafeDay) {
    safeLines = malloc((size_t)stride * 2);
    if (!safeLines)
      return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Unable to allocate TLE validation rows");
    memcpy(safeLines, lines, (size_t)stride * 2);
    memcpy(safeLines + 20, "001.00000000", 12);
  }
  getelm_c(unsafeYear ? 2000 : firstYear, stride, safeLines ? safeLines : lines, epoch, elems);
  free(safeLines);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (unsafeYear || unsafeDay)
    return tspice_ephemeris_invalid_arg(err, errMaxBytes,
                                        "TLE epoch exceeds the supported signed calendar day range");
  return 0;
}

int tspice_evsgp4(double et, const double *geophs, const double *elems, double *state, char *err,
                  int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!geophs || !elems || !state || !isfinite(et))
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Invalid SGP4 arguments");
  for (int i = 0; i < 8; i++)
    if (!isfinite(geophs[i]))
      return tspice_ephemeris_invalid_arg(err, errMaxBytes, "SGP4 constants must be finite");
  for (int i = 0; i < 10; i++)
    if (!isfinite(elems[i]))
      return tspice_ephemeris_invalid_arg(err, errMaxBytes, "SGP4 elements must be finite");
  if (fabs(elems[9]) > 1.6e14)
    return tspice_ephemeris_invalid_arg(err, errMaxBytes,
                                        "SGP4 epoch exceeds the supported signed calendar day range");
  // Only resonant deep-space orbits use the unbounded 720-minute integration
  // loop. ZZINIL supplies the same corrected motion as the propagator.
  // Its epoch affects only sidereal time; that output is unused in this check.
  if (fabs(et - elems[9]) >= 43200000000.0) {
    SpiceInt mode = 2;
    SpiceDouble epoch = 0, ecc = elems[5], incl = elems[3], motion = elems[8], aux[13] = {0};
    zzinil_((SpiceDouble *)geophs, &mode, &ecc, &epoch, &incl, &motion, &aux[0], &aux[1], &aux[2], &aux[3],
            &aux[4], &aux[5], &aux[6], &aux[7], &aux[8], &aux[9], &aux[10], &aux[11], &aux[12]);
    if (failed_c()) {
      tspice_get_spice_error_message_and_reset(err, errMaxBytes);
      return 1;
    }
    const int resonant = (motion > .0034906585 && motion < .0052359877) ||
                         (motion >= .00826 && motion <= .00924 && ecc >= .5);
    if (resonant) {
      // Enter the canonical trace frames and run only EVSGP4's initialization
      // stage. Its errors precede any propagation work in the public routine.
      SpiceInt actualMode = 1;
      chkin_c("evsgp4_c");
      chkin_c("EVSGP4");
      xxsgp4i_((SpiceDouble *)geophs, (SpiceDouble *)elems, &actualMode);
      chkout_c("EVSGP4");
      chkout_c("evsgp4_c");
      if (failed_c()) {
        tspice_get_spice_error_message_and_reset(err, errMaxBytes);
        return 1;
      }
      return tspice_ephemeris_invalid_arg(err, errMaxBytes,
                                          "SGP4 resonant interval reaches one million integration steps");
    }
  }
  evsgp4_c(et, geophs, elems, state);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

// N0067 uses unchecked private scratch in four correction routines. Preserve
// the first toolkit error and its trace before a consumer reads a failed
// producer. Successful preflights run under the same serialized kernel state.
static void correction_geometry(int body, double et, const char *ref, double state[6]) {
  integer ssb = 0;
  double lt = 0;
  spkgeo_(&body, &et, (char *)ref, &ssb, state, &lt, (ftnlen)strlen(ref));
}

static void check_stellar_state(int target, double et, const char *ref, const char *abcorr,
                                const double observerState[6], const double acceleration[3],
                                logical transmission) {
  double state[6] = {0}, lt = 0, dlt = 0, correction[3] = {0}, rate[3] = {0};
  spkltc_(&target, &et, (char *)ref, (char *)abcorr, (double *)observerState,
          state, &lt, &dlt, (ftnlen)strlen(ref), (ftnlen)strlen(abcorr));
  if (!failed_c()) {
    zzstelab_(&transmission, (double *)acceleration, (double *)(observerState + 3),
              state, correction, rate);
  }
}

static void check_modern_correction(const char *wrapper, const char *routine,
                                    int target, double et, const char *ref, const char *abcorr,
                                    int observer, const double *observerState, const double *acceleration) {
  // Empty strings are diagnosed by the public wrapper before SPICELIB entry.
  if (failed_c() || !*ref || !*abcorr) return;
  logical attributes[15] = {0};
  integer frame = 0;
  chkin_c(wrapper);
  chkin_c(routine);
  zzvalcor_((char *)abcorr, attributes, (ftnlen)strlen(abcorr));
  if (!failed_c() && attributes[2]) {
    irfnum_((char *)ref, &frame, (ftnlen)strlen(ref));
    // Unknown inertial frames are diagnosed safely by SPKACS/SPKAPS itself.
    if (frame != 0) {
      if (observerState) {
        check_stellar_state(target, et, ref, abcorr, observerState, acceleration, attributes[4]);
      } else {
        double state[6] = {0}, before[6] = {0}, after[6] = {0}, acc[3] = {0};
        correction_geometry(observer, et, ref, state);
        if (!failed_c()) correction_geometry(observer, et - 1., ref, before);
        if (!failed_c()) correction_geometry(observer, et + 1., ref, after);
        if (!failed_c()) {
          qderiv_c(3, before + 3, after + 3, 1., acc);
          chkin_c("SPKAPS");
          check_stellar_state(target, et, ref, abcorr, state, acc, attributes[4]);
          chkout_c("SPKAPS");
        }
      }
    }
  }
  chkout_c(routine);
  chkout_c(wrapper);
}

static void check_legacy_state(int target, double et, const char *ref, const char *abcorr,
                               const double observerState[6]) {
  if (failed_c() || !*ref || !*abcorr) return;
  // SPKAPP normalizes to this five-byte FORTRAN field. Remove only the stellar
  // suffix and let its original nonstellar path check every shifted epoch.
  char option[5] = {0};
  integer zero = 0;
  ljucrs_(&zero, (char *)abcorr, option, (ftnlen)strlen(abcorr), 5);
  const int transmission = !memcmp(option, "XLT+S", 5) || !memcmp(option, "XCN+S", 5);
  if (!transmission && memcmp(option, "LT+S ", 5) && memcmp(option, "CN+S ", 5)) return;
  const int length = transmission ? 3 : 2;
  double state[6] = {0}, lt = 0, corrected[3] = {0};
  chkin_c("spkapp_c");
  spkapp_(&target, &et, (char *)ref, (double *)observerState, option, state, &lt,
          (ftnlen)strlen(ref), (ftnlen)length);
  if (!failed_c()) {
    chkin_c("SPKAPP");
    if (transmission) stlabx_(state, (double *)(observerState + 3), corrected);
    else stelab_(state, (double *)(observerState + 3), corrected);
    chkout_c("SPKAPP");
  }
  chkout_c("spkapp_c");
}

static void check_light_time_geometry(double et, int observer, const char *dir, int target) {
  if (failed_c() || (strncmp(dir, "->", 2) && strncmp(dir, "<-", 2))) return;
  double state[6] = {0};
  chkin_c("ltime_c");
  chkin_c("LTIME");
  correction_geometry(observer, et, "J2000", state);
  if (!failed_c()) correction_geometry(target, et, "J2000", state);
  chkout_c("LTIME");
  chkout_c("ltime_c");
}

// E09 routines eventually call SPKAPS or ZZSPKFAP. Both use the stellar
// correction's output without checking its failure flag first. Set up the
// original constant-velocity state callback and check the same SPICELIB
// components before dispatch. The native mutex (or one WASM instance)
// serializes this private stored-state use with the final CSPICE call.
static void preflight_relative_stellar(int observerPoint, int other, int center, double et,
                                       const char *ref, const char *option, logical transmit) {
  const ftnlen width = (ftnlen)strlen(ref);
  double obs[6] = {0}, acc[3] = {0}, samples[3][6] = {{0}}, lt = 0, dlt = 0;
  chkin_c(observerPoint ? "ZZSPKFAO" : "ZZSPKFAT");
  for (int i = 0; i < 3 && !failed_c(); ++i) {
    double t = et + (i == 0 ? 0.0 : i == 1 ? -1.0 : 1.0);
    if (observerPoint) {
      double offset[6] = {0}, origin[6] = {0};
      zzcvxsta_(&t, (char *)ref, &center, offset, width);
      if (!failed_c()) spkssb_(&center, &t, (char *)ref, origin, width);
      if (!failed_c()) vaddg_c(offset, origin, 6, samples[i]);
    } else {
      correction_geometry(other, t, ref, samples[i]);
    }
  }
  if (!failed_c()) {
    memcpy(obs, samples[0], sizeof(obs));
    qderiv_c(3, samples[1] + 3, samples[2] + 3, 1.0, acc);
    if (observerPoint) {
      chkin_c("SPKAPS");
      check_stellar_state(other, et, ref, option, obs, acc, transmit);
      chkout_c("SPKAPS");
    } else {
      double apparent[6] = {0}, corr[3] = {0}, rate[3] = {0};
      chkin_c("ZZSPKFAP");
      zzspkflt_((S_fp)zzcvxsta_, &et, (char *)ref, (char *)option, obs,
                apparent, &lt, &dlt, width, (ftnlen)strlen(option));
      if (!failed_c()) zzstelab_(&transmit, acc, obs + 3, apparent, corr, rate);
      chkout_c("ZZSPKFAP");
    }
  }
  chkout_c(observerPoint ? "ZZSPKFAO" : "ZZSPKFAT");
}

static void preflight_relative(int observerPoint, int fixed, const char *otherName,
                               double et, const char *outref, const char *refloc,
                               const char *option, const double *point, double pointEpoch,
                               const char *centerName, const char *pointFrame) {
  const char *positionRoutine=observerPoint ? "SPKCPO" : "SPKCPT";
  const char *velocityRoutine=observerPoint ? "SPKCVO" : "SPKCVT";
  // These routine frames are where SPKCVO/T validate the actual option.
  // Use their parser before choosing a checked branch, including for leading,
  // embedded or trailing blanks. The scientific call retains the original input.
  logical attributes[15] = {0};
  if (fixed) chkin_c(positionRoutine);
  chkin_c(velocityRoutine);
  zzvalcor_((char *)option, attributes, (ftnlen)strlen(option));
  chkout_c(velocityRoutine);
  if (fixed) chkout_c(positionRoutine);
  if (failed_c()) return;
  const logical stellar = attributes[2];
  const int observerLocus = eqstr_c(refloc, "OBSERVER");
  if (!stellar && !(observerLocus && attributes[1])) return;
  int center=0, other=0, frame=0, frameCenter=0, frameClass=0, classId=0;
  SpiceBoolean found=SPICEFALSE;
  bods2c_c(centerName,&center,&found);
  if (!found || failed_c()) return;
  bods2c_c(otherName,&other,&found);
  if (!found || failed_c()) return;
  namfrm_c(outref,&frame);
  if (!frame || failed_c()) return;
  const int centerLocus=eqstr_c(refloc,"CENTER");
  if (!observerLocus && !centerLocus && !eqstr_c(refloc,"TARGET")) return;
  const char *zeroRoutine=observerPoint ? "ZZSPKFZO" : "ZZSPKFZT";
  if (fixed) chkin_c(positionRoutine);
  chkin_c(velocityRoutine);
  double state[6] = {0};
  memcpy(state,point,(fixed ? 3 : 6)*sizeof(double));
  zzcvssta_(state,&center,&pointEpoch,(char *)pointFrame,(ftnlen)strlen(pointFrame));
  if (observerLocus || centerLocus) chkin_c(zeroRoutine);
  const char *ref="J2000";
  if (centerLocus) {
    frinfo_c(frame,&frameCenter,&frameClass,&classId,&found);
    if (found && frameClass == 1) ref=outref;
  }
  if (!failed_c() && stellar) preflight_relative_stellar(observerPoint,other,center,et,ref,option,attributes[4]);
  if (observerLocus || centerLocus) chkout_c(zeroRoutine);
  if (!failed_c() && observerLocus && frame == 1) {
    // SPKCVO/T copy private J2000 state immediately on return from ZZSPKFZ*.
    double checked[6] = {0}, lt = 0;
    if (observerPoint)
      zzspkfzo_(&other,&et,"J2000",(char *)option,(S_fp)zzcvxsta_,checked,&lt,5,(ftnlen)strlen(option));
    else
      zzspkfzt_((S_fp)zzcvxsta_,&et,"J2000",(char *)option,&other,checked,&lt,5,(ftnlen)strlen(option));
  }
  chkout_c(velocityRoutine);
  if (fixed) chkout_c(positionRoutine);
}

// AZLCPO validates its center, centered frame and method before requesting
// the ellipsoid normal. Match that order and the exact intermediate routines
// before checking the nested observer-position query.
static void preflight_azimuth(const char *method, const char *target, double et, const char *option,
                              const double pos[3], const char *centerName, const char *frameName) {
  int center=0, frame=0, frameCenter=0, frameClass=0, classId=0;
  SpiceBoolean found=SPICEFALSE;
  bods2c_c(centerName,&center,&found);
  if (!found || failed_c()) return;
  namfrm_c(frameName,&frame);
  frinfo_c(frame,&frameCenter,&frameClass,&classId,&found);
  if (!found || failed_c() || center!=frameCenter || !eqstr_c(method,"ELLIPSOID")) return;
  chkin_c("AZLCPO");
  if (pos[0] != 0.0 || pos[1] != 0.0) {
    double axes[3] = {0}, nearest[3] = {0}, alt=0, normal[3]={0}, rotation[9]={0};
    double north[3]={0,0,1};
    integer z=3,x=1;
    zzgftreb_(&center,axes);
    if (!failed_c()) nearpt_((double *)pos,axes,axes+1,axes+2,nearest,&alt);
    if (!failed_c()) surfnm_(axes,axes+1,axes+2,nearest,normal);
    if (!failed_c()) twovec_(normal,&z,north,&x,rotation);
  }
  if (!failed_c()) preflight_relative(1,1,target,et,frameName,"OBSERVER",option,pos,0.0,centerName,frameName);
  chkout_c("AZLCPO");
}

int tspice_spkcpo(const char *target, double et, const char *outref, const char *refloc, const char *abcorr, const double *obspos, const char *obsctr, const char *obsref, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!target || !outref || !refloc || !abcorr || !obspos || !obsctr || !obsref || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkcpo storage");
  if (strlen(target) > INT_MAX || strlen(outref) > INT_MAX || strlen(refloc) > INT_MAX || strlen(abcorr) > INT_MAX || strlen(obsctr) > INT_MAX || strlen(obsref) > INT_MAX) return tspice_ephemeris_invalid_arg(err,errMaxBytes,"String exceeds CSPICE width");
  double result[7]={0};
  if (!failed_c() && *target && *outref && *refloc && *abcorr && *obsctr && *obsref) {
    chkin_c("spkcpo_c");
    preflight_relative(1,1,target,et,outref,refloc,abcorr,obspos,0.0,obsctr,obsref);
    chkout_c("spkcpo_c");
  }
  if (!failed_c()) spkcpo_c(target, et, outref, refloc, abcorr, obspos, obsctr, obsref,result,result+6);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err,errMaxBytes);
    return 1;
  }
  memcpy(out,result,sizeof(result));
  return 0;
}

int tspice_spkcpt(const double *trgpos, const char *trgctr, const char *trgref, double et, const char *outref, const char *refloc, const char *abcorr, const char *obsrvr, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!trgpos || !trgctr || !trgref || !outref || !refloc || !abcorr || !obsrvr || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkcpt storage");
  if (strlen(trgctr) > INT_MAX || strlen(trgref) > INT_MAX || strlen(outref) > INT_MAX || strlen(refloc) > INT_MAX || strlen(abcorr) > INT_MAX || strlen(obsrvr) > INT_MAX) return tspice_ephemeris_invalid_arg(err,errMaxBytes,"String exceeds CSPICE width");
  double result[7]={0};
  if (!failed_c() && *trgctr && *trgref && *outref && *refloc && *abcorr && *obsrvr) {
    chkin_c("spkcpt_c");
    preflight_relative(0,1,obsrvr,et,outref,refloc,abcorr,trgpos,0.0,trgctr,trgref);
    chkout_c("spkcpt_c");
  }
  if (!failed_c()) spkcpt_c(trgpos, trgctr, trgref, et, outref, refloc, abcorr, obsrvr,result,result+6);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err,errMaxBytes);
    return 1;
  }
  memcpy(out,result,sizeof(result));
  return 0;
}

int tspice_spkcvo(const char *target, double et, const char *outref, const char *refloc, const char *abcorr, const double *obssta, double obsepc, const char *obsctr, const char *obsref, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!target || !outref || !refloc || !abcorr || !obssta || !obsctr || !obsref || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkcvo storage");
  if (strlen(target) > INT_MAX || strlen(outref) > INT_MAX || strlen(refloc) > INT_MAX || strlen(abcorr) > INT_MAX || strlen(obsctr) > INT_MAX || strlen(obsref) > INT_MAX) return tspice_ephemeris_invalid_arg(err,errMaxBytes,"String exceeds CSPICE width");
  double result[7]={0};
  if (!failed_c() && *target && *outref && *refloc && *abcorr && *obsctr && *obsref) {
    chkin_c("spkcvo_c");
    preflight_relative(1,0,target,et,outref,refloc,abcorr,obssta,obsepc,obsctr,obsref);
    chkout_c("spkcvo_c");
  }
  if (!failed_c()) spkcvo_c(target, et, outref, refloc, abcorr, obssta, obsepc, obsctr, obsref,result,result+6);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err,errMaxBytes);
    return 1;
  }
  memcpy(out,result,sizeof(result));
  return 0;
}

int tspice_spkcvt(const double *trgsta, double trgepc, const char *trgctr, const char *trgref, double et, const char *outref, const char *refloc, const char *abcorr, const char *obsrvr, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!trgsta || !trgctr || !trgref || !outref || !refloc || !abcorr || !obsrvr || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkcvt storage");
  if (strlen(trgctr) > INT_MAX || strlen(trgref) > INT_MAX || strlen(outref) > INT_MAX || strlen(refloc) > INT_MAX || strlen(abcorr) > INT_MAX || strlen(obsrvr) > INT_MAX) return tspice_ephemeris_invalid_arg(err,errMaxBytes,"String exceeds CSPICE width");
  double result[7]={0};
  if (!failed_c() && *trgctr && *trgref && *outref && *refloc && *abcorr && *obsrvr) {
    chkin_c("spkcvt_c");
    preflight_relative(0,0,obsrvr,et,outref,refloc,abcorr,trgsta,trgepc,trgctr,trgref);
    chkout_c("spkcvt_c");
  }
  if (!failed_c()) spkcvt_c(trgsta, trgepc, trgctr, trgref, et, outref, refloc, abcorr, obsrvr,result,result+6);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err,errMaxBytes);
    return 1;
  }
  memcpy(out,result,sizeof(result));
  return 0;
}

int tspice_azlcpo(const char *method, const char *target, double et, const char *abcorr, int azccw, int elplsz, const double *obspos, const char *obsctr, const char *obsref, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!method || !target || !abcorr || !obspos || !obsctr || !obsref || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing azlcpo storage");
  if (strlen(method) > INT_MAX || strlen(target) > INT_MAX || strlen(abcorr) > INT_MAX || strlen(obsctr) > INT_MAX || strlen(obsref) > INT_MAX) return tspice_ephemeris_invalid_arg(err,errMaxBytes,"String exceeds CSPICE width");
  double result[7]={0};
  if (!failed_c() && *method && *target && *abcorr && *obsctr && *obsref) {
    chkin_c("azlcpo_c");
    preflight_azimuth(method,target,et,abcorr,obspos,obsctr,obsref);
    chkout_c("azlcpo_c");
  }
  if (!failed_c()) azlcpo_c(method, target, et, abcorr, azccw, elplsz, obspos, obsctr, obsref,result,result+6);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err,errMaxBytes);
    return 1;
  }
  memcpy(out,result,sizeof(result));
  return 0;
}

int tspice_spkacs(int target, double et, const char *ref, const char *abcorr, int observer, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!ref || !abcorr || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkacs storage");
  double result[8] = {0};
  if (strlen(ref) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "ref length exceeds signed CSPICE width");
  if (strlen(abcorr) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "abcorr length exceeds signed CSPICE width");
  check_modern_correction("spkacs_c", "SPKACS", target, et, ref, abcorr, observer, NULL, NULL);
  if (!failed_c()) spkacs_c(target, et, ref, abcorr, observer, result, result + 6, result + 7);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_spkapo(int target, double et, const char *ref, const double *observerState, const char *abcorr, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!ref || !observerState || !abcorr || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkapo storage");
  double result[4] = {0};
  if (strlen(ref) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "ref length exceeds signed CSPICE width");
  if (strlen(abcorr) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "abcorr length exceeds signed CSPICE width");
  spkapo_c(target, et, ref, observerState, abcorr, result, result + 3);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_spkapp(int target, double et, const char *ref, const double *observerState, const char *abcorr, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!ref || !observerState || !abcorr || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkapp storage");
  double result[7] = {0};
  if (strlen(ref) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "ref length exceeds signed CSPICE width");
  if (strlen(abcorr) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "abcorr length exceeds signed CSPICE width");
  check_legacy_state(target, et, ref, abcorr, observerState);
  if (!failed_c()) spkapp_c(target, et, ref, observerState, abcorr, result, result + 6);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_spkaps(int target, double et, const char *ref, const char *abcorr, const double *observerState, const double *observerAcceleration, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!ref || !abcorr || !observerState || !observerAcceleration || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkaps storage");
  double result[8] = {0};
  if (strlen(ref) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "ref length exceeds signed CSPICE width");
  if (strlen(abcorr) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "abcorr length exceeds signed CSPICE width");
  check_modern_correction("spkaps_c", "SPKAPS", target, et, ref, abcorr, 0, observerState, observerAcceleration);
  if (!failed_c()) spkaps_c(target, et, ref, abcorr, observerState, observerAcceleration, result, result + 6, result + 7);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_spkltc(int target, double et, const char *ref, const char *abcorr, const double *observerState, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!ref || !abcorr || !observerState || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing spkltc storage");
  double result[8] = {0};
  if (strlen(ref) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "ref length exceeds signed CSPICE width");
  if (strlen(abcorr) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "abcorr length exceeds signed CSPICE width");
  spkltc_c(target, et, ref, abcorr, observerState, result, result + 6, result + 7);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_stelab(const double *position, const double *observerVelocity, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!position || !observerVelocity || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing stelab storage");
  double result[3] = {0};
  stelab_c(position, observerVelocity, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_stlabx(const double *position, const double *observerVelocity, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!position || !observerVelocity || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing stlabx storage");
  double result[3] = {0};
  stlabx_c(position, observerVelocity, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_ltime(double etobs, int observer, const char *dir, int target, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!dir || !out) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "Missing ltime storage");
  double result[2] = {0};
  if (strlen(dir) > INT_MAX) return tspice_ephemeris_invalid_arg(err, errMaxBytes, "dir length exceeds signed CSPICE width");
  check_light_time_geometry(etobs, observer, dir, target);
  if (!failed_c()) ltime_c(etobs, observer, dir, target, result, result + 1);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_spkezr(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkezr_c(target, (SpiceDouble)et, ref, abcorr, observer, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkpos(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkpos_c(target, (SpiceDouble)et, ref, abcorr, observer, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkez(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkez()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkez()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkez_c(targ, (SpiceDouble)et, ref, abcorr, obs, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkezp(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkezp()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkezp()", err, errMaxBytes) != 0) return 1;

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkezp_c(targ, (SpiceDouble)et, ref, abcorr, obs, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkgeo(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkgeo()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkgeo()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkgeo_c(targ, (SpiceDouble)et, ref, obs, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkgps(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkgps()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkgps()", err, errMaxBytes) != 0) return 1;

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkgps_c(targ, (SpiceDouble)et, ref, obs, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkssb(
    int target,
    double et,
    const char *ref,
    double *outState6,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkssb()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  spkssb_c(targ, (SpiceDouble)et, ref, state);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }

  return 0;
}

int tspice_spkcov(
    const char *spk,
    int idcode,
    uintptr_t coverWindowHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cover = tspice_validate_handle(coverWindowHandle, "window", "tspice_spkcov()", err, errMaxBytes);
  if (!cover) {
    return 1;
  }
  if (cover->dtype != SPICE_DP) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkcov(): expected SPICE_DP window");
  }

  SpiceInt code = 0;
  if (tspice_int_to_spice_int_checked(idcode, &code, "tspice_spkcov()", err, errMaxBytes) != 0) return 1;

  spkcov_c(spk, code, cover);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkobj(
    const char *spk,
    uintptr_t idsCellHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *ids = tspice_validate_handle(idsCellHandle, "cell", "tspice_spkobj()", err, errMaxBytes);
  if (!ids) {
    return 1;
  }
  if (ids->dtype != SPICE_INT) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkobj(): expected SPICE_INT cell");
  }

  spkobj_c(spk, ids);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

// SPKBSR stores at most 5000 distinct physical files and de-duplicates
// repeated loads. Generations keep old local tokens from acting on a later
// registration, even when an independent DAF link kept the physical handle.
enum { SPK_LOAD_CAPACITY = 5000 };
typedef struct {
  int handle;
  int generation;
  int inKeeper;
} SpkRegistration;
static SpkRegistration spk_loads[SPK_LOAD_CAPACITY];
static int next_spk_generation;

static int spk_status(char *err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err,cap);
  return 1;
}

static int spk_generation(int handle, int *out, char *err, int cap) {
  int vacant = -1;
  for (int i=0; i<SPK_LOAD_CAPACITY; ++i) {
    if (spk_loads[i].generation && spk_loads[i].handle == handle) {
      *out = spk_loads[i].generation;
      return 0;
    }
    if (!spk_loads[i].generation && vacant < 0) vacant = i;
  }
  if (vacant < 0 || next_spk_generation == INT_MAX)
    return tspice_ephemeris_invalid_arg(err,cap,"SPK registration limit reached");
  spk_loads[vacant] = (SpkRegistration){handle, ++next_spk_generation, 0};
  *out = next_spk_generation;
  return 0;
}

// KEEPER may unload a directly registered file. Take snapshots around its
// actual mutation. A direct-only load survives a KEEPER clear. A duplicate
// KEEPER link still present after unload keeps its existing generation.
void tspice_spk_keeper_snapshot(int after) {
  int active = 0;
  for (int i=0; i<SPK_LOAD_CAPACITY; ++i) {
    if (spk_loads[i].generation) {
      active = 1;
      if (!after) spk_loads[i].inKeeper = 0;
    }
  }
  if (!active) return;
  SpiceInt count = 0;
  ktotal_c("SPK", &count);
  for (int row=0; row<count; ++row) {
    char file[256], type[9], source[256];
    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;
    kdata_c(row,"SPK",sizeof(file),sizeof(type),sizeof(source),file,type,source,&handle,&found);
    if (!found || failed_c()) continue;
    for (int i=0; i<SPK_LOAD_CAPACITY; ++i)
      if (spk_loads[i].generation && spk_loads[i].handle == handle)
        spk_loads[i].inKeeper = after ? 0 : 1;
  }
  if (after) {
    for (int i=0; i<SPK_LOAD_CAPACITY; ++i)
      if (spk_loads[i].inKeeper) spk_loads[i] = (SpkRegistration){0};
  }
}

static SpkRegistration *spk_registration(int generation) {
  for (int i=0; generation>0 && i<SPK_LOAD_CAPACITY; ++i)
    if (spk_loads[i].generation == generation) return &spk_loads[i];
  return NULL;
}

int tspice_spklef(const char *path, int *generation, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!path || !generation || next_spk_generation == INT_MAX)
    return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK load path, generation or result");
  SpiceInt handle = 0;
  spklef_c(path, &handle);
  if (spk_status(err,cap)) return 1;
  return spk_generation(handle,generation,err,cap);
}

int tspice_spkuef(int generation, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  SpkRegistration *entry = spk_registration(generation);
  // The canonical unload of a file absent from SPKBSR is a no-op. Zero
  // cannot be a physical DAF handle and cannot unload a replacement.
  spkuef_c(entry ? entry->handle : 0);
  if (spk_status(err,cap)) return 1;
  if (entry) *entry = (SpkRegistration){0};
  return 0;
}

static int spk_reader(int source, int isRegistration, int *handle, char *err, int cap) {
  if (!isRegistration) { *handle = source; return 0; }
  SpkRegistration *entry = spk_registration(source);
  if (!entry) return tspice_ephemeris_invalid_arg(err,cap,"SPK registration is no longer active");
  *handle = entry->handle;
  return 0;
}

// Authenticate the entire native-word descriptor against real DAF summary
// records without disturbing the user's current DAF search or selection.
static int spk_file_descriptor(int handle, const void *input, int size, double words[5],
                               int integers[6], char *err, int cap) {
  if (!input || size != 40)
    return tspice_ephemeris_invalid_arg(err,cap,"Expected exactly 40 packed SPK descriptor bytes");
  char arch[9] = {0}, kind[9] = {0}, path[256] = {0};
  dafhfn_(&handle,path,255);
  if (spk_status(err,cap)) return 1;
  for (int i=254; i>=0 && path[i]==' '; --i) path[i]=0;
  getfat_c(path,sizeof(arch),sizeof(kind),arch,kind);
  if (spk_status(err,cap)) return 1;
  if (strcmp(arch,"DAF") || strcmp(kind,"SPK"))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected a readable SPK DAF");
  char name[61] = {0};
  int fields[5] = {0};
  if (tspice_dafrfr(handle,sizeof(name),name,sizeof(name),fields,err,cap)) return 1;
  if (fields[0]!=2 || fields[1]!=6 || fields[4]<2)
    return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK DAF file record");
  const int limit = (fields[4]-2)/128+1;
  int record=fields[2], previous=0;
  for (int visited=0; record && visited<limit; ++visited) {
    double row[128]={0};
    int found=0;
    if (record<2 || record>limit) break;
    if (tspice_dafgsr(handle,record,1,128,(unsigned char*)row,sizeof(row),&found,err,cap)) return 1;
    if (!found || row[1]!=previous || !(row[0]>=0 && row[0]<=limit && trunc(row[0])==row[0]) ||
        !(row[2]>=0 && row[2]<=25 && trunc(row[2])==row[2])) break;
    for (int i=0; i<(int)row[2]; ++i) {
      if (memcmp(row+3+5*i,input,40)) continue;
      memcpy(words,input,40);
      double endpoints[2];
      dafus_c(words,2,6,endpoints,integers);
      if (spk_status(err,cap)) return 1;
      if (integers[4]>0 && integers[4]<=integers[5] && integers[5]<fields[4] &&
          isfinite(endpoints[0]) && isfinite(endpoints[1]) && endpoints[0]<=endpoints[1]) return 0;
      return tspice_ephemeris_invalid_arg(err,cap,"Invalid source SPK segment bounds");
    }
    previous=record;
    record=(int)row[0];
  }
  return tspice_ephemeris_invalid_arg(err,cap,"Packed SPK descriptor does not belong to this file");
}

int tspice_spkpvn(int source, int isRegistration, const void *descr, int size, double et,
                  int *ref, double *state6, int *center, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  int handle, fields[6];
  double words[5];
  if (!ref || !state6 || !center || !isfinite(et))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected a finite epoch and SPK result storage");
  if (spk_reader(source,isRegistration,&handle,err,cap) ||
      spk_file_descriptor(handle,descr,size,words,fields,err,cap)) return 1;
  // SPKR08/09/12/13/14/18/19 diagnose out-of-coverage epochs themselves.
  // Other readers extrapolate. Check only the actual record address or f2c
  // integer conversion that would be unsafe for the selected storage layout.
  if (fields[3]==2 || fields[3]==3 || fields[3]==20) {
    const int type=fields[3], tail=type==20 ? 7 : 4;
    if (fields[5]-fields[4]+1<tail)
      return tspice_ephemeris_invalid_arg(err,cap,"Incomplete SPK coefficient segment trailer");
    double controls[7]={0};
    dafgda_c(handle,fields[5]-tail+1,fields[5],controls);
    if (spk_status(err,cap)) return 1;
    const double start=type==20 ? (controls[2]-j2000_c()+controls[3])*spd_c() : controls[0];
    const double step=type==20 ? controls[4]*spd_c() : controls[1];
    const double width=controls[tail-2], count=controls[tail-1];
    const int extent=fields[5]-fields[4]+1-tail;
    if (!(width>=1 && width<=(type==20?195:197) && trunc(width)==width &&
          count>=1 && count<=INT_MAX && trunc(count)==count &&
          width*count==extent && isfinite(start) && isfinite(step) && step>0))
      return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK coefficient record extent");
    const double ordinal=trunc((et-start)/step);
    if (!(ordinal>=INT_MIN && ordinal<=INT_MAX-1) || (type!=20 && ordinal<0))
      return tspice_ephemeris_invalid_arg(err,cap,"Epoch exceeds addressable SPK coefficient records");
  } else if ((fields[3]==1 || fields[3]==21) && et>words[1]) {
    // These readers select the first record endpoint at or above ET. Unlike
    // a DAF descriptor, its last physical record may extend past coverage.
    const int trailer=fields[3]==1 ? 1 : 2;
    double n=0,finalEpoch=0;
    dafgda_c(handle,fields[5],fields[5],&n);
    if (spk_status(err,cap)) return 1;
    if (!(n>=1 && n<=fields[5]-fields[4]+1 && trunc(n)==n))
      return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK difference record count");
    const int addr=fields[5]-(int)n/100-trailer;
    if (addr<fields[4]) return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK epoch directory");
    dafgda_c(handle,addr,addr,&finalEpoch);
    if (spk_status(err,cap)) return 1;
    if (!(et<=finalEpoch)) return tspice_ephemeris_invalid_arg(err,cap,"Epoch exceeds the last SPK difference record");
  } else if (fields[3]==10) {
    // SPKR10 chooses the closest one or two element sets even beyond the
    // descriptor endpoints. Check the selected packets before propagation.
    double record[198]={0};
    spkr10_(&handle,words,&et,record);
    if (spk_status(err,cap)) return 1;
    for (int offset=8; offset<=22; offset+=14) {
      double *elements=record+offset;
      if (!isfinite(elements[9]) || fabs(elements[9])>1.6e14)
        return tspice_ephemeris_invalid_arg(err,cap,"SPK element epoch exceeds signed calendar-day range");
      // Only a resonant orbit uses N0067's unbounded 720-minute loop.
      // ZZINIL computes the corrected mean motion used by the actual driver.
      if (fabs(et-elements[9])>=43200000000.0) {
        int mode=2;
        double epoch=0, ecc=elements[5], incl=elements[3], motion=elements[8], aux[13]={0};
        zzinil_(record,&mode,&ecc,&epoch,&incl,&motion,&aux[0],&aux[1],&aux[2],&aux[3],
                &aux[4],&aux[5],&aux[6],&aux[7],&aux[8],&aux[9],&aux[10],&aux[11],&aux[12]);
        if (spk_status(err,cap)) return 1;
        if ((motion>.0034906585 && motion<.0052359877) ||
            (motion>=.00826 && motion<=.00924 && ecc>=.5)) {
          // Preserve initialization errors (including missing leap seconds)
          // before imposing the execution-work limit.
          mode=1;
          chkin_c("spkpvn_c"); chkin_c("SPKPVN"); chkin_c("SPKE10");
          xxsgp4i_(record,elements,&mode);
          chkout_c("SPKE10"); chkout_c("SPKPVN"); chkout_c("spkpvn_c");
          if (spk_status(err,cap)) return 1;
          return tspice_ephemeris_invalid_arg(err,cap,"SPK resonant interval reaches one million integration steps");
        }
      }
      if (record[17]==record[31]) break;
    }
  }
  spkpvn_c(handle,words,et,ref,state6,center);
  return spk_status(err,cap);
}

int tspice_spksub(int source, int isRegistration, const void *descr, int size, const char *ident,
                  double begin, double end, int writer, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  int handle, fields[6];
  double words[5];
  if (!ident || !isfinite(begin) || !isfinite(end))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected a segment ID and finite subset epochs");
  if (spk_reader(source,isRegistration,&handle,err,cap) ||
      spk_file_descriptor(handle,descr,size,words,fields,err,cap)) return 1;
  if (handle==writer) return tspice_ephemeris_invalid_arg(err,cap,"An SPK subset requires a separate writer");
  // Authenticate the write-mode handle even for direct native callers.
  dafsih_(&writer,"WRITE",5);
  if (spk_status(err,cap)) return 1;
  char idword[8], ifname[60];
  int nd=0, ni=0, fward=0, bward=0, freeAddress=0, found=0;
  zzdafgfr_(&writer,idword,&nd,&ni,ifname,&fward,&bward,&freeAddress,&found,8,60);
  if (spk_status(err,cap)) return 1;
  if (!found || nd!=2 || ni!=6 ||
      (memcmp(idword,"DAF/",4)==0 && memcmp(idword,"DAF/SPK ",8)!=0))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected an SPK subset writer");
  spksub_c(handle,words,ident,begin,end,writer);
  return spk_status(err,cap);
}

int tspice_spksfs(
    int body,
    double et,
    int *outHandle,
    int *outGeneration,
    double *outDescr5,
    char *outIdent,
    int outIdentMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outHandle) {
    *outHandle = 0;
  }
  if (outIdentMaxBytes > 0 && outIdent) {
    outIdent[0] = '\0';
  }
  if (outDescr5) {
    for (int i = 0; i < 5; i++) {
      outDescr5[i] = 0.0;
    }
  }

  if (outIdentMaxBytes > 0 && !outIdent) {
    return tspice_ephemeris_invalid_arg(
        err,
        errMaxBytes,
        "tspice_spksfs(): outIdent must not be NULL when outIdentMaxBytes > 0");
  }

  // NAIF SIDLEN is 40 characters (excluding NUL).
  // Caller must provide SIDLEN+1 bytes.
  const int kMinIdentBytes = 41;
  if (outIdentMaxBytes < kMinIdentBytes) {
    return tspice_ephemeris_invalid_arg(
        err,
        errMaxBytes,
        "tspice_spksfs(): outIdentMaxBytes must be >= 41 (SIDLEN+1) to avoid truncation");
  }

  SpiceInt b = 0;
  if (tspice_int_to_spice_int_checked(body, &b, "tspice_spksfs()", err, errMaxBytes) != 0) return 1;

  SpiceInt handle = 0;
  SpiceDouble descr[5];
  SpiceBoolean found = SPICEFALSE;

  spksfs_c(b, (SpiceDouble)et, (SpiceInt)outIdentMaxBytes, &handle, descr, outIdent, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = found ? 1 : 0;
  }

  if (!found) {
    return 0;
  }

  if (!outGeneration || spk_generation(handle,outGeneration,err,errMaxBytes)) return 1;
  if (outHandle) {
    if (tspice_spice_int_to_int_checked(handle, outHandle, "tspice_spksfs()", err, errMaxBytes) != 0) {
      return 1;
    }
  }

  if (outDescr5) {
    outDescr5[0] = (double)descr[0];
    outDescr5[1] = (double)descr[1];
    outDescr5[2] = (double)descr[2];
    outDescr5[3] = (double)descr[3];
    outDescr5[4] = (double)descr[4];
  }

  // `outIdent` is already filled.
  return 0;
}

int tspice_spkpds(
    int body,
    int center,
    const char *frame,
    int type,
    double first,
    double last,
    double *outDescr5,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDescr5) {
    for (int i = 0; i < 5; i++) {
      outDescr5[i] = 0.0;
    }
  }

  SpiceInt b = 0;
  SpiceInt c = 0;
  SpiceInt t = 0;
  if (tspice_int_to_spice_int_checked(body, &b, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(center, &c, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(type, &t, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;

  SpiceDouble descr[5];
  spkpds_c(b, c, frame, t, (SpiceDouble)first, (SpiceDouble)last, descr);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDescr5) {
    outDescr5[0] = (double)descr[0];
    outDescr5[1] = (double)descr[1];
    outDescr5[2] = (double)descr[2];
    outDescr5[3] = (double)descr[3];
    outDescr5[4] = (double)descr[4];
  }

  return 0;
}

int tspice_spkuds(
    const double *descr5,
    int *outBody,
    int *outCenter,
    int *outFrame,
    int *outType,
    double *outFirst,
    double *outLast,
    int *outBaddr,
    int *outEaddr,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!descr5) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkuds(): descr5 must not be NULL");
  }

  SpiceInt body = 0;
  SpiceInt center = 0;
  SpiceInt frame = 0;
  SpiceInt type = 0;
  SpiceDouble first = 0.0;
  SpiceDouble last = 0.0;
  SpiceInt baddrs = 0;
  SpiceInt eaddrs = 0;

  spkuds_c((ConstSpiceDouble *)descr5, &body, &center, &frame, &type, &first, &last, &baddrs, &eaddrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outBody) {
    if (tspice_spice_int_to_int_checked(body, outBody, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outCenter) {
    if (tspice_spice_int_to_int_checked(center, outCenter, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outFrame) {
    if (tspice_spice_int_to_int_checked(frame, outFrame, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outType) {
    if (tspice_spice_int_to_int_checked(type, outType, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outFirst) {
    *outFirst = (double)first;
  }
  if (outLast) {
    *outLast = (double)last;
  }
  if (outBaddr) {
    if (tspice_spice_int_to_int_checked(baddrs, outBaddr, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outEaddr) {
    if (tspice_spice_int_to_int_checked(eaddrs, outEaddr, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }

  return 0;
}

// --- SPK writers ------------------------------------------------------------

int tspice_spkopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): path must be a non-empty string");
  }
  if (!ifname) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): ifname must not be NULL");
  }
  if (!outHandle) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): outHandle must not be NULL");
  }

  SpiceInt ncomchC = 0;
  if (tspice_int_to_spice_int_checked(ncomch, &ncomchC, "tspice_spkopn(ncomch)", err, errMaxBytes) != 0) return 1;

  SpiceInt handleC = 0;
  spkopn_c(path, ifname, ncomchC, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_spice_int_to_int_checked(handleC, outHandle, "tspice_spkopn(outHandle)", err, errMaxBytes) != 0) return 1;
  return 0;
}

int tspice_spkopa(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopa(): path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopa(): outHandle must not be NULL");
  }

  SpiceInt handleC = 0;
  spkopa_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_spice_int_to_int_checked(handleC, outHandle, "tspice_spkopa(outHandle)", err, errMaxBytes) != 0) return 1;
  return 0;
}

// SGSEQW has 20 generic writer slots per CSPICE instance. The Node addon holds
// its CSPICE mutex across every access. WASM has a separate table per module.
typedef struct {
  int used, handle, width;
  int64_t packets;
  int start;
} Spk14Stream;
static Spk14Stream spk14_streams[20];
static int spk14_last_handle;
static Spk14Stream* spk14_slot(int handle) {
  for (int i = 0; i < 20; i++)
    if (spk14_streams[i].used && spk14_streams[i].handle == handle) return &spk14_streams[i];
  return NULL;
}
static int spk14_count(void) {
  int n = 0;
  for (int i = 0; i < 20; i++)
    if (spk14_streams[i].used) n++;
  return n;
}
static int stream_problem(char* err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, cap);
  return 1;
}
static int spk14_unfinished(int handle, char* err, int cap) {
  return spk14_slot(handle) ? tspice_ephemeris_invalid_arg(
                                  err, cap, "Complete the active type 14 segment with spk14e first")
                            : 0;
}

// Type 10 and 14 both use the same SGSEQW table. SGBWFS overwrites its
// saved index during certain failed lookups. Protect live entries while
// allowing a complete type 10 segment to be written to a different file.
static int generic_begin_guard(int handle, const char* id, int streaming, char* err, int cap) {
  int active = spk14_count();
  if (!active) return 0;
  if (spk14_slot(handle)) {
    if (streaming && handle == spk14_last_handle) return 0;  // canonical duplicate-begin diagnostic
    return tspice_ephemeris_invalid_arg(err, cap,
                                        "Finish the active type 14 segment with spk14e first");
  }
  size_t length = strlen(id);
  while (length && id[length - 1] == ' ') --length;
  if (length > 40)
    return tspice_ephemeris_invalid_arg(
        err, cap, "Invalid generic segment ID while a type 14 writer is active");
  for (size_t i = 0; i < length; i++)
    if ((unsigned char)id[i] < 32 || (unsigned char)id[i] > 126)
      return tspice_ephemeris_invalid_arg(
          err, cap, "Invalid generic segment ID while a type 14 writer is active");
  if (active == 20)
    return tspice_ephemeris_invalid_arg(err, cap, "All generic writer slots are active");
  return 0;
}
int tspice_spkcls(int handle, char *err, int errMaxBytes) {
  if(spk14_unfinished(handle,err,errMaxBytes))return 1;
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt handleC = 0;
  if (tspice_int_to_spice_int_checked(handle, &handleC, "tspice_spkcls(handle)", err, errMaxBytes) != 0) return 1;

  spkcls_c(handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkw08(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes) {
  // v1 entrypoint: best-effort dispatch through v2 with an inferred flat length.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if (expectedStates6nLen > 2147483647LL) {
    // Keep the ABI stable: validate before casting down to int.
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08(): inferred states6nLen would overflow int");
  }
  return tspice_spkw08_v2(
      handle,
      body,
      center,
      frame,
      first,
      last,
      segid,
      degree,
      n,
      states6n,
      (int)expectedStates6nLen,
      epoch1,
      step,
      err,
      errMaxBytes);
}

int tspice_spkw08_v2(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    int states6nLen,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes) {
  if(spk14_unfinished(handle,err,errMaxBytes))return 1;
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!frame) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): frame must not be NULL");
  }
  if (!segid) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): segid must not be NULL");
  }
  if (n <= 0) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): n must be > 0");
  }
  if (!states6n) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): states6n must not be NULL");
  }

  // Validate the flat input length before casting to `SpiceDouble[n][6]`.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if ((int64_t)states6nLen != expectedStates6nLen) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): states6nLen must equal 6*n");
  }

  SpiceInt handleC = 0;
  SpiceInt bodyC = 0;
  SpiceInt centerC = 0;
  SpiceInt degreeC = 0;
  SpiceInt nC = 0;

  if (tspice_int_to_spice_int_checked(handle, &handleC, "tspice_spkw08_v2(handle)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(body, &bodyC, "tspice_spkw08_v2(body)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(center, &centerC, "tspice_spkw08_v2(center)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(degree, &degreeC, "tspice_spkw08_v2(degree)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(n, &nC, "tspice_spkw08_v2(n)", err, errMaxBytes) != 0) return 1;

  // Interpret `states6n` as an array of `n` 6-vectors.
  const SpiceDouble(*states)[6] = (const SpiceDouble(*)[6])states6n;

  spkw08_c(
      handleC,
      bodyC,
      centerC,
      frame,
      (SpiceDouble)first,
      (SpiceDouble)last,
      segid,
      degreeC,
      nC,
      states,
      (SpiceDouble)epoch1,
      (SpiceDouble)step);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

// N0067 checks count and polynomial degree before reading coefficients.
// Invalid count/degree calls use an addressable sentinel for their SPICE errors.
static int check_chebyshev_buffer(int type, int n, int degree, const double* data, int words,
                                  const char* frame, const char* segid, char* err, int cap) {
  if (!data || !frame || !segid || words < 0 || words > 33554432)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid Chebyshev input buffer");
  if (n > 0 && degree >= 0 && degree <= (type == 20 ? 50 : 27)) {
    int stride = (type == 3 ? 6 : 3) * (degree + (type == 20 ? 2 : 1));
    if ((int64_t)n * stride != words)
      return tspice_ephemeris_invalid_arg(
          err, cap, "Chebyshev coefficient length does not match record dimensions");
    for (int i = 0; i < words; ++i) {
      if (!isfinite(data[i]))
        return tspice_ephemeris_invalid_arg(err, cap, "Chebyshev coefficients must be finite");
    }
  }
  return 0;
}

int tspice_spkw02(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, double intlen, int n, int degree, const double* cdata,
                  int words, double btime, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (check_chebyshev_buffer(2, n, degree, cdata, words, frame, segid, err, cap)) return 1;
  spkw02_c(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, btime);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw03(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, double intlen, int n, int degree, const double* cdata,
                  int words, double btime, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (check_chebyshev_buffer(3, n, degree, cdata, words, frame, segid, err, cap)) return 1;
  spkw03_c(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, btime);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw20(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, double intlen, int n, int degree, const double* cdata,
                  int words, double dscale, double tscale, double initjd, double initfr, char* err,
                  int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (check_chebyshev_buffer(20, n, degree, cdata, words, frame, segid, err, cap)) return 1;
  spkw20_c(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, dscale,
           tscale, initjd, initfr);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

// The type 12, 13 and 18 routines form degree+1 before validating degree.
// Only canonical paths with dimensionally complete data may read the buffers.
static int check_interpolation_storage(int type, int subtype, int degree, int n,
                                       const double* samples, int words, const double* epochs,
                                       int epochCount, char* err, int cap) {
  if (!samples || !epochs || n < 0 || words < 0 || words > 33554432 || epochCount < 0 ||
      epochCount > 33554432)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid interpolation buffer");
  if (type == 18 && subtype != 0 && subtype != 1) return 0;
  if (type != 9 && degree == INT32_MAX)
    return tspice_ephemeris_invalid_arg(err, cap, "Degree exceeds defined N0067 window arithmetic");
  int stride = type == 18 && subtype == 0 ? 12 : 6;
  if ((int64_t)n * stride != words || (type != 12 && epochCount != n))
    return tspice_ephemeris_invalid_arg(err, cap, "Incomplete interpolation state or epoch buffer");
  for (int i = 0; i < words; ++i)
    if (!isfinite(samples[i]))
      return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite SPK sample");
  for (int i = 0; i < epochCount; ++i)
    if (!isfinite(epochs[i])) return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite SPK epoch");
  return 0;
}

int tspice_spkw09(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int degree, int n, const double* samples, int sampleWords,
                  const double* epochs, int epochCount, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(9, 1, degree, n, samples, sampleWords, epochs, epochCount, err,
                                  cap))
    return 1;
  spkw09_c(handle, body, center, frame, first, last, segid, degree, n,
           (const SpiceDouble(*)[6])samples, epochs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw12(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int degree, int n, const double* samples, int sampleWords,
                  double epoch0, double step, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last) || !isfinite(epoch0) ||
      !isfinite(step))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(12, 1, degree, n, samples, sampleWords, samples, 0, err, cap))
    return 1;
  spkw12_c(handle, body, center, frame, first, last, segid, degree, n,
           (const SpiceDouble(*)[6])samples, epoch0, step);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw13(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int degree, int n, const double* samples, int sampleWords,
                  const double* epochs, int epochCount, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(13, 1, degree, n, samples, sampleWords, epochs, epochCount, err,
                                  cap))
    return 1;
  spkw13_c(handle, body, center, frame, first, last, segid, degree, n,
           (const SpiceDouble(*)[6])samples, epochs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw18(int handle, int subtype, int body, int center, const char* frame, double first,
                  double last, const char* segid, int degree, int n, const double* samples,
                  int sampleWords, const double* epochs, int epochCount, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(18, subtype, degree, n, samples, sampleWords, epochs, epochCount,
                                  err, cap))
    return 1;
  spkw18_c(handle, (SpiceSPK18Subtype)subtype, body, center, frame, first, last, segid, degree, n,
           samples, epochs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

// The packed transport is limited to 256 MiB on both backends. Slice offsets
// below are reached only after proving the complete physical dimensions.
static int check_analytic_spk(int type, int n, const double* data, int words, char* err, int cap) {
  int64_t required = type == 5    ? 1 + 7 * (int64_t)n
                     : type == 10 ? 8 + 11 * (int64_t)n
                     : type == 15 ? 16
                                  : 12;
  if (!data || n < 0 || words < 0 || words > 33554432 || required != words ||
      ((type == 15 || type == 17) && n != 1))
    return tspice_ephemeris_invalid_arg(err, cap, "Incomplete analytic SPK data");
  for (int i = 0; i < words; ++i)
    if (!isfinite(data[i]))
      return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite analytic SPK data");
  if (type == 10) {
    const double* epochs = data + 8 + 10 * (int64_t)n;
    for (int i = 1; i < n; ++i)
      if (epochs[i - 1] >= epochs[i])
        return tspice_ephemeris_invalid_arg(
            err, cap, "Type 10 epochs must increase before opening a generic segment");
  }
  if (type == 15 && (trunc(data[9]) < (double)INT32_MIN || trunc(data[9]) > (double)INT32_MAX))
    return tspice_ephemeris_invalid_arg(err, cap,
                                        "Type 15 J2 flag exceeds signed evaluation range");
  return 0;
}

int tspice_spkw05(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(5, n, data, words, err, cap)) return 1;
  spkw05_c(handle, body, center, frame, first, last, segid, data[0], n,
           (const SpiceDouble(*)[6])(data + 1), data + 1 + 6 * n);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw10(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(10, n, data, words, err, cap)) return 1;
  if (generic_begin_guard(handle, segid, 0, err, cap)) return 1;
  // A descriptor error can happen before the generic writer is touched.
  // Conservatively clear the optional same-handle shortcut in either case.
  if (spk14_count()) spk14_last_handle = 0;
  spkw10_c(handle, body, center, frame, first, last, segid, data, n, data + 8, data + 8 + 10 * n);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw15(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(15, n, data, words, err, cap)) return 1;
  spkw15_c(handle, body, center, frame, first, last, segid, data[0], data + 1, data + 4, data[7],
           data[8], data[9], data + 10, data[13], data[14], data[15]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw17(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(17, n, data, words, err, cap)) return 1;
  spkw17_c(handle, body, center, frame, first, last, segid, data[0], data + 1, data[10], data[11]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spk14b(int handle, const char* segid, int body, int center, const char* frame,
                  double first, double last, int degree, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!segid || !frame || !isfinite(first) || !isfinite(last) || degree > 357913939)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid type 14 descriptor or record width");
  if (generic_begin_guard(handle, segid, 1, err, cap)) return 1;
  int start = 0;
  if (degree >= 0 && frame[0] && segid[0]) {
    SpiceInt nd, ni, forward, back, freeAddress;
    char name[2];
    dafrfr_c(handle, sizeof(name), &nd, &ni, name, &forward, &back, &freeAddress);
    if (stream_problem(err, cap)) return 1;
    start = freeAddress;
  }
  spk14b_c(handle, segid, body, center, frame, first, last, degree);
  if (stream_problem(err, cap)) return 1;
  spk14_last_handle = handle;
  for (int i = 0; i < 20; i++)
    if (!spk14_streams[i].used) {
      spk14_streams[i] = (Spk14Stream){1, handle, 2 + 6 * (degree + 1), 0, start};
      return 0;
    }
  return tspice_ephemeris_invalid_arg(err, cap, "Missing type 14 slot after begin");
}

int tspice_spk14a(int handle, int count, const double* records, int words, const double* epochs,
                  int nEpochs, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!records || !epochs || words < 0 || nEpochs < 0 || (int64_t)words + nEpochs > 33554432)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid type 14 packet buffers");
  Spk14Stream* stream = spk14_slot(handle);
  if (count > 0 && !stream && spk14_count())
    return tspice_ephemeris_invalid_arg(err, cap, "No active type 14 segment for this writer");
  if (stream && count > 0) {
    if ((int64_t)stream->width * count != words || nEpochs != count)
      return tspice_ephemeris_invalid_arg(err, cap, "Incomplete type 14 record or epoch buffer");
    int64_t total = stream->packets + count;
    // Include the leading constant, an explicit reference and its duplicate directory,
    // every hundredth reference, the 17 metadata words and signed intermediate offsets.
    if ((int64_t)stream->start + 256 + total * (stream->width + 2LL) + total / 100 + 20 > INT32_MAX)
      return tspice_ephemeris_invalid_arg(err, cap, "Type 14 segment exceeds signed DAF indexing");
    for (int i = 0; i < words; ++i)
      if (!isfinite(records[i]))
        return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite type 14 packet word");
    for (int i = 0; i < nEpochs; ++i)
      if (!isfinite(epochs[i]))
        return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite type 14 epoch");
    // A batch writer on another file can change the current DAF array without
    // changing SGSEQW's cached handle. Select this active physical array again.
    SpiceInt file = handle;
    dafcad_(&file);
    if (stream_problem(err, cap)) return 1;
  }
  if (stream && count > 0) spk14_last_handle = handle;
  spk14a_c(handle, count, records, epochs);
  if (stream_problem(err, cap)) return 1;
  if (stream) stream->packets += count;
  return 0;
}

int tspice_spk14e(int handle, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  Spk14Stream* stream = spk14_slot(handle);
  if (!stream && spk14_count())
    return tspice_ephemeris_invalid_arg(err, cap, "No active type 14 segment for this writer");
  if (stream) {
    SpiceInt file = handle;
    dafcad_(&file);
    if (stream_problem(err, cap)) return 1;
  }
  if (stream) spk14_last_handle = handle;
  spk14e_c(handle);
  if (stream_problem(err, cap)) return 1;
  if (stream) stream->used = 0;
  return 0;
}

// Disposal finishes only a segment actually held by this writable DAF.
int tspice_spk14_finish_if_active(int handle, char* err, int cap) {
  return spk14_slot(handle) ? tspice_spk14e(handle, err, cap) : 0;
}
