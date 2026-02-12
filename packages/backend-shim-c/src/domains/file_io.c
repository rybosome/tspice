#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceUsr.h"
#include "SpiceDLA.h"
#include "SpiceDSK.h"

#include <string.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

// --- ABI guard ---------------------------------------------------------
//
// This shim intentionally exposes 32-bit integers for DLA descriptor fields
// (and many other CSPICE integer surfaces). Refuse to build if the CSPICE
// toolkit was compiled with a non-32-bit SpiceInt to avoid silent truncation.
#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L
_Static_assert(sizeof(SpiceInt) == 4, "tspice_backend_shim requires sizeof(SpiceInt)==4");
#else
typedef char tspice_spiceint_must_be_32bit[(sizeof(SpiceInt) == 4) ? 1 : -1];
#endif



static void tspice_write_dla_descr8(const SpiceDLADescr *descr, int32_t *outDescr8) {
  if (!descr || !outDescr8) return;
  outDescr8[0] = (int32_t)descr->bwdptr;
  outDescr8[1] = (int32_t)descr->fwdptr;
  outDescr8[2] = (int32_t)descr->ibase;
  outDescr8[3] = (int32_t)descr->isize;
  outDescr8[4] = (int32_t)descr->dbase;
  outDescr8[5] = (int32_t)descr->dsize;
  outDescr8[6] = (int32_t)descr->cbase;
  outDescr8[7] = (int32_t)descr->csize;
}

static void tspice_read_dla_descr8(const int32_t *descr8, SpiceDLADescr *outDescr) {
  if (!descr8 || !outDescr) return;
  outDescr->bwdptr = (SpiceInt)descr8[0];
  outDescr->fwdptr = (SpiceInt)descr8[1];
  outDescr->ibase = (SpiceInt)descr8[2];
  outDescr->isize = (SpiceInt)descr8[3];
  outDescr->dbase = (SpiceInt)descr8[4];
  outDescr->dsize = (SpiceInt)descr8[5];
  outDescr->cbase = (SpiceInt)descr8[6];
  outDescr->csize = (SpiceInt)descr8[7];
}

int tspice_exists(const char *path, int *outExists, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outExists) *outExists = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_exists: path must be a non-empty string");
  }

  const SpiceBoolean exists = exists_c(path);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outExists) {
    *outExists = exists == SPICETRUE ? 1 : 0;
  }
  return 0;
}

