#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "../handle_validation.h"

#include "SpiceZfc.h"
#include <limits.h>
#include <math.h>
#include <stdint.h>
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

static int ck_record_status(char *err, int room) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, room);
  return 1;
}

// Resolve the same metadata CKFROT/CKFXFM read before ZZSCLK negates it.
// A prior error in CKMETA may also leave their local SCLK ID undefined.
static int ck_frame_clock(int inst, char *err, int room) {
  int clock = 0;
  ckmeta_c(inst, "SCLK", &clock);
  if (ck_record_status(err, room)) return 1;
  if (clock == INT_MIN) {
    logical have = SPICEFALSE;
    ckhave_(&have);
    if (ck_record_status(err, room)) return 1;
    if (have) return tspice_frames_invalid_arg(err, room, "CK SCLK ID cannot be negated");
  }
  return 0;
}

// Locate the exact five packed words in this file without selecting or moving
// any DAF search. C02's reader also checks non-native summary translation.
static int ck_record_descriptor(int handle, const unsigned char *bytes, int size,
                                double words[5], int *freeAddr, char *err, int room) {
  if (!bytes || size != 40) return tspice_frames_invalid_arg(err, room, "Expected 40 CK descriptor bytes");
  char path[256] = {0}, arch[8] = {0}, type[8] = {0};
  dafhfn_(&handle, path, 255);
  if (ck_record_status(err, room)) return 1;
  for (int i = 254; i >= 0 && path[i] == ' '; --i) path[i] = 0;
  getfat_c(path, sizeof(arch), sizeof(type), arch, type);
  if (ck_record_status(err, room)) return 1;
  if (strcmp(arch,"DAF") || strcmp(type,"CK")) return tspice_frames_invalid_arg(err, room, "Expected a CK DAF");
  char ifname[61] = {0};
  int fields[5] = {0};
  if (tspice_dafrfr(handle, sizeof(ifname), ifname, sizeof(ifname), fields, err, room)) return 1;
  if (fields[0] != 2 || fields[1] != 6 || fields[4] < 2)
    return tspice_frames_invalid_arg(err, room, "Invalid CK DAF summary format");
  *freeAddr = fields[4];
  const int lastRecord = (*freeAddr-2)/128+1;
  int rec = fields[2], prev = 0;
  for (int visited = 0; rec && visited < lastRecord; ++visited) {
    double row[128] = {0};
    int found = 0;
    if (rec < 2 || rec > lastRecord) break;
    if (tspice_dafgsr(handle, rec, 1, 128, (unsigned char *)row, sizeof(row), &found, err, room)) return 1;
    if (!found || row[1] != prev || !(row[0] >= 0 && row[0] <= lastRecord && trunc(row[0]) == row[0]) ||
        !(row[2] >= 0 && row[2] <= 25 && trunc(row[2]) == row[2])) break;
    for (int i = 0; i < (int)row[2]; ++i) {
      if (!memcmp(row+3+5*i, bytes, 40)) { memcpy(words,bytes,40); return 0; }
    }
    prev = rec;
    rec = (int)row[0];
  }
  return tspice_frames_invalid_arg(err, room, "CK descriptor does not belong to this DAF");
}

// N0067 uses on-disk counts in signed address arithmetic without checking
// their representability. Check the physical layout before the actual read.
static int ck_record_layout(int handle, const double words[5], int freeAddr, int type,
                            int recno, int *av, char *err, int room) {
  double dc[2] = {0};
  int ic[6] = {0};
  dafus_c(words, 2, 6, dc, ic);
  if (ck_record_status(err,room)) return 1;
  if (ic[2] != type) return 0; // Canonical routine signals CKWRONGDATATYPE.
  const int beg = ic[4], end = ic[5];
  if (beg < 1 || end < beg || end >= freeAddr || (ic[3] != 0 && ic[3] != 1))
    return tspice_frames_invalid_arg(err,room,"Invalid CK segment addresses or AV flag");
  const int64_t span = (int64_t)end-beg+1;
  int64_t n, length;
  *av = ic[3];
  if (type == 2) {
    n = (span*100+501)/1001;
    length = n*10+(n-1)/100;
  } else {
    if (span < 2) return tspice_frames_invalid_arg(err,room,"Missing CK type 3 trailer");
    double tail[2] = {0};
    if (tspice_dafgda(handle,end-1,end,tail,2,err,room)) return 1;
    if (!(tail[1] >= 1 && tail[1] <= INT_MAX && trunc(tail[1]) == tail[1] &&
          tail[0] >= 1 && tail[0] <= tail[1] && trunc(tail[0]) == tail[0]))
      return tspice_frames_invalid_arg(err,room,"Invalid CK type 3 trailer");
    n = (int)tail[1];
    const int64_t intervals = (int)tail[0];
    length = (ic[3] ? 8 : 5)*n + (n-1)/100 + intervals + (intervals-1)/100 + 2;
  }
  if (n < 1 || length != span) return tspice_frames_invalid_arg(err,room,"Invalid CK record layout");
  if (type == 2 && recno >= 1 && recno <= n) {
    // CKGR02 copies a local pointing packet immediately after DAFGDA. Check
    // that exact range first so an unreadable physical record is not consumed.
    const int first = beg+8*(recno-1);
    double packet[8] = {0};
    if (tspice_dafgda(handle,first,first+7,packet,8,err,room)) return 1;
  }
  return 0;
}

