#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceZfc.h"

#include "../handle_validation.h"

#include <limits.h>
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

static int finish_frame_call(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

// ZZBODKER builds the ID hash from paired name/code mappings. N0067
// ZZHASHI takes signed abs(code), which has no representation for INT_MIN.
static int check_body_mapping_codes(char *err, int errMaxBytes) {
  SpiceBoolean found = SPICEFALSE;
  SpiceInt names = 0, codes = 0;
  SpiceChar type[2] = {0};
  dtpool_c("NAIF_BODY_NAME", &found, &names, type);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!found || type[0] != 'C' || names > 14983) return 0;
  dtpool_c("NAIF_BODY_CODE", &found, &codes, type);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!found || type[0] != 'N' || names != codes) return 0;
  int unsafe = 0;
  for (SpiceInt start = 0; start < codes; start += 64) {
    SpiceDouble values[64];
    SpiceInt used = 0;
    gdpool_c("NAIF_BODY_CODE", start, 64, &used, values, &found);
    if (failed_c()) return finish_frame_call(err, errMaxBytes);
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
    if (failed_c()) return finish_frame_call(err, errMaxBytes);
    for (SpiceInt i = 0; i < used; ++i) {
      if (!rows[i][0]) return 0;
    }
  }
  return tspice_frames_invalid_arg(err, errMaxBytes, "NAIF_BODY_CODE outside the safe N0067 body hash range");
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
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!found) return 0;
  snprintf(item, sizeof(item), "BODY%d_MAX_PHASE_DEGREE", system);
  dtpool_c(item, &found, &n, type);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!found) return 0;
  if (type[0] == 'N' && n == 1) {
    SpiceDouble degree = 0;
    gdpool_c(item, 0, 1, &n, &degree, &found);
    if (failed_c()) return finish_frame_call(err, errMaxBytes);
    if (degree > (double)INT_MIN - 0.5 && degree < (double)INT_MAX + 0.5) return 0;
  }
  return tspice_frames_invalid_arg(err, errMaxBytes, "Invalid N0067 PCK phase degree storage or integer range");
}

int tspice_bltfrm(int frameClass, uintptr_t handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  SpiceCell *ids = NULL;
  int status = tspice_frames_validate_cell_handle(handle, SPICE_INT, "cell", "bltfrm()", &ids, err, errMaxBytes);
  if (status != 0) return status;
  bltfrm_c(frameClass, ids);
  return finish_frame_call(err, errMaxBytes);
}

int tspice_pxfrm2(const char *from, const char *to, double etfrom, double etto, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!out || !from || !to) return tspice_frames_invalid_arg(err, errMaxBytes, "Missing pxfrm2 argument storage");
  // PXFRM2 multiplies two automatic arrays unconditionally. REFCHG can
  // return without writing one after an orientation error. Preflight both
  // exact legs in order, under the caller's SPICE lock, before dispatch.
  if (*from && *to) {
    integer fromId = 0, toId = 0, j2000 = 1;
    SpiceDouble scratch[9] = {0};
    chkin_c("pxfrm2_c");
    chkin_c("PXFRM2");
    namfrm_c(from, &fromId);
    if (!failed_c()) namfrm_c(to, &toId);
    if (!failed_c() && fromId && toId) {
      if (fromId == INT_MIN || toId == INT_MIN) {
        chkout_c("PXFRM2");
        chkout_c("pxfrm2_c");
        return tspice_frames_invalid_arg(err, errMaxBytes, "ID outside the N0067 frame hash range");
      }
      refchg_(&fromId, &j2000, &etfrom, scratch);
      if (!failed_c()) refchg_(&j2000, &toId, &etto, scratch);
    }
    chkout_c("PXFRM2");
    chkout_c("pxfrm2_c");
    if (failed_c()) return finish_frame_call(err, errMaxBytes);
  }
  SpiceDouble result[3][3] = {0};
  pxfrm2_c(from, to, etfrom, etto, result);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_tipbod(const char *ref, int body, double et, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!out || !ref) return tspice_frames_invalid_arg(err, errMaxBytes, "Missing tipbod argument storage");
  // ZZHASHI uses signed abs() on the lookup ID.
  if (body == INT_MIN) return tspice_frames_invalid_arg(err, errMaxBytes, "ID outside the N0067 frame hash range");
  int status = check_phase_degree(body, err, errMaxBytes);
  if (status != 0) return status;
  SpiceDouble result[3][3] = {0};
  tipbod_c(ref, body, et, result);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_tisbod(const char *ref, int body, double et, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!out || !ref) return tspice_frames_invalid_arg(err, errMaxBytes, "Missing tisbod argument storage");
  // ZZHASHI uses signed abs() on the lookup ID.
  if (body == INT_MIN) return tspice_frames_invalid_arg(err, errMaxBytes, "ID outside the N0067 frame hash range");
  int status = check_phase_degree(body, err, errMaxBytes);
  if (status != 0) return status;
  SpiceDouble result[6][6] = {0};
  tisbod_c(ref, body, et, result);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_tkfram(int typeId, double *out, int *frame, int *found, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!out || !frame || !found) return tspice_frames_invalid_arg(err, errMaxBytes, "Missing tkfram argument storage");
  // ZZHASHI uses signed abs() on the lookup ID.
  if (typeId == INT_MIN) return tspice_frames_invalid_arg(err, errMaxBytes, "ID outside the N0067 frame hash range");
  SpiceBoolean hasRotation = SPICEFALSE;
  SpiceInt baseFrame = 0;
  *found = 0;
  SpiceDouble result[3][3] = {0};
  tkfram_c(typeId, result, &baseFrame, &hasRotation);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!hasRotation) return 0;
  *found = 1;
  *frame = baseFrame;
  memcpy(out, result, sizeof(result));
  return 0;
}

int tspice_xfmsta(const double *state, const char *from, const char *to, const char *body, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  if (!out || !state || !from || !to || !body) return tspice_frames_invalid_arg(err, errMaxBytes, "Missing xfmsta argument storage");
  // Only unequal coordinate systems involving a spheroid resolve the body.
  if (*from && *to && *body && !eqstr_c(from, to) &&
      (eqstr_c(from, "GEODETIC") || eqstr_c(to, "GEODETIC") ||
       eqstr_c(from, "PLANETOGRAPHIC") || eqstr_c(to, "PLANETOGRAPHIC"))) {
    int status = check_body_mapping_codes(err, errMaxBytes);
    if (status != 0) return status;
  }
  SpiceDouble result[6] = {0};
  xfmsta_c(state, from, to, body, result);
  if (failed_c()) return finish_frame_call(err, errMaxBytes);
  memcpy(out, result, sizeof(result));
  return 0;
}
