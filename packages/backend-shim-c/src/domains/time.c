#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceZfc.h"

#include <limits.h>
#include <math.h>
#include <stdio.h>

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#define TSPICE_TIMDEF_VALUE_MAX 1024

static int tspice_time_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // This module provides a stable C ABI surface.
  //
  // If callers pass invalid pointers/lengths, we must not invoke CSPICE with
  // arguments that could cause undefined behavior.
  //
  // Also, clear any previous structured SPICE error fields so higher-level
  // callers (e.g. the Node addon) don't accidentally attach stale `spiceShort`
  // / `spiceLong` / `spiceTrace` fields to these non-CSPICE validation errors.
  //
  // NOTE: Avoid resetting CSPICE error status here. Invalid-arg errors are not
  // CSPICE failures and should not wipe unrelated global SPICE error state.
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

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_tkvrsn_toolkit(): outMaxBytes must be > 0");
  }

  if (outMaxBytes > 0 && !out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_tkvrsn_toolkit(): out must not be NULL when outMaxBytes > 0");
  }

  const char *version = tkvrsn_c("TOOLKIT");
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  size_t maxPayload = (size_t)outMaxBytes - 1;
  size_t n = strlen(version);
  if (n > maxPayload) {
    n = maxPayload;
  }

  memcpy(out, version, n);
  out[n] = '\0';
  return 0;
}

int tspice_str2et(const char *time, double *outEt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!time) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_str2et(): time must not be NULL");
  }

  if (time[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_str2et(): time must be non-empty");
  }

  SpiceDouble et = 0.0;
  str2et_c(time, &et);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_et2utc(
    double et,
    const char *format,
    int prec,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_et2utc(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_et2utc(): out must not be NULL when outMaxBytes > 0");
  }
  if (!format) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_et2utc(): format must not be NULL");
  }

  et2utc_c((SpiceDouble)et, format, (SpiceInt)prec, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_timout(
    double et,
    const char *picture,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timout(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_timout(): out must not be NULL when outMaxBytes > 0");
  }
  if (!picture) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timout(): picture must not be NULL");
  }

  timout_c((SpiceDouble)et, picture, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_deltet(double epoch, const char *eptype, double *outDelta, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDelta) {
    *outDelta = 0.0;
  }

  if (!eptype) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_deltet(): eptype must not be NULL");
  }

  SpiceDouble delta = 0.0;
  deltet_c((SpiceDouble)epoch, eptype, &delta);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDelta) {
    *outDelta = (double)delta;
  }

  return 0;
}

int tspice_unitim(
    double epoch,
    const char *insys,
    const char *outsys,
    double *outEpoch,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEpoch) {
    *outEpoch = 0.0;
  }

  if (!insys) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_unitim(): insys must not be NULL");
  }
  if (!outsys) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_unitim(): outsys must not be NULL");
  }

  const SpiceDouble out = unitim_c((SpiceDouble)epoch, insys, outsys);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEpoch) {
    *outEpoch = (double)out;
  }

  return 0;
}

