#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceZfc.h"
#include "SpiceUsr.h"
#include "SpiceDLA.h"
#include "SpiceDSK.h"

#include <limits.h>
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

static int finish_das_call(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

static int das_data_invalid(char *err, int errMaxBytes, const char *message) {
  tspice_clear_last_error_buffers();
  return tspice_return_error(err, errMaxBytes, message);
}

static int das_record_words(int type) {
  return type == 1 ? 1024 : type == 2 ? 128 : 256;
}

static int das_data_summary(int handle, int type, int *high, int *freeRecord, char *err, int errMaxBytes) {
  SpiceInt reserved, reservedChars, comments, commentChars, addresses[3], records[3], words[3];
  dashfs_c(handle, &reserved, &reservedChars, &comments, &commentChars, freeRecord, addresses, records, words);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  const int width = das_record_words(type);
  // DASA2L's high address includes every physical word in the last cluster.
  if (addresses[type-1] < 0 || addresses[type-1] > INT_MAX / width * width ||
      *freeRecord <= 0 || *freeRecord > LONG_MAX / 1024LL)
    return das_data_invalid(err, errMaxBytes, "DAS data exceed N0067 signed record/address bounds");
  *high = addresses[type-1];
  return 0;
}

static int check_das_append(int handle, int type, int n, int *oldHigh, char *err, int errMaxBytes) {
  int freeRecord;
  if (das_data_summary(handle, type, oldHigh, &freeRecord, err, errMaxBytes)) return 1;
  if (n <= 0) return 0;
  const int width = das_record_words(type);
  const int room = *oldHigh ? (width - *oldHigh % width) % width : 0;
  const int64_t extra = (int64_t)n - room;
  const int64_t records = extra > 0 ? (extra + width - 1) / width : 0;
  // DASCUD rounds the logical cluster size up and can add a directory record.
  if ((int64_t)*oldHigh + n > INT_MAX / width * width ||
      (int64_t)freeRecord + records + (records ? 1 : 0) > INT_MAX ||
      (int64_t)freeRecord + records > LONG_MAX / 1024LL || extra + width > INT_MAX)
    return das_data_invalid(err, errMaxBytes, "DAS append exceeds N0067 signed record/address bounds");
  return 0;
}

// DASAD* supplies its complete static record on a newly allocated record.
// Clear only the unused tail of the new last record, in the same DAS buffer.
// DASUR* updates an existing physical record without flushing or allocating.
static int clear_new_das_tail(int handle, int type, int oldHigh, int n, char *err, int errMaxBytes) {
  if (n <= 0) return 0;
  const int width = das_record_words(type);
  const int room = oldHigh ? (width - oldHigh % width) % width : 0;
  int high = oldHigh + n;
  if (n <= room || high % width == 0) return 0;
  integer base, size, rec, word;
  dasa2l_(&handle, &type, &high, &base, &size, &rec, &word);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  integer first = word + 1, last = width;
  if (type == 1) {
    char zero[1024] = {0};
    dasurc_(&handle, &rec, &first, &last, zero, (ftnlen)(last - first + 1));
  } else if (type == 2) {
    doublereal zero[128] = {0};
    dasurd_(&handle, &rec, &first, &last, zero);
  } else {
    integer zero[256] = {0};
    dasuri_(&handle, &rec, &first, &last, zero);
  }
  return finish_das_call(err, errMaxBytes);
}

// A read validates only its first address. If last is outside the logical
// stream but inside an allocated physical record, never hand out its padding.
static int check_das_read(int handle, int type, int first, int last, const char *outer, char *err, int errMaxBytes) {
  int high, freeRecord;
  if (das_data_summary(handle, type, &high, &freeRecord, err, errMaxBytes)) return 1;
  int invalid = first < 1 || first > high ? first : last;
  if (invalid < 1 || invalid > high) {
    integer base, size, rec, word;
    chkin_c(outer);
    dasa2l_(&handle, &type, &invalid, &base, &size, &rec, &word);
    chkout_c(outer);
    return finish_das_call(err, errMaxBytes);
  }
  return 0;
}

static int das_char_layout(int bpos, int epos, int datlen, char *err, int errMaxBytes) {
  // The C adapter adds one to both indices; the Fortran loops can also
  // advance the current character one beyond the one-based end position.
  if (bpos == INT_MAX || epos == INT_MAX || (epos == INT_MAX-1 && epos < datlen))
    return das_data_invalid(err, errMaxBytes, "DAS character positions exceed N0067 index bounds");
  return 0;
}

static int das_valid_slice(int bpos, int epos, int datlen) {
  return bpos >= 0 && epos >= bpos && epos < datlen;
}

static int check_das_rows(int64_t n, int bpos, int epos, int datlen, int length, char *err, int errMaxBytes) {
  if (n <= 0 || !das_valid_slice(bpos, epos, datlen)) return 0;
  int64_t width = (int64_t)epos - bpos + 1;
  if (((n - 1) / width + 1) * datlen > length)
    return das_data_invalid(err, errMaxBytes, "DAS character buffer lacks complete source or destination rows");
  return 0;
}

// DASUDC compares the continuing source column with the substring width,
// instead of its end position, after the first physical record. Track its
// row cursor at record boundaries before allowing the actual update.
static int check_das_update_rows(int first, int last, int bpos, int epos, int datlen, int length,
                                 char *err, int errMaxBytes) {
  int64_t remaining = (int64_t)last - first + 1;
  if (remaining <= 0 || !das_valid_slice(bpos, epos, datlen)) return 0;
  if (check_das_rows(remaining, bpos, epos, datlen, length, err, errMaxBytes)) return 1;
  if (!bpos || first < 1) return 0;
  int64_t width = (int64_t)epos - bpos + 1, row = 0, column = bpos;
  int space = 1024 - (first-1) % 1024;
  int initial = 1;
  while (remaining > 0) {
    int64_t chunk = remaining < space ? remaining : space;
    if (column >= (initial ? (int64_t)epos + 1 : width)) {
      ++row;
      column = bpos;
    }
    int64_t advance = column - bpos + chunk;
    row += (advance - 1) / width;
    column = bpos + (advance - 1) % width + 1;
    if ((row + 1) * datlen > length)
      return das_data_invalid(err, errMaxBytes, "DASUDC needs an additional source row at a physical record boundary");
    remaining -= chunk;
    initial = 0;
    space = 1024;
  }
  return 0;
}

int tspice_dasadc(int handle, int n, int bpos, int epos, int datlen, const unsigned char *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  if (das_char_layout(bpos, epos, datlen, err, errMaxBytes)) return 1;
  int oldHigh = 0;
  if (check_das_rows(n, bpos, epos, datlen, length, err, errMaxBytes)) return 1;
  if (das_valid_slice(bpos, epos, datlen) && check_das_append(handle, 1, n, &oldHigh, err, errMaxBytes)) return 1;
  dasadc_c(handle, n, bpos, epos, datlen, data);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  return clear_new_das_tail(handle, 1, oldHigh, n, err, errMaxBytes);
}

int tspice_dasadd(int handle, int n, const double *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  int oldHigh = 0;
  if (n > length) return das_data_invalid(err, errMaxBytes, "DAS append count exceeds input length");
  if (check_das_append(handle, 2, n, &oldHigh, err, errMaxBytes)) return 1;
  dasadd_c(handle, n, data);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  return clear_new_das_tail(handle, 2, oldHigh, n, err, errMaxBytes);
}

int tspice_dasadi(int handle, int n, const int *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  int oldHigh = 0;
  if (n > length) return das_data_invalid(err, errMaxBytes, "DAS append count exceeds input length");
  if (check_das_append(handle, 3, n, &oldHigh, err, errMaxBytes)) return 1;
  dasadi_c(handle, n, data);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  return clear_new_das_tail(handle, 3, oldHigh, n, err, errMaxBytes);
}

int tspice_dasrdc(int handle, int first, int last, int bpos, int epos, int datlen, unsigned char *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  if (das_char_layout(bpos, epos, datlen, err, errMaxBytes)) return 1;
  if (das_valid_slice(bpos, epos, datlen) && check_das_read(handle, 1, first, last, "dasrdc_c", err, errMaxBytes)) return 1;
  if (check_das_rows((int64_t)last - first + 1, bpos, epos, datlen, length, err, errMaxBytes)) return 1;
  dasrdc_c(handle, first, last, bpos, epos, datlen, data);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasrdd(int handle, int first, int last, double *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  if (check_das_read(handle, 2, first, last, "dasrdd_c", err, errMaxBytes)) return 1;
  if ((int64_t)last - first + 1 > length) return das_data_invalid(err, errMaxBytes, "DAS read range exceeds output capacity");
  dasrdd_c(handle, first, last, data);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasrdi(int handle, int first, int last, int *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  if (check_das_read(handle, 3, first, last, "dasrdi_c", err, errMaxBytes)) return 1;
  if ((int64_t)last - first + 1 > length) return das_data_invalid(err, errMaxBytes, "DAS read range exceeds output capacity");
  dasrdi_c(handle, first, last, data);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasudc(int handle, int first, int last, int bpos, int epos, int datlen, const unsigned char *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  if (das_char_layout(bpos, epos, datlen, err, errMaxBytes)) return 1;
  int high, freeRecord;
  if (das_data_summary(handle, 1, &high, &freeRecord, err, errMaxBytes)) return 1;
  if (first >= 1 && first <= high && last >= 1 && last <= high) {
    if (check_das_update_rows(first, last, bpos, epos, datlen, length, err, errMaxBytes)) return 1;
  }
  dasudc_c(handle, first, last, bpos, epos, datlen, data);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasudd(int handle, int first, int last, const double *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  int high, freeRecord;
  if (das_data_summary(handle, 2, &high, &freeRecord, err, errMaxBytes)) return 1;
  if (first >= 1 && first <= high && last >= 1 && last <= high) {
    if ((int64_t)last - first + 1 > length) return das_data_invalid(err, errMaxBytes, "DAS update range exceeds input length");
  }
  dasudd_c(handle, first, last, data);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasudi(int handle, int first, int last, const int *data, int length, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!data || length < 0 || (size_t)length > TSPICE_DAS_DATA_MAX_BYTES / sizeof(*data)) return das_data_invalid(err, errMaxBytes, "Invalid DAS transfer buffer");
  int high, freeRecord;
  if (das_data_summary(handle, 3, &high, &freeRecord, err, errMaxBytes)) return 1;
  if (first >= 1 && first <= high && last >= 1 && last <= high) {
    if ((int64_t)last - first + 1 > length) return das_data_invalid(err, errMaxBytes, "DAS update range exceeds input length");
  }
  dasudi_c(handle, first, last, data);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasonw(const char *path, const char *ftype, const char *ifname, int ncomr, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!path || !ftype || !ifname || !out) return tspice_return_error(err, errMaxBytes, "Invalid dasonw storage");
  // The DDH filename field is 255 bytes; never open a silently truncated path.
  if (strlen(path) >= TSPICE_DAS_PATH_BYTES)
    return tspice_return_error(err, errMaxBytes, "DAS physical pathname exceeds 255 bytes");
  // DASONW stores ncomr+3 in a SpiceInt and DUE seeks to the end of
  // record ncomr+2 through a signed C long offset (32 bits in wasm32).
  if (ncomr > INT_MAX - 3 || (long long)ncomr + 2 > LONG_MAX / 1024)
    return tspice_return_error(err, errMaxBytes, "DAS comment records exceed the addressable file range");
  SpiceInt value = 0;
  dasonw_c(path, ftype, ifname, ncomr, &value);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  *out = value;
  return 0;
}

int tspice_dasops(int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_return_error(err, errMaxBytes, "Invalid dasops storage");
  SpiceInt value = 0;
  dasops_c(&value);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  *out = value;
  return 0;
}

int tspice_dasopw(const char *path, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!path || !out) return tspice_return_error(err, errMaxBytes, "Invalid dasopw storage");
  // The DDH filename field is 255 bytes; never open a silently truncated path.
  if (strlen(path) >= TSPICE_DAS_PATH_BYTES)
    return tspice_return_error(err, errMaxBytes, "DAS physical pathname exceeds 255 bytes");
  SpiceInt value = 0;
  dasopw_c(path, &value);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  *out = value;
  return 0;
}

int tspice_dashfn(int handle, int namlen, char *name, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!name || namlen > TSPICE_DAS_PATH_BYTES) return tspice_return_error(err, errMaxBytes, "Invalid dashfn storage");
  // INQUIRE does not write a filename for an unnamed scratch unit.
  // Initialize every available byte before CSPICE's Fortran-string conversion.
  if (namlen > 0) memset(name, 0, (size_t)namlen);
  dashfn_c(handle, namlen, name);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dashfs(int handle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_return_error(err, errMaxBytes, "Invalid dashfs storage");
  SpiceInt values[14] = {0};
  dashfs_c(handle, values + 0, values + 1, values + 2, values + 3, values + 4, values + 5, values + 8, values + 11);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  memcpy(out, values, sizeof(values));
  return 0;
}

int tspice_daslla(int handle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_return_error(err, errMaxBytes, "Invalid daslla storage");
  SpiceInt values[3] = {0};
  daslla_c(handle, values, values + 1, values + 2);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  memcpy(out, values, sizeof(values));
  return 0;
}

int tspice_dasllc(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  dasllc_c(handle);
  return finish_das_call(err, errMaxBytes);
}

int tspice_dasrfr(int handle, int idwlen, int ifnlen, char *idword, char *ifname, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!idword || !ifname || !out || idwlen > TSPICE_DAS_ID_BYTES || ifnlen > TSPICE_DAS_IFNAME_BYTES) return tspice_return_error(err, errMaxBytes, "Invalid dasrfr storage");
  if (idwlen > 0) memset(idword, 0, (size_t)idwlen);
  if (ifnlen > 0) memset(ifname, 0, (size_t)ifnlen);
  SpiceInt values[4] = {0};
  dasrfr_c(handle, idwlen, ifnlen, idword, ifname, values, values + 1, values + 2, values + 3);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  memcpy(out, values, sizeof(values));
  return 0;
}

int tspice_daswbr(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  daswbr_c(handle);
  return finish_das_call(err, errMaxBytes);
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
    int corscl,
    int worksz,
    int voxpsz,
    int voxlsz,
    int makvtl,
    int spxisz,
    double *outSpaixd,
    int outSpaixdLen,
    int32_t *outSpaixi,
    int outSpaixiLen,
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

  if (outSpaixdLen < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: outSpaixdLen must be >= 0");
  }
  if (outSpaixdLen < SPICE_DSK02_IXDFIX) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: outSpaixdLen must be >= SPICE_DSK02_IXDFIX");
  }
  if (outSpaixiLen < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: outSpaixiLen must be >= 0");
  }
  if (outSpaixiLen < spxisz) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: outSpaixiLen must be >= spxisz");
  }

  // Fixed-size portion of the double component (SPICE_DSK02_IXDFIX).
  for (int i = 0; i < SPICE_DSK02_IXDFIX; i++) {
    outSpaixd[i] = 0.0;
  }

  if (spxisz > 0) {
    memset(outSpaixi, 0, sizeof(int32_t) * (size_t)spxisz);
  }

  if ((size_t)worksz > SIZE_MAX / sizeof(SpiceInt[2])) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskmi2: worksz overflow while allocating workspace");
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
    int spaixdLen,
    const int32_t *spaixi,
    int spaixiLen,
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

  if (spaixdLen < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixdLen must be >= 0");
  }
  if (spaixdLen < SPICE_DSK02_IXDFIX) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixdLen must be >= SPICE_DSK02_IXDFIX");
  }
  if (spaixiLen < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixiLen must be >= 0");
  }
  if (spaixiLen < SPICE_DSK02_IXIFIX) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixiLen must be >= SPICE_DSK02_IXIFIX");
  }

  /* N0067 reads these variable arrays after the fixed coarse-grid block.
     It reads NV vertex pointers even when the vertex-plate list is absent.
     Validate backing before CSPICE computes offsets or dereferences storage. */
  const int32_t voxelPointers = spaixi[SPICE_DSK02_SIVXNP];
  const int32_t voxelList = spaixi[SPICE_DSK02_SIVXNL];
  const int32_t vertexList = spaixi[SPICE_DSK02_SIVTNL];
  if (voxelPointers < 0 || voxelList < 0 || vertexList < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixi component lengths must be nonnegative");
  }
  const uint64_t required = (uint64_t)SPICE_DSK02_IXIFIX +
      (uint64_t)voxelPointers + (uint64_t)voxelList + (uint64_t)nv + (uint64_t)vertexList;
  if (required > (uint64_t)spaixiLen) {
    return tspice_return_error(err, errMaxBytes, "tspice_dskw02: spaixi is too short for its declared index components");
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
