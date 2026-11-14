#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "../handle_validation.h"

#include <limits.h>
#include <math.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>

static int tspice_frames_invalid_arg(char *err, int errMaxBytes, const char *msg) {
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

  return 2;
}

int tspice_namfrm(
    const char *frameName,
    int *outFrameId,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameId) {
    *outFrameId = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frameId = 0;
  namfrm_c(frameName, &frameId);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrameId) {
    *outFrameId = (int)frameId;
  }
  if (outFound) {
    *outFound = frameId != 0 ? 1 : 0;
  }

  return 0;
}

int tspice_frmnam(
    int frameId,
    char *outFrameName,
    int outFrameNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameNameMaxBytes > 0 && outFrameName) {
    outFrameName[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  if (outFrameNameMaxBytes > 0 && !outFrameName) {
    return tspice_frames_invalid_arg(
        err,
        errMaxBytes,
        "tspice_frmnam(): outFrameName must not be NULL when outFrameNameMaxBytes > 0");
  }

  frmnam_c((SpiceInt)frameId, (SpiceInt)outFrameNameMaxBytes, outFrameName);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (outFrameName && outFrameName[0] != '\0') ? 1 : 0;
  }

  return 0;
}

int tspice_cidfrm(
    int center,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceChar frname[TSPICE_FRNAME_MAX_BYTES] = {0};
  SpiceBoolean found = SPICEFALSE;

  cidfrm_c((SpiceInt)center, (SpiceInt)sizeof(frname), &frcode, frname, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }

  if (outFrname && outFrnameMaxBytes > 0) {
    strncpy(outFrname, frname, (size_t)outFrnameMaxBytes - 1);
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_cnmfrm(
    const char *centerName,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceChar frname[TSPICE_FRNAME_MAX_BYTES] = {0};
  SpiceBoolean found = SPICEFALSE;

  cnmfrm_c(centerName, (SpiceInt)sizeof(frname), &frcode, frname, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }

  if (outFrname && outFrnameMaxBytes > 0) {
    strncpy(outFrname, frname, (size_t)outFrnameMaxBytes - 1);
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_frinfo(
    int frameId,
    int *outCenter,
    int *outFrameClass,
    int *outClassId,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCenter) {
    *outCenter = 0;
  }
  if (outFrameClass) {
    *outFrameClass = 0;
  }
  if (outClassId) {
    *outClassId = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt center = 0;
  SpiceInt frclss = 0;
  SpiceInt clssid = 0;
  SpiceBoolean found = SPICEFALSE;

  frinfo_c((SpiceInt)frameId, &center, &frclss, &clssid, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCenter) {
    *outCenter = (int)center;
  }
  if (outFrameClass) {
    *outFrameClass = (int)frclss;
  }
  if (outClassId) {
    *outClassId = (int)clssid;
  }
  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  return 0;
}

int tspice_ccifrm(
    int frameClass,
    int classId,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outCenter,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }

  if (outFrname != NULL && outFrnameMaxBytes > 0 &&
      outFrnameMaxBytes < TSPICE_FRNAME_MAX_BYTES) {
    // NAIF documents the maximum frame name length as 32 characters.
    // Add 1 for the trailing NUL.
    if (err && errMaxBytes > 0) {
      strncpy(
          err,
          "ccifrm: outFrnameMaxBytes must be >= TSPICE_FRNAME_MAX_BYTES (33)",
          (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    return 1;
  }
  if (outCenter) {
    *outCenter = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceInt center = 0;
  SpiceBoolean found = SPICEFALSE;

  // Defensive handling: `ccifrm_c` expects a writable output buffer for the
  // frame name. Allow callers to pass a null/empty buffer when they don't
  // care about the name.
  SpiceChar tmpFrname[TSPICE_FRNAME_MAX_BYTES] = {0};
  SpiceChar *frnameBuf = outFrname;
  SpiceInt frnameLen = (SpiceInt)outFrnameMaxBytes;
  if (outFrname == NULL || outFrnameMaxBytes <= 0) {
    frnameBuf = tmpFrname;
    frnameLen = (SpiceInt)sizeof(tmpFrname);
  }

  ccifrm_c(
      (SpiceInt)frameClass,
      (SpiceInt)classId,
      frnameLen,
      &frcode,
      frnameBuf,
      &center,
      &found);

  if (outFrname && outFrnameMaxBytes > 0) {
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }
  if (outCenter) {
    *outCenter = (int)center;
  }
  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  return 0;
}

int tspice_pxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix3x3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  pxform_c(from, to, (SpiceDouble)et, m);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outMatrix3x3) {
    outMatrix3x3[0] = (double)m[0][0];
    outMatrix3x3[1] = (double)m[0][1];
    outMatrix3x3[2] = (double)m[0][2];

    outMatrix3x3[3] = (double)m[1][0];
    outMatrix3x3[4] = (double)m[1][1];
    outMatrix3x3[5] = (double)m[1][2];

    outMatrix3x3[6] = (double)m[2][0];
    outMatrix3x3[7] = (double)m[2][1];
    outMatrix3x3[8] = (double)m[2][2];
  }

  return 0;
}

int tspice_sxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix6x6,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[6][6];
  sxform_c(from, to, (SpiceDouble)et, m);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outMatrix6x6) {
    int i;
    int j;
    for (i = 0; i < 6; i++) {
      for (j = 0; j < 6; j++) {
        outMatrix6x6[i * 6 + j] = (double)m[i][j];
      }
    }
  }

  return 0;
}

int tspice_ckgp(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outClkout,
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
  if (outClkout) {
    *outClkout = 0.0;
  }

  SpiceDouble cmat[3][3];
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgp_c(
      (SpiceInt)inst,
      (SpiceDouble)sclkdp,
      (SpiceDouble)tol,
      ref,
      cmat,
      &clkout,
      &found);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outMatrix3x3) {
      outMatrix3x3[0] = (double)cmat[0][0];
      outMatrix3x3[1] = (double)cmat[0][1];
      outMatrix3x3[2] = (double)cmat[0][2];
      outMatrix3x3[3] = (double)cmat[1][0];
      outMatrix3x3[4] = (double)cmat[1][1];
      outMatrix3x3[5] = (double)cmat[1][2];
      outMatrix3x3[6] = (double)cmat[2][0];
      outMatrix3x3[7] = (double)cmat[2][1];
      outMatrix3x3[8] = (double)cmat[2][2];
    }
    if (outClkout) {
      *outClkout = (double)clkout;
    }
  }

  return 0;
}

int tspice_ckgpav(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outAv3,
    double *outClkout,
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
  if (outClkout) {
    *outClkout = 0.0;
  }
  if (outAv3) {
    outAv3[0] = 0.0;
    outAv3[1] = 0.0;
    outAv3[2] = 0.0;
  }

  SpiceDouble cmat[3][3];
  SpiceDouble av[3];
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgpav_c(
      (SpiceInt)inst,
      (SpiceDouble)sclkdp,
      (SpiceDouble)tol,
      ref,
      cmat,
      av,
      &clkout,
      &found);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outMatrix3x3) {
      outMatrix3x3[0] = (double)cmat[0][0];
      outMatrix3x3[1] = (double)cmat[0][1];
      outMatrix3x3[2] = (double)cmat[0][2];
      outMatrix3x3[3] = (double)cmat[1][0];
      outMatrix3x3[4] = (double)cmat[1][1];
      outMatrix3x3[5] = (double)cmat[1][2];
      outMatrix3x3[6] = (double)cmat[2][0];
      outMatrix3x3[7] = (double)cmat[2][1];
      outMatrix3x3[8] = (double)cmat[2][2];
    }
    if (outAv3) {
      outAv3[0] = (double)av[0];
      outAv3[1] = (double)av[1];
      outAv3[2] = (double)av[2];
    }
    if (outClkout) {
      *outClkout = (double)clkout;
    }
  }

  return 0;
}