int tspice_ckfrot(int inst, double et, double *out, int *ref, int *found, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!out || !ref || !found || !isfinite(et)) return tspice_frames_invalid_arg(err,errMaxBytes,"Invalid CK frame inputs");
  if (ck_frame_clock(inst,err,errMaxBytes)) return 1;
  SpiceDouble matrix[3][3] = {0};
  *found = SPICEFALSE;
  *ref = 0;
  ckfrot_c(inst, et, matrix, ref, found);
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (*found) memcpy(out,matrix,sizeof(matrix));
  return 0;
}

int tspice_ckfxfm(int inst, double et, double *out, int *ref, int *found, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!out || !ref || !found || !isfinite(et)) return tspice_frames_invalid_arg(err,errMaxBytes,"Invalid CK frame inputs");
  if (ck_frame_clock(inst,err,errMaxBytes)) return 1;
  SpiceDouble matrix[6][6] = {0};
  *found = SPICEFALSE;
  *ref = 0;
  ckfxfm_c(inst, et, matrix, ref, found);
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (*found) memcpy(out,matrix,sizeof(matrix));
  return 0;
}

int tspice_ckgr02(int handle, const unsigned char *bytes, int size, int recno, double *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!out) return tspice_frames_invalid_arg(err,errMaxBytes,"Missing CK record output");
  double words[5] = {0};
  int freeAddr = 0, av = 0;
  if (ck_record_descriptor(handle,bytes,size,words,&freeAddr,err,errMaxBytes) ||
      ck_record_layout(handle,words,freeAddr,2,recno,&av,err,errMaxBytes)) return 1;
  ckgr02_c(handle,words,recno,out);
  return ck_record_status(err,errMaxBytes);
}

int tspice_ckgr03(int handle, const unsigned char *bytes, int size, int recno, double *out, int *nwords, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!out || !nwords) return tspice_frames_invalid_arg(err,errMaxBytes,"Missing CK record output");
  double words[5] = {0};
  int freeAddr = 0, av = 0;
  if (ck_record_descriptor(handle,bytes,size,words,&freeAddr,err,errMaxBytes) ||
      ck_record_layout(handle,words,freeAddr,3,recno,&av,err,errMaxBytes)) return 1;
  ckgr03_c(handle,words,recno,out);
  *nwords = av ? 8 : 5;
  return ck_record_status(err,errMaxBytes);
}

int tspice_ckmeta(int ckid, const char *meta, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!meta || !out) return tspice_frames_invalid_arg(err,errMaxBytes,"Invalid CKMETA inputs");
  ckmeta_c(ckid,meta,out);
  return ck_record_status(err,errMaxBytes);
}

int tspice_cknr02(int handle, const unsigned char *bytes, int size, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!out) return tspice_frames_invalid_arg(err,errMaxBytes,"Missing CK record output");
  double words[5] = {0};
  int freeAddr = 0, av = 0;
  if (ck_record_descriptor(handle,bytes,size,words,&freeAddr,err,errMaxBytes) ||
      ck_record_layout(handle,words,freeAddr,2,0,&av,err,errMaxBytes)) return 1;
  cknr02_c(handle,words,out);
  return ck_record_status(err,errMaxBytes);
}

int tspice_cknr03(int handle, const unsigned char *bytes, int size, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (ck_record_status(err,errMaxBytes)) return 1;
  if (!out) return tspice_frames_invalid_arg(err,errMaxBytes,"Missing CK record output");
  double words[5] = {0};
  int freeAddr = 0, av = 0;
  if (ck_record_descriptor(handle,bytes,size,words,&freeAddr,err,errMaxBytes) ||
      ck_record_layout(handle,words,freeAddr,3,0,&av,err,errMaxBytes)) return 1;
  cknr03_c(handle,words,out);
  return ck_record_status(err,errMaxBytes);
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
