#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "../handle_validation.h"
#include "../geometry_names.h"

#include <limits.h>
#include <math.h>

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#ifdef __EMSCRIPTEN__
#include <unistd.h>
#endif

static int tspice_geometry_gf_invalid_arg(char *err, int errMaxBytes, const char *msg) {
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
    return tspice_geometry_gf_invalid_arg(
        err,
        errMaxBytes,
        "tspice_int_to_spice_int_checked(): out must be non-null");
  }

  const SpiceInt v = (SpiceInt)value;
  if ((int)v != value) {
    char buf[256];
    snprintf(
        buf,
        sizeof(buf),
        "%s: value out of range for SpiceInt: %d",
        ctx ? ctx : "tspice_int_to_spice_int_checked()",
        value);
    return tspice_geometry_gf_invalid_arg(err, errMaxBytes, buf);
  }
  *out = v;
  return 0;
}

// N0067 doubles nintvls in signed SpiceInt before allocating five cells.
// Bound the complete workspace in wide arithmetic before entering that code.
static int tspice_check_gf_workspace(SpiceInt intervals, uint64_t windows, const char *context, char *err, int errMaxBytes) {
  if (intervals > 0) {
    const uint64_t words = ((uint64_t)intervals * UINT64_C(2) + SPICE_CELL_CTRLSZ) * windows;
    const uint64_t bytes = words * sizeof(SpiceDouble);
    if (bytes > UINT64_C(256) * 1024 * 1024) {
      char message[160];
      snprintf(message, sizeof(message), "%s: workspace exceeds 256 MiB", context);
      return tspice_geometry_gf_invalid_arg(err, errMaxBytes, message);
    }
  }
  // Nonpositive counts retain CSPICE's actual VALUEOUTOFRANGE error.
  return 0;
}

static int tspice_expect_double_window(uintptr_t handle, const char *argName, const char *ctx, SpiceCell **out, char *err, int errMaxBytes) {
  if (!out) {
    return tspice_geometry_gf_invalid_arg(err, errMaxBytes, "tspice_expect_double_window(): out must be non-null");
  }
  *out = NULL;

  SpiceCell *cell = tspice_validate_handle(handle, argName, ctx, err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_DP) {
    char buf[256];
    snprintf(
        buf,
        sizeof(buf),
        "%s: expected %s to be a SPICE_DP SpiceWindow handle",
        ctx ? ctx : "tspice_expect_double_window()",
        argName ? argName : "(arg)");
    return tspice_geometry_gf_invalid_arg(err, errMaxBytes, buf);
  }

  *out = cell;
  return 0;
}

int tspice_gfsstp(double step, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  gfsstp_c((SpiceDouble)step);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_gfstep(double time, double *outStep, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outStep) {
    *outStep = 0.0;
  }

  SpiceDouble step = 0.0;
  gfstep_c((SpiceDouble)time, &step);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outStep) {
    *outStep = (double)step;
  }
  return 0;
}

int tspice_gfstol(double value, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  gfstol_c((SpiceDouble)value);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_gfrefn(
    double t1,
    double t2,
    int s1,
    int s2,
    double *outT,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outT) {
    *outT = 0.0;
  }

  SpiceDouble t = 0.0;
  gfrefn_c(
      (SpiceDouble)t1,
      (SpiceDouble)t2,
      s1 ? SPICETRUE : SPICEFALSE,
      s2 ? SPICETRUE : SPICEFALSE,
      &t);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outT) {
    *outT = (double)t;
  }
  return 0;
}

int tspice_gfrepi(
    uintptr_t windowHandle,
    const char *begmss,
    const char *endmss,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *window = NULL;
  if (tspice_expect_double_window(windowHandle, "window", "tspice_gfrepi(window)", &window, err, errMaxBytes) != 0) {
    return 1;
  }

  gfrepi_c(window, begmss, endmss);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

#ifdef __EMSCRIPTEN__
  // A library module never exits its C runtime, and progress has no newline.
  // Drain libc and the Emscripten TTY so the actual report is observable now.
  if (fflush(stdout) != 0 || fsync(STDOUT_FILENO) != 0) {
    return tspice_geometry_gf_invalid_arg(err, errMaxBytes, "gfrepi: stdout flush failed");
  }
#endif
  return 0;
}