// --- CK file query / management (read-only) --------------------------------

static const char *tspice_frames_dtype_to_string(SpiceDataType dtype) {
  switch (dtype) {
    case SPICE_CHR:
      return "SPICE_CHR";
    case SPICE_DP:
      return "SPICE_DP";
    case SPICE_INT:
      return "SPICE_INT";
#ifdef SPICE_TIME
    case SPICE_TIME:
      return "SPICE_TIME";
#endif
    default:
      return NULL;
  }
}

static const char *tspice_frames_dtype_to_string_buf(SpiceDataType dtype, char *buf, int bufMaxBytes) {
  const char *known = tspice_frames_dtype_to_string(dtype);
  if (known != NULL) {
    return known;
  }
  if (buf == NULL || bufMaxBytes <= 0) {
    return "SpiceDataType(?)";
  }
  snprintf(buf, (size_t)bufMaxBytes, "SpiceDataType(%d)", (int)dtype);
  return buf;
}

static int tspice_frames_validate_cell_handle(
    uintptr_t cellHandle,
    SpiceDataType expectedDtype,
    const char *kind,
    const char *ctx,
    SpiceCell **outCell,
    char *err,
    int errMaxBytes) {
  SpiceCell *cell = tspice_validate_handle(cellHandle, kind, ctx, err, errMaxBytes);
  if (cell == NULL) {
    // `tspice_validate_handle` writes a stable message, but this is not a CSPICE
    // failure. Clear structured last-error buffers to avoid leaking stale SPICE
    // details.
    tspice_clear_last_error_buffers();
    return 2;
  }

  if (cell->dtype != expectedDtype) {
    char buf[256];
    char expectedBuf[64];
    char gotBuf[64];
    snprintf(
        buf,
        sizeof(buf),
        "%s: %s handle has wrong dtype (expected %s, got %s)",
        ctx,
        kind,
        tspice_frames_dtype_to_string_buf(expectedDtype, expectedBuf, (int)sizeof(expectedBuf)),
        tspice_frames_dtype_to_string_buf(cell->dtype, gotBuf, (int)sizeof(gotBuf)));
    return tspice_frames_invalid_arg(err, errMaxBytes, buf);
  }

  if (outCell != NULL) {
    *outCell = cell;
  }
  return 0;
}

