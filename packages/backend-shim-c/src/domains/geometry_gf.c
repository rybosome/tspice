#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "../handle_validation.h"
#include "../geometry_names.h"

#include <limits.h>
#include <stdlib.h>
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


typedef struct {
  TspiceGfCallback invoke;
  void *context;
} UserCallbackFrame;

/* The addon serializes toolkit operations. Each WASM instance has its own globals.
 * Save/restore frames for derivatives called inside a predicate. */
static _Thread_local UserCallbackFrame active_callback;
static _Thread_local int user_search_active;

// N0067's built-in solvers share GF state with callback-based searches.
// Reject a nested search before its toolkit code can change that state.
static int reject_nested_search(char *err, int cap) {
  if (!user_search_active) return 0;
  return tspice_geometry_gf_invalid_arg(err, cap, "Nested Geometry Finder searches are not supported by N0067");
}
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
/* Synchronous callbacks finish in the current JS turn. A worker proxy suspends
 * only the active scientific call while the originating client evaluates it. */
EM_JS(int, tspice_host_gf_callback, (int id, int predicate, double t, double *out), {
  return Asyncify.handleSleep(function(wake) {
    var settled = function(value) {
      HEAPF64[out >>> 3] = value;
      wake(Number.isFinite(value) && (!predicate || value === 0 || value === 1) ? 0 : 1);
    };
    try {
      var value = Module['tspiceInvokeGf'](id, predicate, t);
      if (value && typeof value.then === 'function') value.then(settled, function() { settled(NaN); });
      else settled(value);
    } catch (_) { settled(NaN); }
  });
});
#endif

static void invoke_user_value(int predicate, double et, double *out) {
  *out = 0.;
  if (failed_c()) return;
  double value = 0.;
  int status;
#ifdef __EMSCRIPTEN__
  status = tspice_host_gf_callback((int)(uintptr_t)active_callback.context, predicate, et, &value);
#else
  status = active_callback.invoke(active_callback.context, predicate, et, &value);
#endif
  if (status || !isfinite(value) || (predicate && value != 0. && value != 1.)) {
    setmsg_c("The host Geometry Finder callback failed or returned an invalid value.");
    sigerr_c("SPICE(USERCALLBACKFAILED)");
    return;
  }
  *out = value;
}

static void user_scalar(double et, double *out) { invoke_user_value(0, et, out); }
static void user_predicate(void (*scalar)(double, double *), double et, SpiceBoolean *out) {
  /* CSPICE passes the scalar supplied to this search. Host adapters retain that same callable. */
  (void)scalar;
  double value = 0.;
  invoke_user_value(1, et, &value);
  *out = value != 0.;
}

static int end_user_call(UserCallbackFrame previous, char *err, int cap) {
  active_callback = previous;
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, cap);
  return 1;
}

static int valid_user_callback(TspiceGfCallback callback, void *context) {
#ifdef __EMSCRIPTEN__
  return context != NULL;
#else
  return callback != NULL;
#endif
}

int tspice_udf(double et, double initial, double *out, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!out || !isfinite(et) || !isfinite(initial))
    return tspice_geometry_gf_invalid_arg(err, cap, "udf requires a finite epoch and initial value");
  /* The actual dummy routine adds zero to its in/out argument. */
  *out = initial;
  udf_c(et, out);
  return end_user_call(active_callback,err,cap);
}
int tspice_uddc(TspiceGfCallback callback, void *context, double x, double dx, int *out, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!out || !valid_user_callback(callback, context) || !isfinite(x) || !isfinite(dx) || !isfinite(x-dx) || !isfinite(x+dx))
    return tspice_geometry_gf_invalid_arg(err, cap, "uddc requires a scalar callback and finite sample epochs");
  UserCallbackFrame previous = active_callback;
  active_callback = (UserCallbackFrame){callback, context};
  SpiceBoolean result = SPICEFALSE;
  uddc_c(user_scalar, x, dx, &result);
  *out = result != SPICEFALSE;
  return end_user_call(previous, err, cap);
}
int tspice_uddf(TspiceGfCallback callback, void *context, double x, double dx, double *out, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!out || !valid_user_callback(callback, context) || !isfinite(x) || !isfinite(dx) || !isfinite(x-dx) || !isfinite(x+dx))
    return tspice_geometry_gf_invalid_arg(err, cap, "uddf requires a scalar callback and finite sample epochs");
  UserCallbackFrame previous = active_callback;
  active_callback = (UserCallbackFrame){callback, context};
  *out = 0.;
  uddf_c(user_scalar, x, dx, out);
  return end_user_call(previous, err, cap);
}

typedef struct {
  SpiceCell cell;
  void *allocation;
} UserSearchWindow;

