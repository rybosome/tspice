#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceDLA.h"
#include "SpiceDSK.h"

#include "../handle_validation.h"

#include <stdint.h>
#include <stdio.h>
#include <string.h>

// ABI guard.
//
// This project assumes SpiceInt is 32-bit across Node/WASM backends.
_Static_assert(sizeof(SpiceInt) == 4, "expected SpiceInt to be 32-bit");

#if defined(SPICE_DSK_NSYPAR)
_Static_assert(SPICE_DSK_NSYPAR == 10, "expected SPICE_DSK_NSYPAR == 10");
#endif

static int tspice_write_error(char *err, int errMaxBytes, const char *msg) {
  if (err == NULL || errMaxBytes <= 0) {
    return 1;
  }
  strncpy(err, msg, errMaxBytes - 1);
  err[errMaxBytes - 1] = '\0';
  return 1;
}

static int tspice_clear_error(char *err, int errMaxBytes) {
  if (err == NULL || errMaxBytes <= 0) {
    return 0;
  }
  err[0] = '\0';
  return 0;
}

static int tspice_validate_dsk_path(const char *dsk, char *err, int errMaxBytes) {
  if (dsk == NULL || dsk[0] == '\0') {
    return tspice_write_error(err, errMaxBytes, "dsk path must be a non-empty string");
  }
  return 0;
}

static const char *tspice_dtype_to_string(SpiceDataType dtype) {
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
      return "UNKNOWN";
  }
}

static int tspice_validate_int_cell(
    uintptr_t cellHandle,
    SpiceCell **outCell,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", ctx, err, errMaxBytes);
  if (cell == NULL) {
    return 1;
  }

  if (cell->dtype != SPICE_INT) {
    char buf[200];
    snprintf(
        buf,
        sizeof(buf),
        "%s: SpiceCell handle has wrong dtype (expected %s, got %s (%d))",
        ctx,
        tspice_dtype_to_string(SPICE_INT),
        tspice_dtype_to_string(cell->dtype),
        (int)cell->dtype);
    return tspice_write_error(err, errMaxBytes, buf);
  }
  if (outCell != NULL) {
    *outCell = cell;
  }
  return 0;
}

int tspice_dskobj(const char *dsk, uintptr_t bodidsCellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);

  if (tspice_validate_dsk_path(dsk, err, errMaxBytes) != 0) {
    return 1;
  }

  SpiceCell *bodids = NULL;
  if (tspice_validate_int_cell(bodidsCellHandle, &bodids, "tspice_dskobj()", err, errMaxBytes) != 0) {
    return 1;
  }

  dskobj_c(dsk, bodids);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_dsksrf(const char *dsk, int bodyid, uintptr_t srfidsCellHandle, char *err,
                  int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);

  if (tspice_validate_dsk_path(dsk, err, errMaxBytes) != 0) {
    return 1;
  }

  SpiceCell *srfids = NULL;
  if (tspice_validate_int_cell(srfidsCellHandle, &srfids, "tspice_dsksrf()", err, errMaxBytes) != 0) {
    return 1;
  }

  dsksrf_c(dsk, (SpiceInt)bodyid, srfids);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

static void tspice_write_dla_descr_from_ints(SpiceDLADescr *out, const int32_t *ints8) {
  out->bwdptr = (SpiceInt)ints8[0];
  out->fwdptr = (SpiceInt)ints8[1];
  out->ibase = (SpiceInt)ints8[2];
  out->isize = (SpiceInt)ints8[3];
  out->dbase = (SpiceInt)ints8[4];
  out->dsize = (SpiceInt)ints8[5];
  out->cbase = (SpiceInt)ints8[6];
  out->csize = (SpiceInt)ints8[7];
}

