#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceDLA.h"
#include "SpiceDSK.h"

#include "../handle_validation.h"

#include "tspice_error.h"

#include "SpiceZfc.h"
#include <limits.h>
#include <math.h>
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

static int tspice_validate_dsk_path(const char *dsk, char *err, int errMaxBytes) {
  if (dsk == NULL || dsk[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "dsk path must be a non-empty string");
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
      return NULL;
  }
}

static const char *tspice_dtype_to_string_buf(SpiceDataType dtype, char *buf, int bufMaxBytes) {
  const char *known = tspice_dtype_to_string(dtype);
  if (known != NULL) {
    return known;
  }
  snprintf(buf, (size_t)bufMaxBytes, "SpiceDataType(%d)", (int)dtype);
  return buf;
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
    char bufExpected[64];
    char bufGot[64];
    snprintf(
        buf,
        sizeof(buf),
        "%s: SpiceCell handle has wrong dtype (expected %s, got %s)",
        ctx,
        tspice_dtype_to_string_buf(SPICE_INT, bufExpected, (int)sizeof(bufExpected)),
        tspice_dtype_to_string_buf(cell->dtype, bufGot, (int)sizeof(bufGot)));
    return tspice_return_error(err, errMaxBytes, buf);
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
    return tspice_return_error(err, errMaxBytes, "dladscInts8 must be non-null");
  }
  if (outInts6 == NULL) {
    return tspice_return_error(err, errMaxBytes, "outInts6 must be non-null");
  }
  if (outDoubles18 == NULL) {
    return tspice_return_error(err, errMaxBytes, "outDoubles18 must be non-null");
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
    return tspice_return_error(err, errMaxBytes, "dladscInts8 must be non-null");
  }
  if (outInts10 == NULL) {
    return tspice_return_error(err, errMaxBytes, "outInts10 must be non-null");
  }
  if (outDoubles10 == NULL) {
    return tspice_return_error(err, errMaxBytes, "outDoubles10 must be non-null");
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

static int data_status(char* err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, cap);
  return 1;
}

typedef struct {
  SpiceDLADescr descriptor;
  int nv, np, npt, npl, nvpl, ncgr;
} DskDataSegment;

// DLA stores its eight descriptor words immediately before the integer component.
// Check the supplied value against the open file, including across RPC copies.
// Basic file sizes and header arithmetic are checked using 64 bits before N0067
// computes its addresses or multiplies a scale in 32-bit signed storage.
static int data_segment(int handle, const int32_t* d, DskDataSegment* s, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err, cap);
  if (!d || d[2] < 8 || d[3] < 10 || d[4] < 0 || d[5] < 34 || d[6] < 0 || d[7] < 0)
    return tspice_return_error(err, cap, "Expected a type-2 DLA segment descriptor");
  int c = 0, db = 0, ib = 0, actual[8] = {0}, header[10] = {0};
  daslla_c(handle, &c, &db, &ib);
  if (failed_c()) return data_status(err, cap);
  if ((int64_t)d[2] + d[3] > ib || (int64_t)d[4] + d[5] > db || (int64_t)d[6] + d[7] > c)
    return tspice_return_error(err, cap, "DLA descriptor exceeds the open file");
  dasrdi_c(handle, d[2] - 7, d[2], actual);
  if (failed_c()) return data_status(err, cap);
  if (memcmp(actual, d, sizeof(actual)) != 0)
    return tspice_return_error(err, cap, "DLA descriptor does not match the open file");
  double dtype = 0;
  dasrdd_c(handle, d[4] + 4, d[4] + 4, &dtype);
  if (failed_c()) return data_status(err, cap);
  if (dtype != 2) return tspice_return_error(err, cap, "Expected DSK data type 2");
  dasrdi_c(handle, d[2] + 1, d[2] + 10, header);
  if (failed_c()) return data_status(err, cap);
  for (int i = 0; i < 10; ++i)
    if (header[i] < 0) return tspice_return_error(err, cap, "Negative type-2 DSK component size");
  int scale = header[6];
  // 1290 is the largest positive integer whose cube fits signed SpiceInt.
  if (scale < 1 || scale > 1290)
    return tspice_return_error(err, cap, "Invalid type-2 DSK coarse scale");
  s->nv = header[0];
  s->np = header[1];
  s->npt = header[7];
  s->npl = header[8];
  s->nvpl = header[9];
  s->ncgr = header[2] / (scale * scale * scale);
  int64_t isize = 10 + 3LL * s->np + s->npt + s->npl + s->nv + s->nvpl + s->ncgr;
  int64_t dsize = 34 + 3LL * s->nv;
  if (isize > d[3] || dsize > d[5])
    return tspice_return_error(err, cap, "Type-2 DSK arrays exceed their segment");
  // The translated readers form end = start + count - 1 left-to-right.
  if ((int64_t)d[2]+isize >= INT32_MAX || (int64_t)d[4]+dsize >= INT32_MAX)
    return tspice_return_error(err, cap, "DSK endpoint exceeds translated address arithmetic");
  tspice_write_dla_descr_from_ints(&s->descriptor, d);
  return 0;
}