int tspice_tparse(const char *timstr, double *outEt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  if (!timstr) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tparse(): timstr must not be NULL");
  }

  if (timstr[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tparse(): timstr must be non-empty");
  }

  SpiceDouble et = 0.0;
  SpiceChar errmsg[2048];
  errmsg[0] = '\0';

  tparse_c(timstr, (SpiceInt)sizeof(errmsg), &et, errmsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // `tparse_c` reports parse failures via `errmsg` (without signaling a SPICE error).
  // Treat these as hard errors so JS can throw.
  if (errmsg[0] != '\0') {
    if (err && errMaxBytes > 0) {
      strncpy(err, errmsg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    // Parse errors are not CSPICE errors; clear our structured last-error buffers
    // so stale `spiceShort` / `spiceLong` / `spiceTrace` don't leak.
    tspice_clear_last_error_buffers();
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_tpictr(
    const char *sample,
    const char *picturIn,
    char *outPictur,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (outPictur && outMaxBytes > 0) {
    outPictur[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tpictr(): outMaxBytes must be > 0");
  }
  if (!outPictur) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_tpictr(): outPictur must not be NULL when outMaxBytes > 0");
  }
  if (!sample) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tpictr(): sample must not be NULL");
  }

  SpiceInt pictln = (SpiceInt)outMaxBytes;

  // Some higher-level bindings model CSPICE string outputs by accepting an
  // "output template" string. For parity we copy `picturIn` into the output
  // buffer before calling CSPICE, but we do NOT let the template's length
  // reduce `pictln`: in CSPICE `pictln` is the capacity of `pictur`.
  if (picturIn) {
    strncpy(outPictur, picturIn, (size_t)outMaxBytes - 1);
    outPictur[outMaxBytes - 1] = '\0';
  }

  SpiceBoolean ok = SPICETRUE;
  SpiceChar errmsg[2048];
  errmsg[0] = '\0';

  tpictr_c(sample, pictln, (SpiceInt)sizeof(errmsg), outPictur, &ok, errmsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // `tpictr_c` reports problems via `ok`/`errmsg` (without signaling a SPICE error).
  if (ok != SPICETRUE) {
    if (err && errMaxBytes > 0) {
      strncpy(err, errmsg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    // Non-CSPICE errors: clear our structured last-error buffers.
    tspice_clear_last_error_buffers();
    return 1;
  }

  return 0;
}


int tspice_timdef_get(
    const char *item,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_get(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_timdef_get(): out must not be NULL when outMaxBytes > 0");
  }

  if (!item) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_get(): item must not be NULL");
  }

  if (item[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_get(): item must be non-empty");
  }

  timdef_c("GET", item, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}


int tspice_timdef_set(const char *item, const char *value, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!item) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): item must not be NULL");
  }
  if (item[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): item must be non-empty");
  }

  if (!value) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): value must not be NULL");
  }
  if (value[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): value must be non-empty");
  }

  const size_t valueLen = strlen(value);
  if (valueLen >= (size_t)TSPICE_TIMDEF_VALUE_MAX) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): value too long");
  }

  SpiceChar buf[TSPICE_TIMDEF_VALUE_MAX];
  memcpy(buf, value, valueLen);
  buf[valueLen] = '\0';

  timdef_c("SET", item, (SpiceInt)(valueLen + 1), buf);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_scs2e(
    int sc,
    const char *sclkch,
    double *outEt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  if (!sclkch) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_scs2e(): sclkch must not be NULL");
  }

  SpiceDouble et = 0.0;
  scs2e_c((SpiceInt)sc, sclkch, &et);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_sce2s(
    int sc,
    double et,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_sce2s(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_sce2s(): out must not be NULL when outMaxBytes > 0");
  }

  sce2s_c((SpiceInt)sc, (SpiceDouble)et, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_scencd(
    int sc,
    const char *sclkch,
    double *outSclkdp,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSclkdp) {
    *outSclkdp = 0.0;
  }

  if (!sclkch) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_scencd(): sclkch must not be NULL");
  }

  SpiceDouble sclkdp = 0.0;
  scencd_c((SpiceInt)sc, sclkch, &sclkdp);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSclkdp) {
    *outSclkdp = (double)sclkdp;
  }

  return 0;
}

int tspice_scdecd(
    int sc,
    double sclkdp,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_scdecd(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_scdecd(): out must not be NULL when outMaxBytes > 0");
  }

  scdecd_c((SpiceInt)sc, (SpiceDouble)sclkdp, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_sct2e(int sc, double sclkdp, double *outEt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  SpiceDouble et = 0.0;
  sct2e_c((SpiceInt)sc, (SpiceDouble)sclkdp, &et);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_sce2c(int sc, double et, double *outSclkdp, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSclkdp) {
    *outSclkdp = 0.0;
  }

  SpiceDouble sclkdp = 0.0;
  sce2c_c((SpiceInt)sc, (SpiceDouble)et, &sclkdp);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSclkdp) {
    *outSclkdp = (double)sclkdp;
  }

  return 0;
}

static int time_result(char *err, int errMaxBytes) {
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_etcal(double et, int callen, char *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!isfinite(et) || !out)
    return tspice_time_invalid_arg(err, errMaxBytes, "etcal requires finite ET and output storage");
  const int capacity = callen > 181 ? 181 : callen;
  memset(out, 0, capacity > 0 ? (size_t)capacity : 1);
  etcal_c(et, capacity, out);
  return time_result(err, errMaxBytes);
}

int tspice_tparch(const char *type, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!type || strlen(type) >= INT_MAX)
    return tspice_time_invalid_arg(err, errMaxBytes, "Invalid tparch string");
  tparch_c(type);
  return time_result(err, errMaxBytes);
}

int tspice_tsetyr(int year, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  // All 100 possible expanded years must fit the year*367 intermediate of TPARSE.
  if (year > INT_MAX / 367 - 99)
    return tspice_time_invalid_arg(err, errMaxBytes,
                                   "tsetyr window exceeds the calendar integer range");
  tsetyr_c(year);
  return time_result(err, errMaxBytes);
}

static int fits_spice_int(double value) { return value >= INT_MIN && value <= INT_MAX; }

// Check only the signed intermediates of TTRANS. The canonical routine still
// parses the string, applies its configured checking mode, and computes ET.
static int calendar_day(integer year, double monthValue, double dayValue, double *daynum) {
  const double month = trunc(monthValue), day = trunc(dayValue);
  if (!fits_spice_int(month - 1) || !fits_spice_int(day))
    return 0;
  const double yearShift = floor((month - 1) / 12);
  double y = year + yearShift;
  if (!fits_spice_int(y))
    return 0;
  const int m = (int)(month - 1 - yearShift * 12);
  double offset = 0;
  if (y <= 0) {
    const double cycles = floor((y - 1) / 400);
    offset = cycles * 146097;
    if (!fits_spice_int(offset))
      return 0;
    y -= cycles * 400;
  }
  const int yearInCycle = (int)y;
  const int leap = yearInCycle % 4 == 0 && (yearInCycle % 100 != 0 || yearInCycle % 400 == 0);
  static const int daysBefore[] = {0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334};
  const double dayInYear = daysBefore[m] + (m >= 2 ? leap : 0) + day;
  const double previous = y - 1;
  const double first = previous * 365 + floor(previous / 4);
  const double local = first - floor(previous / 100) + floor(previous / 400) + dayInYear;
  *daynum = local - 1 + offset;
  return fits_spice_int(first) && fits_spice_int(dayInYear) && fits_spice_int(local) &&
         fits_spice_int(local - 1) && fits_spice_int(*daynum);
}

// TTRANS loads at most 140 leap transitions and later subtracts a selected
// reference day using SpiceInt. Use the same reference/transition ordering;
// arbitrary programmatic pool edits can contain much larger values than an LSK.
static int utc_day_is_safe(double day, double seconds) {
  integer first = 1, room = 280, count = 0;
  logical found = 0;
  double table[280] = {0};
  gdpool_("DELTET/DELTA_AT", &first, &room, &count, table, &found, 15);
  if (failed_c() || !found)
    return 1;
  if (!count || count % 2 != 0)
    return 0;
  double refs[280], times[280], previous = table[0] - 1;
  for (int i = 0; i < count; i += 2) {
    const double formal = table[i + 1];
    const double days = trunc((formal + 43200.) / 86400.);
    const double ref = days + 730119.;
    if (!fits_spice_int(days) || !fits_spice_int(ref) || !fits_spice_int(ref - 1))
      return 0;
    refs[i] = ref - 1;
    refs[i + 1] = ref;
    times[i] = formal - 86400. + previous;
    times[i + 1] = formal + table[i];
    previous = table[i];
  }
  for (int i = 1; i < count; ++i) {
    if (!isfinite(times[i - 1]) || !isfinite(times[i]))
      return 0;
    if (times[i - 1] >= times[i])
      return 1; // genuine BADLEAPSECONDS precedes conversion
  }
  if (!fits_spice_int(day) || !isfinite(seconds))
    return 0;
  integer n = count, key = (integer)day, intRefs[280];
  for (int i = 0; i < count; ++i)
    intRefs[i] = (integer)refs[i];
  integer p = lstlei_(&key, &n, intRefs);
  int selected = p > 0 ? p - 1 : 0;
  if (!fits_spice_int(day - refs[selected]))
    return 0;
  if (seconds > 86399. || seconds < 0.) {
    double tai = times[selected] + (seconds + (day - refs[selected]) * 86400.);
    p = lstled_(&tai, &n, times);
    if (!(p % 2)) {
      selected = p > 0 ? p - 1 : 0;
      double since = tai - times[selected], spd = 86400., q, rem;
      rmaind_(&since, &spd, &q, &rem);
      if (!fits_spice_int(q) || !fits_spice_int(refs[selected] + q))
        return 0;
      key = (integer)(refs[selected] + q);
      p = lstlei_(&key, &n, intRefs);
      if (!fits_spice_int((double)key - refs[p > 0 ? p - 1 : 0]))
        return 0;
    }
  }
  return 1;
}

static int utc_numbers_defined(const char *utc) {
  double v[10] = {0};
  integer count = 0;
  logical mods = 0, abbreviated = 0, success = 0;
  char type[8], modifiers[40], picture[80], message[480];
  tpartv_((char *)utc, v, &count, type, modifiers, &mods, &abbreviated, &success, picture, message,
          (ftnlen)strlen(utc), 8, 8, 80, 480);
  if (failed_c() || !success)
    return 1;
  if (mods && ((memcmp(modifiers + 32, "        ", 8) && memcmp(modifiers + 32, "UTC     ", 8)) ||
               memcmp(modifiers + 16, "        ", 8) || memcmp(modifiers + 24, "        ", 8)))
    return 1;
  double day = 0, seconds = 0;
  if (!memcmp(type, "JD      ", 8)) {
    double total = (v[0] - 1721425.5) * 86400., spd = 86400.;
    rmaind_(&total, &spd, &day, &seconds);
    return utc_day_is_safe(day, seconds);
  }
  const int ymd = !memcmp(type, "YMD     ", 8);
  if (!ymd && memcmp(type, "YD      ", 8))
    return 1;
  if (!fits_spice_int(round(v[0])))
    return 0;
  integer year = (integer)round(v[0]);
  const int bc = !memcmp(modifiers, "B.C.    ", 8);
  if (bc && !fits_spice_int(1. - year))
    return 0;
  char mode[3];
  tchckd_(mode, 3);
  if (!memcmp(mode, "YES", 3)) {
    if ((bc ? 1. - year : year) == INT_MIN || (ymd && !fits_spice_int(round(v[1]))))
      return 0;
    logical ok = 0;
    tcheck_(v, type, &mods, modifiers, &ok, message, 8, 8, 480);
    if (!ok)
      return 1; // UTC2ET signals the original TCHECK diagnostic.
  }
  if (bc)
    year = 1 - year;
  else if (memcmp(modifiers, "A.D.    ", 8))
    texpyr_(&year);
  const double *clock = v + (ymd ? 3 : 2);
  seconds = clock[0] * 3600. + clock[1] * 60. + clock[2];
  int safe = calendar_day(year, ymd ? v[1] : 1., v[ymd ? 2 : 1], &day);
  // With a missing leap table TTRANS returns NOLEAPSECONDS before day arithmetic.
  return utc_day_is_safe(safe ? day : NAN, seconds);
}

int tspice_utc2et(const char *utc, double *et, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!utc || !et || strlen(utc) >= INT_MAX)
    return tspice_time_invalid_arg(err, errMaxBytes, "Invalid utc2et input or output");
  if (*utc && !failed_c()) {
    chkin_c("utc2et_c");
    chkin_c("UTC2ET");
    int safe = utc_numbers_defined(utc);
    chkout_c("UTC2ET");
    chkout_c("utc2et_c");
    if (failed_c())
      return time_result(err, errMaxBytes);
    if (!safe)
      return tspice_time_invalid_arg(
          err, errMaxBytes,
          "utc2et date or leap table exceeds defined calendar integer arithmetic");
  }
  double value = 0;
  utc2et_c(utc, &value);
  if (failed_c())
    return time_result(err, errMaxBytes);
  *et = value;
  return 0;
}