int tspice_getfat(
    const char *path,
    char *outArch,
    int outArchMaxBytes,
    char *outType,
    int outTypeMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outArch && outArchMaxBytes > 0) outArch[0] = '\0';
  if (outType && outTypeMaxBytes > 0) outType[0] = '\0';

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_getfat: path must be a non-empty string");
  }

  if (!outArch || outArchMaxBytes <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_getfat: outArch must be non-NULL with outArchMaxBytes > 0");
  }

  if (!outType || outTypeMaxBytes <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_getfat: outType must be non-NULL with outTypeMaxBytes > 0");
  }

  getfat_c(path, (SpiceInt)outArchMaxBytes, (SpiceInt)outTypeMaxBytes, outArch, outType);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_dafopr(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dafopr: path must be a non-empty string");
  }

  if (!outHandle) {
    return tspice_return_error(err, errMaxBytes, "tspice_dafopr: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  dafopr_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outHandle) *outHandle = (int)handleC;
  return 0;
}

int tspice_dafcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  dafcls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_dafbfs(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  dafbfs_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_daffna(int handle, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!outFound) {
    return tspice_return_error(err, errMaxBytes, "tspice_daffna: outFound must be non-NULL");
  }

  *outFound = 0;

  // DAF search state is global; select the handle so callers can interleave.
  dafcs_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  SpiceBoolean foundC = SPICEFALSE;
  daffna_c(&foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_dasopr(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dasopr: path must be a non-empty string");
  }

  if (!outHandle) {
    return tspice_return_error(err, errMaxBytes, "tspice_dasopr: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  dasopr_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_dascls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  dascls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_dlacls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  // DLA segments are stored in DAS files; close via DAS close helper.
  return tspice_dascls(handle, err, errMaxBytes);
}


int tspice_dlaopn(
    const char *path,
    const char *ftype,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dlaopn: path must be a non-empty string");
  }

  if (!ftype || ftype[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dlaopn: ftype must be a non-empty string");
  }

  if (!ifname || ifname[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dlaopn: ifname must be a non-empty string");
  }

  if (ncomch < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlaopn: ncomch must be >= 0");
  }

  if (!outHandle) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlaopn: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  dlaopn_c(path, ftype, ifname, (SpiceInt)ncomch, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_dlabfs(int handle, int32_t *outDescr8, int32_t *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  if (!outDescr8) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlabfs: outDescr8 must be non-NULL");
  }
  if (!outFound) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlabfs: outFound must be non-NULL");
  }

  *outFound = 0;
  memset(outDescr8, 0, sizeof(int32_t) * 8);

  SpiceDLADescr descr;
  SpiceBoolean foundC = SPICEFALSE;

  dlabfs_c((SpiceInt)handle, &descr, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outFound = foundC == SPICETRUE ? 1 : 0;
  if (foundC == SPICETRUE) {
    tspice_write_dla_descr8(&descr, outDescr8);
  }
  return 0;
}

int tspice_dlafns(
    int handle,
    const int32_t *descr8,
    int32_t *outNextDescr8,
    int32_t *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  if (!descr8) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlafns: descr8 must be non-NULL");
  }
  if (!outNextDescr8) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlafns: outNextDescr8 must be non-NULL");
  }
  if (!outFound) {
    return tspice_return_error(err, errMaxBytes, "tspice_dlafns: outFound must be non-NULL");
  }

  *outFound = 0;
  memset(outNextDescr8, 0, sizeof(int32_t) * 8);

  SpiceDLADescr current = {0};
  SpiceDLADescr next = {0};
  tspice_read_dla_descr8(descr8, &current);

  SpiceBoolean foundC = SPICEFALSE;
  dlafns_c((SpiceInt)handle, &current, &next, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outFound = foundC == SPICETRUE ? 1 : 0;
  if (foundC == SPICETRUE) {
    tspice_write_dla_descr8(&next, outNextDescr8);
  }

  return 0;
}

// --- DSK (DAS-backed) ------------------------------------------------------

int tspice_dskopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dskopn: path must be a non-empty string");
  }

  if (!ifname || ifname[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dskopn: ifname must be a non-empty string");
  }

  if (ncomch < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskopn: ncomch must be >= 0");
  }

  if (!outHandle) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskopn: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  dskopn_c(path, ifname, (SpiceInt)ncomch, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_dskmi2(
    int nv,
    const double *vrtces,
    int np,
    const int32_t *plates,
    double finscl,
    double corscl,
    int worksz,
    int voxpsz,
    int voxlsz,
    int makvtl,
    int spxisz,
    double *outSpaixd,
    int32_t *outSpaixi,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  if (nv < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: nv must be >= 0");
  }
  if (np < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: np must be >= 0");
  }

  if (worksz < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: worksz must be >= 0");
  }
  if (worksz == 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: worksz must be > 0");
  }
  if (voxpsz < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: voxpsz must be >= 0");
  }
  if (voxlsz < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: voxlsz must be >= 0");
  }
  if (spxisz < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: spxisz must be >= 0");
  }

  if ((nv > 0) && (!vrtces)) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: vrtces must be non-NULL when nv > 0");
  }
  if ((np > 0) && (!plates)) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: plates must be non-NULL when np > 0");
  }
  if (!outSpaixd) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: outSpaixd must be non-NULL");
  }
  if (!outSpaixi) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: outSpaixi must be non-NULL");
  }

  // Fixed-size portion of the double component (SPICE_DSK02_IXDFIX).
  for (int i = 0; i < SPICE_DSK02_IXDFIX; i++) {
    outSpaixd[i] = 0.0;
  }

  if (spxisz > 0) {
    memset(outSpaixi, 0, sizeof(int32_t) * (size_t)spxisz);
  }

  SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) * (size_t)worksz);
  if (!work) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: failed to allocate workspace");
  }

  dskmi2_c(
      (SpiceInt)nv,
      (SpiceDouble(*)[3])vrtces,
      (SpiceInt)np,
      (SpiceInt(*)[3])plates,
      (SpiceDouble)finscl,
      (SpiceInt)corscl,
      (SpiceInt)worksz,
      (SpiceInt)voxpsz,
      (SpiceInt)voxlsz,
      makvtl ? SPICETRUE : SPICEFALSE,
      (SpiceInt)spxisz,
      work,
      outSpaixd,
      (SpiceInt*)outSpaixi);

  free(work);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_dskw02(
    int handle,
    int center,
    int surfid,
    int dclass,
    const char *frame,
    int corsys,
    const double *corpar,
    double mncor1,
    double mxcor1,
    double mncor2,
    double mxcor2,
    double mncor3,
    double mxcor3,
    double first,
    double last,
    int nv,
    const double *vrtces,
    int np,
    const int32_t *plates,
    const double *spaixd,
    const int32_t *spaixi,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  if (!frame || frame[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: frame must be a non-empty string");
  }
  if (!corpar) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: corpar must be non-NULL");
  }

  if (nv < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: nv must be >= 0");
  }
  if (np < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: np must be >= 0");
  }

  if ((nv > 0) && (!vrtces)) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: vrtces must be non-NULL when nv > 0");
  }
  if ((np > 0) && (!plates)) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: plates must be non-NULL when np > 0");
  }

  if (!spaixd) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixd must be non-NULL");
  }
  if (!spaixi) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixi must be non-NULL");
  }

  dskw02_c(
      (SpiceInt)handle,
      (SpiceInt)center,
      (SpiceInt)surfid,
      (SpiceInt)dclass,
      frame,
      (SpiceInt)corsys,
      corpar,
      (SpiceDouble)mncor1,
      (SpiceDouble)mxcor1,
      (SpiceDouble)mncor2,
      (SpiceDouble)mxcor2,
      (SpiceDouble)mncor3,
      (SpiceDouble)mxcor3,
      (SpiceDouble)first,
      (SpiceDouble)last,
      (SpiceInt)nv,
      (SpiceDouble(*)[3])vrtces,
      (SpiceInt)np,
      (SpiceInt(*)[3])plates,
      spaixd,
      (SpiceInt*)spaixi);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