// These seven N0067 C symbols are exported but absent from SpiceUsr.h.
void illum_pl02 ( SpiceInt               handle,
                     ConstSpiceDLADescr   * dladsc,
                     ConstSpiceChar       * target,
                     SpiceDouble            et,
                     ConstSpiceChar       * abcorr,
                     ConstSpiceChar       * obsrvr,
                     SpiceDouble            spoint [3],
                     SpiceDouble          * phase,
                     SpiceDouble          * solar,
                     SpiceDouble          * emissn      );
void illum_plid_pl02 ( SpiceInt               handle,
                          ConstSpiceDLADescr   * dladsc,
                          ConstSpiceChar       * target,
                          SpiceDouble            et,
                          ConstSpiceChar       * abcorr,
                          ConstSpiceChar       * obsrvr,
                          SpiceDouble            spoint [3],
                          SpiceInt               plid,
                          SpiceDouble          * trgepc,
                          SpiceDouble            srfvec [3],
                          SpiceDouble          * phase,
                          SpiceDouble          * solar,
                          SpiceDouble          * emissn,
                          SpiceBoolean         * visible,
                          SpiceBoolean         * lit       );
void limb_pl02 ( SpiceInt              handle,
                    ConstSpiceDLADescr  * dladsc,
                    ConstSpiceChar      * target,
                    SpiceDouble           et,
                    ConstSpiceChar      * fixref,
                    ConstSpiceChar      * abcorr,
                    ConstSpiceChar      * obsrvr,
                    SpiceInt              npts,
                    SpiceDouble         * trgepc,
                    SpiceDouble           obspos [3],
                    SpiceDouble           lmbpts [][3],
                    SpiceInt              pltids []     );
void llgrid_pl02 ( SpiceInt               handle,
                      ConstSpiceDLADescr   * dladsc,
                      SpiceInt               npts,
                      ConstSpiceDouble       grid   [][2],
                      SpiceDouble            srfpts [][3],
                      SpiceInt               pltids []     );
void subpt_pl02 ( SpiceInt               handle,
                     ConstSpiceDLADescr   * dladsc,
                     ConstSpiceChar       * method,
                     ConstSpiceChar       * target,
                     SpiceDouble            et,
                     ConstSpiceChar       * abcorr,
                     ConstSpiceChar       * obsrvr,
                     SpiceDouble            spoint [3],
                     SpiceDouble          * alt,
                     SpiceInt             * plateID     );
void subsol_pl02 ( SpiceInt               handle,
                      ConstSpiceDLADescr   * dladsc,
                      ConstSpiceChar       * method,
                      ConstSpiceChar       * target,
                      SpiceDouble            et,
                      ConstSpiceChar       * abcorr,
                      ConstSpiceChar       * obsrvr,
                      SpiceDouble            spoint [3],
                      SpiceDouble          * dist,
                      SpiceInt             * plateID     );
