#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "../handle_validation.h"

#include <stddef.h>
#include <stdio.h>
#include <string.h>

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