// ZZBODKER builds the ID hash from paired name/code mappings. N0067
// ZZHASHI takes signed abs(code), which has no representation for INT_MIN.
static int body_mapping_defined(void) {
  SpiceBoolean found = SPICEFALSE;
  SpiceInt names = 0, codes = 0;
  SpiceChar type[2] = {0};
  dtpool_c("NAIF_BODY_NAME", &found, &names, type);
  if (failed_c())
    return 1;
  if (!found || type[0] != 'C' || names > 14983)
    return 1;
  dtpool_c("NAIF_BODY_CODE", &found, &codes, type);
  if (failed_c())
    return 1;
  if (!found || type[0] != 'N' || names != codes)
    return 1;
  int unsafe = 0;
  for (SpiceInt start = 0; start < codes; start += 64) {
    SpiceDouble values[64];
    SpiceInt used = 0;
    gdpool_c("NAIF_BODY_CODE", start, 64, &used, values, &found);
    if (failed_c())
      return 1;
    for (SpiceInt i = 0; i < used; ++i) {
      // GIPOOL validates and rounds all codes before any hashes are built.
      // Let it report its own conversion error, including in a mixed table.
      if (!(values[i] >= (double)INT_MIN && values[i] <= (double)INT_MAX))
        return 1;
      if (values[i] <= (double)INT_MIN + 0.5)
        unsafe = 1;
    }
  }
  if (!unsafe)
    return 1;
  // ZZBODKER also diagnoses blank names (in a 36-byte record) before
  // entering ZZBODINI. Preserve that ordinary error and its traceback.
  for (SpiceInt start = 0; start < names; start += 64) {
    SpiceChar rows[64][37];
    SpiceInt used = 0;
    gcpool_c("NAIF_BODY_NAME", start, 64, 37, &used, rows, &found);
    if (failed_c())
      return 1;
    for (SpiceInt i = 0; i < used; ++i) {
      if (!rows[i][0])
        return 1;
    }
  }
  return 0;
}