void term_pl02 ( SpiceInt              handle,
                    ConstSpiceDLADescr  * dladsc,
                    ConstSpiceChar      * trmtyp,
                    ConstSpiceChar      * source,
                    ConstSpiceChar      * target,
                    SpiceDouble           et,
                    ConstSpiceChar      * fixref,
                    ConstSpiceChar      * abcorr,
                    ConstSpiceChar      * obsrvr,
                    SpiceInt              npts,
                    SpiceDouble         * trgepc,
                    SpiceDouble           obspos   [3],
                    SpiceDouble           trmpts   [][3],
                    SpiceInt              pltids   []     );

int tspice_illum_pl02(int handle, const int *descr, const char *target, double et, const char *abcorr, const char *obsrvr, const double *spoint, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !target || !abcorr || !obsrvr || !spoint) return tspice_return_error(err, cap, "Missing legacy plate storage");
  illum_pl02(handle,&segment.descriptor,target,et,abcorr,obsrvr,(double*)spoint,out,out+1,out+2);
  return data_status(err, cap);
}

int tspice_illum_plid_pl02(int handle, const int *descr, const char *target, double et, const char *abcorr, const char *obsrvr, const double *spoint, int plid, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !target || !abcorr || !obsrvr || !spoint) return tspice_return_error(err, cap, "Missing legacy plate storage");
  // Only inspect an existing plate. For other indices the original DSKN02
  // reports its scientific error after the legacy geometry prerequisites.
  if (plid >= 1 && plid <= segment.np) {
    int verts[3] = {0}, address = segment.descriptor.ibase + 11 + 3 * (plid - 1);
    dasrdi_c(handle, address, address + 2, verts);
    if (failed_c()) return data_status(err, cap);
    for (int i=0; i<3; ++i) if (verts[i]<1 || verts[i]>segment.nv)
      return tspice_return_error(err, cap, "Plate contains an invalid one-based vertex ID");
  }
  illum_plid_pl02(handle,&segment.descriptor,target,et,abcorr,obsrvr,(double*)spoint,plid,out,out+1,out+4,out+5,out+6,ids,ids+1);
  return data_status(err, cap);
}

int tspice_limb_pl02(int handle, const int *descr, const char *target, double et, const char *fixref, const char *abcorr, const char *obsrvr, int npts, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !target || !fixref || !abcorr || !obsrvr) return tspice_return_error(err, cap, "Missing legacy plate storage");
  if (npts > ((268435456-32)/24)) return tspice_return_error(err, cap, "Plate output exceeds buffer bound");
  limb_pl02(handle,&segment.descriptor,target,et,fixref,abcorr,obsrvr,npts,out,out+1,(double(*)[3])(out+4),ids);
  return data_status(err, cap);
}

int tspice_llgrid_pl02(int handle, const int *descr, int npts, const double *grid, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !grid) return tspice_return_error(err, cap, "Missing legacy plate storage");
  if (npts > ((268435456-32)/24)) return tspice_return_error(err, cap, "Plate output exceeds buffer bound");
  llgrid_pl02(handle,&segment.descriptor,npts,(const double(*)[2])grid,(double(*)[3])out,ids);
  return data_status(err, cap);
}

int tspice_subpt_pl02(int handle, const int *descr, const char *method, const char *target, double et, const char *abcorr, const char *obsrvr, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !method || !target || !abcorr || !obsrvr) return tspice_return_error(err, cap, "Missing legacy plate storage");
  subpt_pl02(handle,&segment.descriptor,method,target,et,abcorr,obsrvr,out,out+3,ids);
  return data_status(err, cap);
}

int tspice_subsol_pl02(int handle, const int *descr, const char *method, const char *target, double et, const char *abcorr, const char *obsrvr, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !method || !target || !abcorr || !obsrvr) return tspice_return_error(err, cap, "Missing legacy plate storage");
  subsol_pl02(handle,&segment.descriptor,method,target,et,abcorr,obsrvr,out,out+3,ids);
  return data_status(err, cap);
}