int tspice_gfrepf(char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  gfrepf_c();
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

static int visibility_windows(uintptr_t input, uintptr_t output, double step,
                              SpiceCell **cnfine, SpiceCell **result, char *err,
                              int cap) {
  if (input == output)
    return tspice_geometry_gf_invalid_arg(
        err, cap, "Confinement and result must be distinct windows");
  if (!isfinite(step))
    return tspice_geometry_gf_invalid_arg(err, cap,
                                          "Expected a finite search step");
  if (tspice_expect_double_window(input, "cnfine", "GF search", cnfine, err,
                                  cap) ||
      tspice_expect_double_window(output, "result", "GF search", result, err,
                                  cap))
    return 1;
  // A positive constant step must advance the current floating-point epoch.
  // ZZGFSOLV repeatedly adds it, including at the end of the interval.
  if (step > 0) {
    for (SpiceInt i = 0; i + 1 < (*cnfine)->card; i += 2) {
      const double a = SPICE_CELL_ELEM_D(*cnfine, i),
                   b = SPICE_CELL_ELEM_D(*cnfine, i + 1);
      if (!isfinite(a) || !isfinite(b))
        return tspice_geometry_gf_invalid_arg(err, cap,
                                              "Nonfinite confinement epoch");
      if (a < b &&
          (a + step == a || (nextafter(b, a) + step == nextafter(b, a))))
        return tspice_geometry_gf_invalid_arg(
            err, cap, "Step cannot advance across confinement epochs");
    }
  }
  return 0;
}

static int visibility_text(const char *const *items, size_t n, char *err,
                           int cap) {
  for (size_t i = 0; i < n; i++) {
    if (!items[i] || strlen(items[i]) >= INT_MAX)
      return tspice_geometry_gf_invalid_arg(
          err, cap, "Missing or oversized visibility argument");
  }
  return 0;
}

int tspice_gfoclt(const char *occtyp, const char *front, const char *fshape,
                  const char *fframe, const char *back, const char *bshape,
                  const char *bframe, const char *abcorr, const char *obsrvr,
                  double step, uintptr_t input, uintptr_t output, char *err,
                  int cap) {
  tspice_init_cspice_error_handling_once();
  const char *text[] = {occtyp, front,  fshape, fframe, back,
                        bshape, bframe, abcorr, obsrvr};
  SpiceCell *cnfine = NULL, *result = NULL;
  if (visibility_text(text, 9, err, cap) ||
      visibility_windows(input, output, step, &cnfine, &result, err, cap))
    return 1;
  if (*occtyp && *front && *fshape && *back && *bshape && *abcorr && *obsrvr &&
      step > 0 && result->size >= 2 &&
      tspice_check_body_mapping_codes(err, cap))
    return 1;
  gfoclt_c(occtyp, front, fshape, fframe, back, bshape, bframe, abcorr, obsrvr,
           step, cnfine, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_gfrfov(const char *inst, const double raydir[3], const char *rframe,
                  const char *abcorr, const char *obsrvr, double step,
                  uintptr_t input, uintptr_t output, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  const char *text[] = {inst, rframe, abcorr, obsrvr};
  SpiceCell *cnfine = NULL, *result = NULL;
  if (visibility_text(text, 4, err, cap) ||
      visibility_windows(input, output, step, &cnfine, &result, err, cap))
    return 1;
  if (!raydir || !isfinite(raydir[0]) || !isfinite(raydir[1]) ||
      !isfinite(raydir[2]))
    return tspice_geometry_gf_invalid_arg(err, cap, "Invalid ray direction");
  if (*inst && *rframe && *abcorr && step > 0 && result->size >= 2 &&
      tspice_check_body_mapping_codes(err, cap))
    return 1;
  gfrfov_c(inst, raydir, rframe, abcorr, obsrvr, step, cnfine, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_gftfov(const char *inst, const char *target, const char *tshape,
                  const char *tframe, const char *abcorr, const char *obsrvr,
                  double step, uintptr_t input, uintptr_t output, char *err,
                  int cap) {
  tspice_init_cspice_error_handling_once();
  const char *text[] = {inst, target, tshape, tframe, abcorr, obsrvr};
  SpiceCell *cnfine = NULL, *result = NULL;
  if (visibility_text(text, 6, err, cap) ||
      visibility_windows(input, output, step, &cnfine, &result, err, cap))
    return 1;
  if (*inst && *target && *tshape && *abcorr && *obsrvr &&
      !eqstr_c(tshape, "RAY") && step > 0 && result->size >= 2 &&
      tspice_check_body_mapping_codes(err, cap))
    return 1;
  gftfov_c(inst, target, tshape, tframe, abcorr, obsrvr, step, cnfine, result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_gfsep(
    const char *targ1,
    const char *shape1,
    const char *frame1,
    const char *targ2,
    const char *shape2,
    const char *frame2,
    const char *abcorr,
    const char *obsrvr,
    const char *relate,
    double refval,
    double adjust,
    double step,
    int nintvls,
    uintptr_t cnfineWindowHandle,
    uintptr_t resultWindowHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt nintvlsC = 0;
  if (tspice_int_to_spice_int_checked(nintvls, &nintvlsC, "tspice_gfsep(nintvls)", err, errMaxBytes) != 0) {
    return 1;
  }

  if (tspice_check_gf_workspace(nintvlsC, SPICE_GF_NWSEP, "gfsep", err, errMaxBytes) != 0) return 1;

  SpiceCell *cnfine = NULL;
  if (tspice_expect_double_window(cnfineWindowHandle, "cnfine", "tspice_gfsep(cnfine)", &cnfine, err, errMaxBytes) != 0) {
    return 1;
  }
  SpiceCell *result = NULL;
  if (tspice_expect_double_window(resultWindowHandle, "result", "tspice_gfsep(result)", &result, err, errMaxBytes) != 0) {
    return 1;
  }

  gfsep_c(
      targ1,
      shape1,
      frame1,
      targ2,
      shape2,
      frame2,
      abcorr,
      obsrvr,
      relate,
      (SpiceDouble)refval,
      (SpiceDouble)adjust,
      (SpiceDouble)step,
      nintvlsC,
      cnfine,
      result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_gfdist(
    const char *target,
    const char *abcorr,
    const char *obsrvr,
    const char *relate,
    double refval,
    double adjust,
    double step,
    int nintvls,
    uintptr_t cnfineWindowHandle,
    uintptr_t resultWindowHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt nintvlsC = 0;
  if (tspice_int_to_spice_int_checked(nintvls, &nintvlsC, "tspice_gfdist(nintvls)", err, errMaxBytes) != 0) {
    return 1;
  }

  if (tspice_check_gf_workspace(nintvlsC, SPICE_GF_NWDIST, "gfdist", err, errMaxBytes) != 0) return 1;

  SpiceCell *cnfine = NULL;
  if (tspice_expect_double_window(cnfineWindowHandle, "cnfine", "tspice_gfdist(cnfine)", &cnfine, err, errMaxBytes) != 0) {
    return 1;
  }
  SpiceCell *result = NULL;
  if (tspice_expect_double_window(resultWindowHandle, "result", "tspice_gfdist(result)", &result, err, errMaxBytes) != 0) {
    return 1;
  }

  gfdist_c(
      target,
      abcorr,
      obsrvr,
      relate,
      (SpiceDouble)refval,
      (SpiceDouble)adjust,
      (SpiceDouble)step,
      nintvlsC,
      cnfine,
      result);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