// N0067 ET2LST passes private PGRREC and SPKEZ outputs to RECLAT even if
// their producer signaled an error. Preflight those exact calls under their
// original frames; choose the canonical formatting path only after success.
static int local_time_defined(double et, integer body, double lon, const char *type) {
  char system[32];
  ljust_((char *)type, system, (ftnlen)strlen(type), 32);
  ucase_(system, system, 32, 32);
  const int graphic = !memcmp(system, "PLANETOGRAPHIC                  ", 32);
  if (!graphic && memcmp(system, "PLANETOCENTRIC                  ", 32))
    return 1;
  if (!graphic && body == 10)
    return 1; // The Sun at planetocentric longitude needs no body lookup.
  if (!body_mapping_defined())
    return 0;
  if (failed_c())
    return 1;
  if (body == INT_MIN)
    return 0; // BODC2N/CIDFRM use ABS(code) in ZZHASHI.
  double zero = 0., one = 1., range = 0., lat = 0.;
  logical found = 0;
  if (graphic) {
    char name[36] = {0};
    double point[3] = {0};
    bodc2n_(&body, name, &found, 36);
    if (failed_c())
      return 1;
    if (!found)
      intstr_(&body, name, 36);
    pgrrec_(name, &lon, &zero, &zero, &one, &zero, point, 36);
    if (failed_c())
      return 1;
    reclat_(point, &range, &lon, &lat);
  }
  if (body == 10 || failed_c())
    return 1;
  char frame[32] = {0};
  integer id = 0, sun = 10;
  cidfrm_(&body, &id, frame, &found, 32);
  if (failed_c() || !found)
    return 1;
  double state[6] = {0}, lt = 0., solarLon = 0.;
  spkez_(&sun, &et, frame, "LT+S", &body, state, &lt, 32, 4);
  if (failed_c())
    return 1;
  reclat_(state, &range, &solarLon, &lat);
  if (failed_c())
    return 1;
  double angle = lon - solarLon, period = twopi_c(), q = 0., rem = 0.;
  rmaind_(&angle, &period, &q, &rem);
  if (isfinite(rem))
    return 1; // BRCKTD bounds finite values and signed infinities.
  // A missing/incorrect PM keyword signals the scientific error before the
  // potentially non-representable hour/minute/second assignments.
  char pm[32];
  int length = snprintf(pm, sizeof(pm), "BODY%d_PM", (int)body);
  integer count = 0;
  char kind = ' ';
  dtpool_(pm, &found, &count, &kind, length, 1);
  return !found || kind != 'N' || count < 2 || !isnan(rem);
}

