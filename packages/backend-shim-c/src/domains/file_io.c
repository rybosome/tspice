#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceDLA.h"

#include <string.h>

static void tspice_write_dla_descr8(const SpiceDLADescr *descr, int *outDescr8) {
  if (!descr || !outDescr8) return;
  outDescr8[0] = (int)descr->bwdptr;
  outDescr8[1] = (int)descr->fwdptr;
  outDescr8[2] = (int)descr->ibase;
  outDescr8[3] = (int)descr->isize;
  outDescr8[4] = (int)descr->dbase;
  outDescr8[5] = (int)descr->dsize;
  outDescr8[6] = (int)descr->cbase;
  outDescr8[7] = (int)descr->csize;
}

static void tspice_read_dla_descr8(const int *descr8, SpiceDLADescr *outDescr) {
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
  if (errMaxBytes > 0) err[0] = '\0';
  if (outExists) *outExists = 0;

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
  if (errMaxBytes > 0) err[0] = '\0';
  if (outArch && outArchMaxBytes > 0) outArch[0] = '\0';
  if (outType && outTypeMaxBytes > 0) outType[0] = '\0';

  getfat_c(path, (SpiceInt)outArchMaxBytes, (SpiceInt)outTypeMaxBytes, outArch, outType);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_dafopr(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

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
  if (errMaxBytes > 0) err[0] = '\0';

  dafcls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_dafbfs(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';

  dafbfs_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_daffna(int handle, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';
  if (outFound) *outFound = 0;

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

  if (outFound) *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_dasopr(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  SpiceInt handleC = 0;
  dasopr_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outHandle) *outHandle = (int)handleC;
  return 0;
}

int tspice_dascls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';

  dascls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
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
  if (errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  SpiceInt handleC = 0;
  dlaopn_c(path, ftype, ifname, (SpiceInt)ncomch, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outHandle) *outHandle = (int)handleC;
  return 0;
}

int tspice_dlabfs(int handle, int *outDescr8, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';
  if (outFound) *outFound = 0;
  if (outDescr8) memset(outDescr8, 0, sizeof(int) * 8);

  SpiceDLADescr descr;
  SpiceBoolean foundC = SPICEFALSE;

  dlabfs_c((SpiceInt)handle, &descr, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) *outFound = foundC == SPICETRUE ? 1 : 0;
  if (outDescr8 && foundC == SPICETRUE) {
    tspice_write_dla_descr8(&descr, outDescr8);
  }
  return 0;
}

int tspice_dlafns(
    int handle,
    const int *descr8,
    int *outNextDescr8,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (errMaxBytes > 0) err[0] = '\0';
  if (outFound) *outFound = 0;
  if (outNextDescr8) memset(outNextDescr8, 0, sizeof(int) * 8);

  SpiceDLADescr current;
  SpiceDLADescr next;
  tspice_read_dla_descr8(descr8, &current);

  SpiceBoolean foundC = SPICEFALSE;
  dlafns_c((SpiceInt)handle, &current, &next, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) *outFound = foundC == SPICETRUE ? 1 : 0;
  if (outNextDescr8 && foundC == SPICETRUE) {
    tspice_write_dla_descr8(&next, outNextDescr8);
  }

  return 0;
}