int tspice_term_pl02(int handle, const int *descr, const char *trmtyp, const char *source, const char *target, double et, const char *fixref, const char *abcorr, const char *obsrvr, int npts, double *out, int *ids, char *err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !ids || !trmtyp || !source || !target || !fixref || !abcorr || !obsrvr) return tspice_return_error(err, cap, "Missing legacy plate storage");
  if (npts > ((268435456-32)/24)) return tspice_return_error(err, cap, "Plate output exceeds buffer bound");
  term_pl02(handle,&segment.descriptor,trmtyp,source,target,et,fixref,abcorr,obsrvr,npts,out,out+1,(double(*)[3])(out+4),ids);
  return data_status(err, cap);
}

static int scalar_integer_item(int item) {
  return item == 1 || item == 2 || item == 3 || (item >= 5 && item <= 8);
}

static int item_page_ok(const DskDataSegment* s, int integers, int item, int start, int room,
                        char* err, int cap) {
  if (start == INT32_MAX)
    return tspice_return_error(err, cap, "Item start plus one exceeds signed 32-bit range");
  if (room <= 0) return 0;  // The Fortran room check precedes address computation.
  int64_t base = 0, offset = 0;
  if (integers) {
    if (scalar_integer_item(item)) {
      if (start != 0)
        return tspice_return_error(err, cap, "Scalar DSK integer items require start zero");
      return 0;
    }
    base = s->descriptor.ibase;
    if (item == 4)
      offset = 4;
    else if (item >= 9 && item <= 14) {
      offset = 11;
      if (item >= 10) offset += 3LL * s->np;
      if (item >= 11) offset += s->npt;
      if (item >= 12) offset += s->npl;
      if (item >= 13) offset += s->nv;
      if (item >= 14) offset += s->nvpl;
    } else
      return 0;
  } else {
    const int offsets[] = {1, 25, 31, 34, 35};
    if (item < 15 || item > 19) return 0;
    offset = offsets[item - 15];
    base = s->descriptor.dbase;
  }
  // The translated expression adds the one-based start before subtracting one.
  if (base + offset + start + 1 > INT32_MAX || base + offset > INT32_MAX)
    return tspice_return_error(err, cap, "DSK item address exceeds signed 32-bit arithmetic");
  return 0;
}

static int data_room(int requested, int words, int stride, int storage, int* effective, char* err,
                     int cap) {
  if (requested < INT32_MIN / stride)
    return tspice_return_error(err, cap, "DSK room times row width exceeds signed 32-bit range");
  // No item or row page can contain more than its entire physical component.
  // Clipping surplus positive room avoids allocating huge unused output tables.
  int rows = words / stride;
  *effective = requested > rows ? rows : requested;
  if (*effective > 0 && (int64_t)*effective * stride > storage)
    return tspice_return_error(err, cap, "Insufficient DSK page output storage");
  return 0;
}

int tspice_dskd02(int handle, const int32_t* descr, int item, int start, int room, int storage,
                  int* count, double* out, char* err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !count || storage < 1)
    return tspice_return_error(err, cap, "Invalid DSK output storage");
  int effective = 0;
  if (data_room(room, descr[5], 1, storage, &effective, err, cap)) return 1;
  *count = 0;
  if (item_page_ok(&segment, 0, item, start, effective, err, cap)) return 1;
  dskd02_c(handle, &segment.descriptor, item, start, effective, count, out);
  if (!failed_c() && (*count < 0 || (int64_t)*count * 1 > storage))
    return tspice_return_error(err, cap, "Invalid returned DSK page count");
  return data_status(err, cap);
}

int tspice_dski02(int handle, const int32_t* descr, int item, int start, int room, int storage,
                  int* count, int* out, char* err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !count || storage < 1)
    return tspice_return_error(err, cap, "Invalid DSK output storage");
  int effective = 0;
  if (data_room(room, descr[3], 1, storage, &effective, err, cap)) return 1;
  *count = 0;
  if (item_page_ok(&segment, 1, item, start, effective, err, cap)) return 1;
  dski02_c(handle, &segment.descriptor, item, start, effective, count, out);
  if (!failed_c() && (*count < 0 || (int64_t)*count * 1 > storage))
    return tspice_return_error(err, cap, "Invalid returned DSK page count");
  return data_status(err, cap);
}

