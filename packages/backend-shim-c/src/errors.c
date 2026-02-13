#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <stdbool.h>
#include <stdatomic.h>
#include <string.h>

static atomic_bool g_initialized = ATOMIC_VAR_INIT(false);

// Last-error storage to allow JS backends (notably WASM) to retrieve structured
// error details without parsing the formatted error string.
//
// NOTE: This is a process-global singleton. In practice, tspice backends ensure
// SPICE calls are serialized (WASM is single-threaded; Node backend uses a
// global mutex), so this is sufficient.
static char g_last_short[1841];
static char g_last_long[1841];
static char g_last_trace[1841];

void tspice_clear_last_error_buffers(void) {
  g_last_short[0] = '\0';
  g_last_long[0] = '\0';
  g_last_trace[0] = '\0';
}

static void tspice_copy_string(char *dst, size_t dstBytes, const char *src) {
  if (dst == NULL || dstBytes == 0) {
    return;
  }
  if (src == NULL) {
    dst[0] = '\0';
    return;
  }
  strncpy(dst, src, dstBytes - 1);
  dst[dstBytes - 1] = '\0';
}

static void tspice_copy_out(char *out, int outMaxBytes, const char *src) {
  if (out == NULL || outMaxBytes <= 0) {
    return;
  }
  tspice_copy_string(out, (size_t)outMaxBytes, src);
}

void tspice_init_cspice_error_handling_once(void) {
  bool expected = false;
  if (!atomic_compare_exchange_strong(&g_initialized, &expected, true)) {
    return;
  }

  // Make sure consumers never see stale structured fields before the first
  // CSPICE error is captured.
  tspice_clear_last_error_buffers();

  // Ensure SPICE routines return control to us so we can surface rich JS errors.
  erract_c("SET", 0, "RETURN");
  // Suppress SPICE printing directly to stdout/stderr.
  errprt_c("SET", 0, "NONE");
}

int tspice_get_last_error_short(char *out, int outMaxBytes) {
  tspice_copy_out(out, outMaxBytes, g_last_short);
  return 0;
}

int tspice_get_last_error_long(char *out, int outMaxBytes) {
  tspice_copy_out(out, outMaxBytes, g_last_long);
  return 0;
}

int tspice_get_last_error_trace(char *out, int outMaxBytes) {
  tspice_copy_out(out, outMaxBytes, g_last_trace);
  return 0;
}

int tspice_get_spice_error_message_and_reset(char *out, int outMaxBytes) {
  // Always attempt to capture last-error fields, even if `out` is null.

  SpiceChar shortMsg[1841];
  SpiceChar longMsg[1841];
  SpiceChar traceMsg[1841];

  shortMsg[0] = '\0';
  longMsg[0] = '\0';
  traceMsg[0] = '\0';

  getmsg_c("SHORT", (SpiceInt)sizeof(shortMsg), shortMsg);
  getmsg_c("LONG", (SpiceInt)sizeof(longMsg), longMsg);
  // `qcktrc_c` returns a printable traceback string (often empty when no trace
  // information is available).
  qcktrc_c((SpiceInt)sizeof(traceMsg), traceMsg);

  tspice_copy_string(g_last_short, sizeof(g_last_short), shortMsg);
  tspice_copy_string(g_last_long, sizeof(g_last_long), longMsg);
  tspice_copy_string(g_last_trace, sizeof(g_last_trace), traceMsg);

  reset_c();

  if (out == NULL || outMaxBytes <= 0) {
    return 0;
  }

  out[0] = '\0';

  const char *sep = "\n";
  const size_t sepLen = strlen(sep);

  size_t shortLen = strlen(shortMsg);
  size_t longLen = strlen(longMsg);
  size_t traceLen = strlen(traceMsg);

  size_t maxPayload = (size_t)outMaxBytes - 1;
  size_t pos = 0;

  if (shortLen > 0) {
    size_t n = shortLen > maxPayload ? maxPayload : shortLen;
    memcpy(out + pos, shortMsg, n);
    pos += n;
  }

  if (pos + sepLen < maxPayload && longLen > 0) {
    memcpy(out + pos, sep, sepLen);
    pos += sepLen;
  }

  if (longLen > 0 && pos < maxPayload) {
    size_t remaining = maxPayload - pos;
    size_t n = longLen > remaining ? remaining : longLen;
    memcpy(out + pos, longMsg, n);
    pos += n;
  }

  // Include a readable trace marker but keep the short message on the first line.
  if (traceLen > 0 && pos + 2 * sepLen + 11 < maxPayload) {
    const char *traceHeader = "\n\nTrace:\n";
    const size_t traceHeaderLen = strlen(traceHeader);
    if (pos + traceHeaderLen < maxPayload) {
      memcpy(out + pos, traceHeader, traceHeaderLen);
      pos += traceHeaderLen;
    }

    if (pos < maxPayload) {
      size_t remaining = maxPayload - pos;
      size_t n = traceLen > remaining ? remaining : traceLen;
      memcpy(out + pos, traceMsg, n);
      pos += n;
    }
  }

  out[pos] = '\0';
  return 0;
}

int tspice_failed(int *outFailed, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outFailed) {
    *outFailed = failed_c() == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_reset(char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  reset_c();

  // `reset_c()` clears the CSPICE error status, but does not clear our
  // process-global structured error buffers.
  //
  // Without this, later non-CSPICE errors can incorrectly pick up stale
  // `spiceShort` / `spiceLong` / `spiceTrace` fields.
  tspice_clear_last_error_buffers();
  return 0;
}

int tspice_getmsg(const char *which, char *out, int outMaxBytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  getmsg_c(which, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_setmsg(const char *message, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  setmsg_c(message);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_sigerr(const char *shortMsg, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  sigerr_c(shortMsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_chkin(const char *name, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  chkin_c(name);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_chkout(const char *name, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  chkout_c(name);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