static int pck_status(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

// On a capacity error inside their DAF search, PCKCOV/PCKFRM call DAFCLS
// while FAILED is set. N0067 DAFCLS returns immediately. Balance exactly
// that reader link plus our temporary lookup link after saving the error.
static int pck_query_status(const char *path, const char *excess, char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  char shortMsg[64] = {0};
  getmsg_c("SHORT", sizeof(shortMsg), shortMsg);
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  if (strcmp(shortMsg, excess) == 0) {
    SpiceInt h = 0;
    dafopr_c(path, &h);
    if (!failed_c()) {
      dafcls_c(h);
      dafcls_c(h);
    }
    if (failed_c()) reset_c();
  }
  return 1;
}

int tspice_pckcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (handle >= 0) return tspice_frames_invalid_arg(err, errMaxBytes, "Expected a PCK writer handle");
  pckcls_c(handle);
  return pck_status(err, errMaxBytes);
}

int tspice_pckcov(const char *path, int classId, uintptr_t dest, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!path) return tspice_frames_invalid_arg(err, errMaxBytes, "Expected a PCK path");
  SpiceCell *window = tspice_validate_input_window(dest, err, errMaxBytes);
  if (!window) return 1;
  if (window->size % 2 || window->size > INT_MAX - SPICE_CELL_CTRLSZ - 2)
    return tspice_frames_invalid_arg(err, errMaxBytes, "Invalid PCK coverage window capacity");
  pckcov_c(path, classId, window);
  if (failed_c()) {
    if (window->init) tspice_set_window_control_preserved(window, 1);
    return pck_query_status(path, "SPICE(WINDOWEXCESS)", err, errMaxBytes);
  }
  tspice_set_window_control_preserved(window, 0);
  return pck_status(err, errMaxBytes);
}