_Static_assert(sizeof(logical)==sizeof(SpiceBoolean) && sizeof(integer)==sizeof(int) &&
               sizeof(doublereal)==sizeof(double) && SPICE_DSK_DSCSIZ==24,
               "Unexpected pinned DSK SPICELIB ABI");

static int finite_ray(const double *v) {
  return v && isfinite(v[0]) && isfinite(v[1]) && isfinite(v[2]);
}

static int intersection_inputs(int pri, const char *target, int nsurf, const int *surfaces,
                               double et, const char *fixref) {
  return (pri == 0 || pri == 1) && target && fixref && strlen(target) < INT_MAX &&
         strlen(fixref) < INT_MAX && nsurf >= 0 && nsurf <= 67108864 && surfaces && isfinite(et);
}

// Match CHKFSTR(CHK_STANDARD) for non-null string inputs in the outer C frame.
static void dsk_empty_string(const char *argument) {
  setmsg_c("String \"#\" has length zero.");
  errch_c("#",argument);
  sigerr_c("SPICE(EMPTYSTRING)");
}

int tspice_dskx02(int handle, const int *descr, const double *vertex, const double *dir, int *plid, double *xpt, int *found, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err,cap);
  if (!finite_ray(vertex) || !finite_ray(dir) || !plid || !xpt || !found)
    return tspice_return_error(err,cap,"Invalid DSKX02 ray or output");
  DskDataSegment segment;
  if (data_segment(handle,descr,&segment,err,cap)) return 1;
  *found = SPICEFALSE;
  dskx02_c(handle,&segment.descriptor,vertex,dir,plid,xpt,found);
  return data_status(err,cap);
}

int tspice_dskxsi(int pri, const char *target, int nsurf, const int *surfaces, double et, const char *fixref, const double *vertex, const double *dir, int maxd, int maxi, double *out, int *ints, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err,cap);
  if (!intersection_inputs(pri,target,nsurf,surfaces,et,fixref) ||
      !finite_ray(vertex) || !finite_ray(dir) || !out || !ints)
    return tspice_return_error(err,cap,"Invalid DSKXSI ray, selection or output");
  // Slots: ints[0]=found, [1]=borrowed DAS handle, [2..9]=DLA, [10]=plate.
  // out[0..2]=point, [3..26]=full native-order SPICELIB DSK descriptor.
  logical priority = pri, found = SPICEFALSE;
  integer handle = 0, dla[8] = {0}, plate = 0;
  double point[3] = {0}, dsk[24] = {0}, unused = 0;
  // In N0067 dskxsi_c converts unwritten descriptor doubles to integers on
  // absence and errors. Use its exact callee and outer tracing with owned,
  // initialized outputs. Only one IC word is defined for type 2; DC is unused.
  int dcap = maxd < 1 ? maxd : 1, icap = maxi < 1 ? maxi : 1;
  chkin_c("dskxsi_c");
  if (!*target) dsk_empty_string("target");
  else if (!*fixref) dsk_empty_string("fixref");
  else dskxsi_(&priority,(char *)target,&nsurf,(int *)surfaces,&et,(char *)fixref,
               (double *)vertex,(double *)dir,&dcap,&icap,point,&handle,dla,dsk,
               &unused,&plate,&found,(ftnlen)strlen(target),(ftnlen)strlen(fixref));
  chkout_c("dskxsi_c");
  if (failed_c()) return data_status(err,cap);
  ints[0] = found != SPICEFALSE;
  if (found) {
    if (dsk[SPICE_DSK_TYPIDX] != 2) return tspice_return_error(err,cap,"Unsupported DSK source metadata");
    for (int i=0;i<6;++i) {
      if (!(dsk[i]>=INT_MIN && dsk[i]<=INT_MAX && trunc(dsk[i])==dsk[i]))
        return tspice_return_error(err,cap,"Invalid DSK integer descriptor field");
    }
    ints[1] = handle;
    memcpy(ints+2,dla,sizeof(dla));
    ints[10] = plate;
    memcpy(out,point,sizeof(point));
    memcpy(out+3,dsk,sizeof(dsk));
  }
  return data_status(err,cap);
}