int tspice_et2lst(double et, int body, double lon, const char *type, int timlen, int ampmlen,
                  int *hms, char *time, char *ampm, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!hms || !time || !ampm || !type || strlen(type) >= INT_MAX || !isfinite(et) || !isfinite(lon))
    return tspice_time_invalid_arg(err, errMaxBytes, "Invalid et2lst input or output");
  timlen = timlen > 9 ? 9 : timlen;
  ampmlen = ampmlen > 14 ? 14 : ampmlen;
  memset(time, 0, timlen > 0 ? (size_t)timlen : 1);
  memset(ampm, 0, ampmlen > 0 ? (size_t)ampmlen : 1);
  if (!failed_c() && *type && timlen >= 2 && ampmlen >= 2) {
    chkin_c("et2lst_c");
    chkin_c("ET2LST");
    int safe = local_time_defined(et, body, lon, type);
    chkout_c("ET2LST");
    chkout_c("et2lst_c");
    if (failed_c())
      return time_result(err, errMaxBytes);
    if (!safe)
      return tspice_time_invalid_arg(
          err, errMaxBytes, "et2lst exceeds the defined body hash or numerical time range");
  }
  SpiceInt hr = 0, mn = 0, sc = 0;
  et2lst_c(et, body, lon, type, timlen, ampmlen, &hr, &mn, &sc, time, ampm);
  if (failed_c())
    return time_result(err, errMaxBytes);
  hms[0] = hr;
  hms[1] = mn;
  hms[2] = sc;
  return 0;
}