int tspice_pckfrm(const char *path, uintptr_t dest, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!path) return tspice_frames_invalid_arg(err, errMaxBytes, "Expected a PCK path");
  SpiceCell *ids = tspice_validate_handle(dest, "cell", "pckfrm", err, errMaxBytes);
  if (!ids) return 1;
  if (ids->dtype != SPICE_INT || !ids->isSet || ids->card < 0 || ids->size < ids->card ||
      ids->size > INT_MAX - SPICE_CELL_CTRLSZ ||
      tspice_validate_cell_capacity(ids, ids->size, "pckfrm", err, errMaxBytes))
    return tspice_frames_invalid_arg(err, errMaxBytes, "Expected a bounded integer set");
  if (ids->init && (((SpiceInt *)ids->base)[4] != ids->size || ((SpiceInt *)ids->base)[5] != ids->card))
    return tspice_frames_invalid_arg(err, errMaxBytes, "Reset the integer set cardinality after a partial result");
  const SpiceInt *members = ids->data;
  for (int i = 1; i < ids->card; ++i) if (members[i-1] >= members[i])
    return tspice_frames_invalid_arg(err, errMaxBytes, "Expected a sorted integer set");
  pckfrm_c(path, ids);
  if (failed_c()) return pck_query_status(path, "SPICE(SETEXCESS)", err, errMaxBytes);
  return pck_status(err, errMaxBytes);
}

// A repeated physical load reorders a single PCK search-table entry. Track its
// generation so an owner with an older alias cannot unload a later load after
// another owner removes the entry. Node serializes this table with CSPICE.
// 5000 is N0067 PCKBSR's FTSIZE. The number of active DAF handles is smaller.
static struct { SpiceInt daf; int generation; } pck_loads[5000];
static int pck_load_count = 0;
static int pck_generation = 0;

int tspice_pcklof(const char *path, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!out || !path) return tspice_frames_invalid_arg(err, errMaxBytes, "Invalid PCK load argument");
  *out = 0;
  // PCKLOF registers any readable DAF. Only binary PCKs have the descriptor
  // and record layout expected by the subsequent orientation evaluators.
  if (path[0]) {
    SpiceChar arch[8] = {0}, type[8] = {0};
    getfat_c(path, sizeof(arch), sizeof(type), arch, type);
    if (failed_c()) reset_c();  // Let PCKLOF issue its own path diagnostic.
    else if (!strcmp(arch, "DAF") && strcmp(type, "PCK"))
      return tspice_frames_invalid_arg(err, errMaxBytes, "PCK load requires a binary PCK DAF");
  }
  if (pck_generation == INT_MAX) return tspice_frames_invalid_arg(err, errMaxBytes, "PCK load generations exhausted");
  SpiceInt daf = 0;
  pcklof_c(path, &daf);
  if (failed_c()) return pck_status(err, errMaxBytes);
  for (int i = 0; i < pck_load_count; ++i) {
    if (pck_loads[i].daf == daf) { *out = pck_loads[i].generation; return 0; }
  }
  if (pck_load_count == 5000) {
    pckuof_c(daf);
    return tspice_frames_invalid_arg(err, errMaxBytes, "PCK load registry capacity exceeded");
  }
  *out = ++pck_generation;
  pck_loads[pck_load_count].daf = daf;
  pck_loads[pck_load_count++].generation = *out;
  return 0;
}

int tspice_pckopn(const char *path, const char *ifname, int ncomch, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!out || !path || !ifname) return tspice_frames_invalid_arg(err, errMaxBytes, "Invalid PCK open argument");
  *out = 0;
  pckopn_c(path, ifname, ncomch, out);
  return pck_status(err, errMaxBytes);
}

int tspice_pckuof(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  for (int i = 0; i < pck_load_count; ++i) {
    if (pck_loads[i].generation == handle) {
      pckuof_c(pck_loads[i].daf);
      if (failed_c()) return pck_status(err, errMaxBytes);
      pck_loads[i] = pck_loads[--pck_load_count];
      break;
    }
  }
  // PCKUOF itself ignores an already unloaded file. A retired alias must not
  // unload a subsequent registration with the same DAF handle.
  return 0;
}