int tspice_dskgd(int handle, const int32_t *dladscInts8, int32_t *outInts6, double *outDoubles18,
                 char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);

  if (dladscInts8 == NULL) {
    return tspice_write_error(err, errMaxBytes, "dladscInts8 must be non-null");
  }
  if (outInts6 == NULL) {
    return tspice_write_error(err, errMaxBytes, "outInts6 must be non-null");
  }
  if (outDoubles18 == NULL) {
    return tspice_write_error(err, errMaxBytes, "outDoubles18 must be non-null");
  }

  for (int i = 0; i < 6; i++) {
    outInts6[i] = 0;
  }
  for (int i = 0; i < 18; i++) {
    outDoubles18[i] = 0.0;
  }

  SpiceDLADescr dladsc;
  tspice_write_dla_descr_from_ints(&dladsc, dladscInts8);

  SpiceDSKDescr dskdsc;
  dskgd_c((SpiceInt)handle, &dladsc, &dskdsc);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  outInts6[0] = (int32_t)dskdsc.surfce;
  outInts6[1] = (int32_t)dskdsc.center;
  outInts6[2] = (int32_t)dskdsc.dclass;
  outInts6[3] = (int32_t)dskdsc.dtype;
  outInts6[4] = (int32_t)dskdsc.frmcde;
  outInts6[5] = (int32_t)dskdsc.corsys;

  // 0..9: corpar
  for (int i = 0; i < 10; i++) {
    outDoubles18[i] = dskdsc.corpar[i];
  }
  // 10..17: scalar fields
  outDoubles18[10] = dskdsc.co1min;
  outDoubles18[11] = dskdsc.co1max;
  outDoubles18[12] = dskdsc.co2min;
  outDoubles18[13] = dskdsc.co2max;
  outDoubles18[14] = dskdsc.co3min;
  outDoubles18[15] = dskdsc.co3max;
  outDoubles18[16] = dskdsc.start;
  outDoubles18[17] = dskdsc.stop;

  return 0;
}

int tspice_dskb02(int handle, const int32_t *dladscInts8, int32_t *outInts10, double *outDoubles10,
                  char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);

  if (dladscInts8 == NULL) {
    return tspice_write_error(err, errMaxBytes, "dladscInts8 must be non-null");
  }
  if (outInts10 == NULL) {
    return tspice_write_error(err, errMaxBytes, "outInts10 must be non-null");
  }
  if (outDoubles10 == NULL) {
    return tspice_write_error(err, errMaxBytes, "outDoubles10 must be non-null");
  }

  for (int i = 0; i < 10; i++) {
    outInts10[i] = 0;
  }
  for (int i = 0; i < 10; i++) {
    outDoubles10[i] = 0.0;
  }

  SpiceDLADescr dladsc;
  tspice_write_dla_descr_from_ints(&dladsc, dladscInts8);

  SpiceInt nv = 0;
  SpiceInt np = 0;
  SpiceInt nvxtot = 0;
  SpiceDouble vtxbds[3][2];
  SpiceDouble voxsiz = 0.0;
  SpiceDouble voxori[3];
  SpiceInt vgrext[3];
  SpiceInt cgscal = 0;
  SpiceInt vtxnpl = 0;
  SpiceInt voxnpt = 0;
  SpiceInt voxnpl = 0;

  dskb02_c((SpiceInt)handle, &dladsc, &nv, &np, &nvxtot, vtxbds, &voxsiz, voxori, vgrext, &cgscal,
           &vtxnpl, &voxnpt, &voxnpl);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  outInts10[0] = (int32_t)nv;
  outInts10[1] = (int32_t)np;
  outInts10[2] = (int32_t)nvxtot;
  outInts10[3] = (int32_t)vgrext[0];
  outInts10[4] = (int32_t)vgrext[1];
  outInts10[5] = (int32_t)vgrext[2];
  outInts10[6] = (int32_t)cgscal;
  outInts10[7] = (int32_t)vtxnpl;
  outInts10[8] = (int32_t)voxnpt;
  outInts10[9] = (int32_t)voxnpl;

  // Flatten vtxbds[3][2] -> 6 doubles in row-major order.
  outDoubles10[0] = vtxbds[0][0];
  outDoubles10[1] = vtxbds[0][1];
  outDoubles10[2] = vtxbds[1][0];
  outDoubles10[3] = vtxbds[1][1];
  outDoubles10[4] = vtxbds[2][0];
  outDoubles10[5] = vtxbds[2][1];
  outDoubles10[6] = voxsiz;
  outDoubles10[7] = voxori[0];
  outDoubles10[8] = voxori[1];
  outDoubles10[9] = voxori[2];

  return 0;
}