int tspice_dskxv(int pri, const char *target, int nsurf, const int *surfaces, double et, const char *fixref, int nrays, const double *vertices, const double *dirs, double *out, int *found, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err,cap);
  if (!intersection_inputs(pri,target,nsurf,surfaces,et,fixref) || nrays<0 || nrays>11184810 ||
      !vertices || !dirs || !out || !found) return tspice_return_error(err,cap,"Invalid DSKXV array bounds");
  for (int i=0;i<nrays;++i) if (!finite_ray(vertices+3*i) || !finite_ray(dirs+3*i))
    return tspice_return_error(err,cap,"Expected finite DSK ray components");
  dskxv_c(pri,target,nsurf,surfaces,et,fixref,nrays,(const double (*)[3])vertices,
          (const double (*)[3])dirs,(double (*)[3])out,found);
  return data_status(err,cap);
}

int tspice_dskgtl(int key, double *out, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err,cap);
  if (!out) return tspice_return_error(err,cap,"Missing tolerance output");
  dskgtl_c(key,out);
  return data_status(err,cap);
}

int tspice_dskstl(int key, double value, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err,cap);
  if (!isfinite(value)) return tspice_return_error(err,cap,"Expected finite DSK tolerance");
  dskstl_c(key,value);
  return data_status(err,cap);
}

int tspice_dskn02(int handle, const int32_t* descr, int plid, double* out, char* err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out) return tspice_return_error(err, cap, "Invalid DSK output storage");
  if (plid >= 1 && plid <= segment.np) {
    int indices[3] = {0};
    int begin = segment.descriptor.ibase + 11 + 3 * (plid - 1);
    dasrdi_c(handle, begin, begin + 2, indices);
    if (failed_c()) return data_status(err, cap);
    for (int i = 0; i < 3; ++i)
      if (indices[i] < 1 || indices[i] > segment.nv)
        return tspice_return_error(err, cap, "Plate contains an invalid one-based vertex ID");
  }
  dskn02_c(handle, &segment.descriptor, plid, out);
  return data_status(err, cap);
}

int tspice_dskp02(int handle, const int32_t* descr, int start, int room, int storage, int* count,
                  int* out, char* err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !count || storage < 1)
    return tspice_return_error(err, cap, "Invalid DSK output storage");
  int effective = 0;
  if (data_room(room, descr[3], 3, storage, &effective, err, cap)) return 1;
  *count = 0;
  dskp02_c(handle, &segment.descriptor, start, effective, count, (int (*)[3])out);
  if (!failed_c() && (*count < 0 || (int64_t)*count * 3 > storage))
    return tspice_return_error(err, cap, "Invalid returned DSK page count");
  return data_status(err, cap);
}

int tspice_dskv02(int handle, const int32_t* descr, int start, int room, int storage, int* count,
                  double* out, char* err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out || !count || storage < 1)
    return tspice_return_error(err, cap, "Invalid DSK output storage");
  int effective = 0;
  if (data_room(room, descr[5], 3, storage, &effective, err, cap)) return 1;
  *count = 0;
  dskv02_c(handle, &segment.descriptor, start, effective, count, (double (*)[3])out);
  if (!failed_c() && (*count < 0 || (int64_t)*count * 3 > storage))
    return tspice_return_error(err, cap, "Invalid returned DSK page count");
  return data_status(err, cap);
}

int tspice_dskz02(int handle, const int32_t* descr, int* out, char* err, int cap) {
  DskDataSegment segment = {0};
  if (data_segment(handle, descr, &segment, err, cap)) return 1;
  if (!out) return tspice_return_error(err, cap, "Invalid DSK output storage");
  dskz02_c(handle, &segment.descriptor, out, out + 1);
  return data_status(err, cap);
}

int tspice_dskcls(int handle, int optmiz, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return data_status(err, cap);
  if (optmiz != 0 && optmiz != 1)
    return tspice_return_error(err, cap, "Expected boolean optimize flag");
  dskcls_c(handle, optmiz);
  return data_status(err, cap);
}