int tspice_pckw02(int handle, int classId, const char *frame, double first, double last, const char *segid, double intlen, int n, int degree, const double *coefficients, int count, double btime, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !coefficients || degree < 0 || degree > 41 || count < 0 ||
      count > 33554432 || (int64_t)(n > 0 ? n : 0) * 3 * (degree + 1) != count ||
      !isfinite(first) || !isfinite(last) || !isfinite(intlen) || !isfinite(btime))
    return tspice_frames_invalid_arg(err, errMaxBytes, "Invalid type 2 PCK coefficient dimensions or epochs");
  for (int i = 0; i < count; ++i) if (!isfinite(coefficients[i]))
    return tspice_frames_invalid_arg(err, errMaxBytes, "PCK coefficients must be finite");
  if (n > 0 && intlen > 0) {
    double span = n * intlen;
    if (!isfinite(span) || !isfinite(btime + span) || intlen / 2 == 0 ||
        !isfinite(btime + intlen/2 + (n-1)*intlen) ||
        (first <= last && first >= btime && last <= btime + span &&
         !((last - btime) / intlen < INT_MAX - 1)))
      return tspice_frames_invalid_arg(err, errMaxBytes, "PCK epochs exceed the type 2 reader range");
    SpiceInt nd = 0, ni = 0, fwd = 0, back = 0, next = 0;
    SpiceChar name[61] = {0};
    dafrfr_c(handle, sizeof(name), &nd, &ni, name, &fwd, &back, &next);
    if (failed_c()) return pck_status(err, errMaxBytes);
    // DAF may add a summary/name record pair and align the next free address.
    if ((int64_t)next + count + 2*(int64_t)n + 4 + 3*128 > INT_MAX)
      return tspice_frames_invalid_arg(err, errMaxBytes, "PCK segment exceeds DAF address space");
  }
  pckw02_c(handle, classId, frame, first, last, segid, intlen, n, degree, coefficients, btime);
  return pck_status(err, errMaxBytes);
}

int tspice_cklpf(const char *ck, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (ck == NULL || ck[0] == '\0') {
    return tspice_frames_invalid_arg(err, errMaxBytes, "tspice_cklpf(): ck must be a non-empty string");
  }

  SpiceInt handle = 0;
  cklpf_c(ck, &handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outHandle) {
    *outHandle = (int)handle;
  }

  return 0;
}

int tspice_ckupf(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  ckupf_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ckobj(const char *ck, uintptr_t idsCellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (ck == NULL || ck[0] == '\0') {
    return tspice_frames_invalid_arg(err, errMaxBytes, "tspice_ckobj(): ck must be a non-empty string");
  }

  SpiceCell *ids = NULL;
  const int idsCode = tspice_frames_validate_cell_handle(
      idsCellHandle,
      SPICE_INT,
      "cell",
      "tspice_ckobj()",
      &ids,
      err,
      errMaxBytes);
  if (idsCode != 0) {
    return idsCode;
  }

  ckobj_c(ck, ids);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ckcov(
    const char *ck,
    int idcode,
    int needav,
    const char *level,
    double tol,
    const char *timsys,
    uintptr_t coverWindowHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (ck == NULL || ck[0] == '\0') {
    return tspice_frames_invalid_arg(err, errMaxBytes, "tspice_ckcov(): ck must be a non-empty string");
  }
  if (level == NULL || level[0] == '\0') {
    return tspice_frames_invalid_arg(err, errMaxBytes, "tspice_ckcov(): level must be a non-empty string");
  }
  if (timsys == NULL || timsys[0] == '\0') {
    return tspice_frames_invalid_arg(err, errMaxBytes, "tspice_ckcov(): timsys must be a non-empty string");
  }

  SpiceCell *cover = NULL;
  const int coverCode = tspice_frames_validate_cell_handle(
      coverWindowHandle,
      SPICE_DP,
      "window",
      "tspice_ckcov()",
      &cover,
      err,
      errMaxBytes);
  if (coverCode != 0) {
    return coverCode;
  }

  ckcov_c(
      ck,
      (SpiceInt)idcode,
      (needav != 0) ? SPICETRUE : SPICEFALSE,
      level,
      (SpiceDouble)tol,
      timsys,
      cover);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
