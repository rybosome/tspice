#include "tspice_backend_shim.h"

#include <math.h>
#include "SpiceZfc.h"
#include "SpiceUsr.h"
#include "SpiceDLA.h"
#include "SpiceDSK.h"

#include "../handle_validation.h"

#include "tspice_error.h"

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

static int plate_status(char* err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, cap);
  return 1;
}

static int plate_mesh_ok(int nv, const double* vertices, int np, const int* plates) {
  return nv >= 0 && nv <= INT32_MAX / (3 * (int)sizeof(double)) && np >= 0 &&
         np <= INT32_MAX / (3 * (int)sizeof(int)) && vertices && plates;
}

// RECGEO calls RECLAT on its private normal even if NEARPT failed before
// assigning a base point. Run the fallible NEARPT component in initialized
// storage under the actual outer frames before DSKRB2 visits the same points.
static int check_geodetic_mesh(int nv, const double* vertices, int np, const int* plates,
                               const double* parameters, char* err, int cap) {
  double re = parameters[0], f = parameters[1];
  if (!nv || re <= 0 || f >= 1) return 0;  // RECGEO diagnoses these parameters first.
  double polar = re - f * re;
  if (!isfinite(polar))
    return tspice_return_error(err, cap, "Planetodetic polar radius exceeds representable range");
  chkin_c("dskrb2_c");
  chkin_c("DSKRB2");
  chkin_c("RECGEO");
  for (int i = 0; i < nv + np && !failed_c(); ++i) {
    double center[3], base[3] = {0}, altitude = 0;
    const double* point;
    if (i < nv)
      point = vertices + 3 * i;
    else {
      const int* index = plates + 3 * (i - nv);
      const double third = 1.0 / 3.0;
      vlcom3_c(third, vertices + 3 * (index[0] - 1), third, vertices + 3 * (index[1] - 1), third,
               vertices + 3 * (index[2] - 1), center);
      point = center;
    }
    nearpt_((doublereal*)point, &re, &re, &polar, base, &altitude);
  }
  chkout_c("RECGEO");
  chkout_c("DSKRB2");
  chkout_c("dskrb2_c");
  return plate_status(err, cap);
}

int tspice_pltar(int nv, const double* vertices, int np, const int* plates, double* out, char* err,
                 int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return plate_status(err, cap);
  if (!plate_mesh_ok(nv, vertices, np, plates) || !out)
    return tspice_return_error(err, cap, "Invalid plate array storage or shape");
  *out = pltar_c(nv, (const SpiceDouble(*)[3])vertices, np, (const SpiceInt(*)[3])plates);
  return plate_status(err, cap);
}

int tspice_pltexp(const double* iverts, double delta, double* out, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return plate_status(err, cap);
  if (!iverts || !out) return tspice_return_error(err, cap, "Invalid plate array storage or shape");
  pltexp_c((const SpiceDouble(*)[3])iverts, delta, (SpiceDouble(*)[3])out);
  return plate_status(err, cap);
}

int tspice_pltnp(const double* point, const double* v1, const double* v2, const double* v3,
                 double* out, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return plate_status(err, cap);
  if (!point || !v1 || !v2 || !v3 || !out)
    return tspice_return_error(err, cap, "Invalid plate array storage or shape");
  pltnp_c(point, v1, v2, v3, out, out + 3);
  return plate_status(err, cap);
}

int tspice_pltnrm(const double* v1, const double* v2, const double* v3, double* out, char* err,
                  int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return plate_status(err, cap);
  if (!v1 || !v2 || !v3 || !out)
    return tspice_return_error(err, cap, "Invalid plate array storage or shape");
  pltnrm_c(v1, v2, v3, out);
  return plate_status(err, cap);
}

int tspice_pltvol(int nv, const double* vertices, int np, const int* plates, double* out, char* err,
                  int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return plate_status(err, cap);
  if (!plate_mesh_ok(nv, vertices, np, plates) || !out)
    return tspice_return_error(err, cap, "Invalid plate array storage or shape");
  *out = pltvol_c(nv, (const SpiceDouble(*)[3])vertices, np, (const SpiceInt(*)[3])plates);
  return plate_status(err, cap);
}

int tspice_dskrb2(int nv, const double* vertices, int np, const int* plates, int corsys, int npar,
                  const double* corpar, double* out, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (failed_c()) return plate_status(err, cap);
  if (!plate_mesh_ok(nv, vertices, np, plates) || !out || !corpar || npar < 0 ||
      (corsys == 4 && npar < 2))
    return tspice_return_error(err, cap, "Invalid plate array storage or shape");
  // The latitudinal and planetodetic branches dereference IDs without checking.
  // Rectangular and unsupported systems do not access plate connectivity.
  if (corsys == 1 || corsys == 4) {
    for (int i = 0; i < np * 3; ++i)
      if (plates[i] < 1 || plates[i] > nv)
        return tspice_return_error(err, cap, "Expected one-based vertex index in the mesh");
  }
  if (corsys == 4 && check_geodetic_mesh(nv, vertices, np, plates, corpar, err, cap)) return 1;
  dskrb2_c(nv, (const SpiceDouble(*)[3])vertices, np, (const SpiceInt(*)[3])plates, corsys, corpar,
           out, out + 1);
  return plate_status(err, cap);
}