static int copy_search_window(SpiceCell *source, UserSearchWindow *copy, int with_data, char *err, int cap) {
  const size_t words = SPICE_CELL_CTRLSZ + (size_t)source->size;
  if (words > (256u * 1024u * 1024u) / sizeof(double))
    return tspice_geometry_gf_invalid_arg(err, cap, "User search window exceeds 256 MiB");
  copy->allocation = calloc(words, sizeof(double));
  if (!copy->allocation) return tspice_geometry_gf_invalid_arg(err, cap, "User search window allocation failed");
  copy->cell = *source;
  copy->cell.base = copy->allocation;
  copy->cell.data = (double *)copy->allocation + SPICE_CELL_CTRLSZ;
  copy->cell.init = SPICEFALSE;
  copy->cell.card = with_data ? source->card : 0;
  if (with_data && source->card) memcpy(copy->cell.data, source->data, (size_t)source->card * sizeof(double));
  return 0;
}

typedef struct {
  UserSearchWindow input;
  UserSearchWindow output;
  uintptr_t destination;
  uint64_t generation;
} UserSearchScope;

static int begin_user_search(uintptr_t input, uintptr_t output, double step,
                             UserSearchScope *scope, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (reject_nested_search(err, cap)) return 1;
  SpiceCell *cnfine = NULL, *result = NULL;
  if (visibility_windows(input, output, step, &cnfine, &result, err, cap)) return 1;
  // Variable-step searches also need finite confinement before the first callback.
  for (SpiceInt i = 0; i < cnfine->card; ++i) {
    if (!isfinite(SPICE_CELL_ELEM_D(cnfine, i)))
      return tspice_geometry_gf_invalid_arg(err, cap, "Nonfinite confinement epoch");
  }
  scope->destination = output;
  scope->generation = tspice_registry_generation(output);
  if (copy_search_window(cnfine, &scope->input, 1, err, cap)) return 1;
  if (copy_search_window(result, &scope->output, 0, err, cap)) {
    free(scope->input.allocation);
    return 1;
  }
  user_search_active = 1;
  return 0;
}

static int finish_user_search(UserSearchScope *scope, int interrupted, char *err, int cap) {
  int status = 0;
  user_search_active = 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    status = 1;
  } else if (!interrupted) {
    if (!scope->generation || tspice_registry_generation(scope->destination) != scope->generation) {
      status = tspice_geometry_gf_invalid_arg(err, cap, "Result window expired during user callback");
    } else {
      copy_c(&scope->output.cell, (SpiceCell *)scope->destination);
      if (failed_c()) {
        tspice_get_spice_error_message_and_reset(err, cap);
        status = 1;
      }
    }
  }
  free(scope->output.allocation);
  free(scope->input.allocation);
  return status;
}

int tspice_gfudb(TspiceGfCallback callback, void *context, double step,
                 uintptr_t input, uintptr_t output, char *err, int cap) {
  if (!valid_user_callback(callback, context))
    return tspice_geometry_gf_invalid_arg(err, cap, "Missing user GF callback");
  UserSearchScope scope = {0};
  if (begin_user_search(input, output, step, &scope, err, cap)) return 1;
  UserCallbackFrame previous = active_callback;
  active_callback = (UserCallbackFrame){callback, context};
  gfudb_c(user_scalar, user_predicate, step, &scope.input.cell, &scope.output.cell);
  active_callback = previous;
  return finish_user_search(&scope, 0, err, cap);
}

int tspice_gfuds(TspiceGfCallback callback, void *context, const char *relate,
                 double refval, double adjust, double step, int count,
                 uintptr_t input, uintptr_t output, char *err, int cap) {
  if (!valid_user_callback(callback, context))
    return tspice_geometry_gf_invalid_arg(err, cap, "Missing user GF callback");
  if (!relate || !isfinite(refval) || !isfinite(adjust))
    return tspice_geometry_gf_invalid_arg(err, cap, "gfuds requires a relation and finite reference and adjustment");
  if (tspice_check_gf_workspace(count, SPICE_GF_NWMAX, "gfuds", err, cap)) return 1;
  UserSearchScope scope = {0};
  if (begin_user_search(input, output, step, &scope, err, cap)) return 1;
  UserCallbackFrame previous = active_callback;
  active_callback = (UserCallbackFrame){callback, context};
  gfuds_c(user_scalar, user_predicate, relate, refval, adjust, step, count,
          &scope.input.cell, &scope.output.cell);
  active_callback = previous;
  return finish_user_search(&scope, 0, err, cap);
}

int tspice_gfoclt(const char *occtyp, const char *front, const char *fshape,
                  const char *fframe, const char *back, const char *bshape,
                  const char *bframe, const char *abcorr, const char *obsrvr,
                  double step, uintptr_t input, uintptr_t output, char *err,
                  int cap) {
  if (reject_nested_search(err, cap)) return 1;
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
  if (reject_nested_search(err, cap)) return 1;
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
  if (reject_nested_search(err, cap)) return 1;
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
  if (reject_nested_search(err, errMaxBytes)) return 1;
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
  if (reject_nested_search(err, errMaxBytes)) return 1;
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
