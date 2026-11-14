#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceUsr.h"
#include "SpiceZfc.h"
#include "SpiceZst.h"
#include "SpiceZmc.h"
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

// DAS file headers record reserved records, allocated comment records, and the
// exact used byte count. Unlike DAF, all 1024 bytes of each record are payload.
typedef struct {
  int handle, links, offset, first, end;
} DasCommentReader;
static DasCommentReader das_readers[5000];

static DasCommentReader *das_reader(int handle) {
  for (size_t i = 0; i < 5000; ++i)
    if (das_readers[i].links && das_readers[i].handle == handle)
      return &das_readers[i];
  return NULL;
}
static int das_link(int handle, char *err, int room) {
  DasCommentReader *r = das_reader(handle);
  if (r && r->links < INT_MAX) {
    ++r->links;
    return 0;
  }
  if (!r)
    for (size_t i = 0; i < 5000; ++i)
      if (!das_readers[i].links) {
        das_readers[i] = (DasCommentReader){handle, 1, 0, 0, 0};
        return 0;
      }
  dasllc_c(handle);
  return tspice_return_error(err, room, "Cannot track an additional DAS link");
}
static int das_layout(int h, int *first, int *end, int *records, int *headerError, char *err, int room) {
  *headerError = 0;
  char id[9] = {0}, name[61] = {0};
  int reserved = 0, used = 0;
  dasrfr_c(h, sizeof(id), sizeof(name), id, name, &reserved, &used, records, end);
  if (failed_c()) {
    // Allow the requested routine to produce its original call tree. The DAS
    // file-record reader returns before any comment records on this error.
    reset_c();
    *headerError = 1;
    return 0;
  }
  if (reserved < 0 || reserved > INT_MAX - 2 || *records < 0 || *end < 0 || *end > (int64_t)*records * 1024 ||
      (int64_t)reserved + 2 + (*end / 1024) > INT_MAX ||
      (int64_t)reserved + 2 + (*end / 1024) > LONG_MAX / 1024)
    return tspice_return_error(err, room, "Unsupported DAS comment record extent");
  *first = reserved + 2;
  return 0;
}
static int das_mutation(int handle, int64_t added, int append, char *err, int room) {
  DasCommentReader *r = das_reader(handle);
  // N0067's DDH uses positive handles for read links and negative for writers.
  // Let the actual scientific routine report read-only and unowned handles.
  if (!r || handle >= 0)
    return 0;
  if (r->offset)
    return tspice_return_error(err, room, "Finish the active DAS comment extraction before mutation");
  int first = 0, end = 0, records = 0, headerError = 0;
  if (das_layout(handle, &first, &end, &records, &headerError, err, room))
    return 1;
  if (headerError)
    return 0;
  if (append && ((int64_t)records * 1024 > INT_MAX || end + added > INT_MAX))
    return tspice_return_error(err, room, "DAS comment counters exceed signed storage");
  int64_t after = (end + added + 1023) / 1024;
  int64_t growth = append && after > records ? after - records : 0;
  if ((int64_t)first + records + growth > INT_MAX || (int64_t)first + records + growth > LONG_MAX / 1024)
    return tspice_return_error(err, room, "DAS comment directory exceeds the file seek limit");
  if (growth || (!append && records)) {
    int reserved = 0, used = 0, comr = 0, comc = 0, freeRecord = 0, last[3], locations[3], words[3];
    dashfs_c(handle, &reserved, &used, &comr, &comc, &freeRecord, last, locations, words);
    if (finish_das_call(err, room))
      return 1;
    if (freeRecord < 1 || freeRecord + growth > INT_MAX || freeRecord + growth - 1 > LONG_MAX / 1024)
      return tspice_return_error(err, room, "DAS data relocation exceeds the file seek limit");
  }
  return 0;
}
int tspice_dasac(int handle, int n, int width, const unsigned char *rows, int room, char *err,
                 int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, errMaxBytes))
    return 1;
  if (!rows || n < 0 || width < 2 || (int64_t)n * width > room || room > TSPICE_DAS_COMMENT_BYTES)
    return tspice_return_error(err, errMaxBytes, "Invalid DAS comment input storage");
  int64_t added = n;
  int valid = n > 0;
  for (int i = 0; i < n; i++) {
    const unsigned char *row = rows + (size_t)i * width;
    const unsigned char *stop = memchr(row, 0, width);
    if (!stop)
      return tspice_return_error(err, errMaxBytes, "Missing DAS row terminator");
    int payload = stop - row;
    while (payload && row[payload - 1] == ' ')
      --payload;
    for (int j = 0; j < payload; j++)
      if (row[j] < 32 || row[j] > 126)
        valid = 0;
    added += payload;
  }
  if (valid && das_mutation(handle, added, 1, err, errMaxBytes))
    return 1;
  dasac_c(handle, n, width, rows);
  return finish_das_call(err, errMaxBytes);
}
int tspice_dasdc(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, errMaxBytes) || das_mutation(handle, 0, 0, err, errMaxBytes))
    return 1;
  dasdc_c(handle);
  return finish_das_call(err, errMaxBytes);
}
static void das_width_check(char *buffer, int width) {
  chkin_c("dasec_c");
  CHKOSTR(CHK_STANDARD, "dasec_c", buffer, width);
  chkout_c("dasec_c");
}
static int das_line_error(int width, int row, char *err, int room) {
  chkin_c("dasec_c");
  chkin_c("DASEC");
  // The original message calls the page-relative row number a line length.
  setmsg_c("The output buffer line length (#) was not long enough to contain a comment line with length #.");
  errint_c("#", width - 1);
  errint_c("#", row);
  sigerr_c("SPICE(COMMENTTOOLONG)");
  chkout_c("DASEC");
  chkout_c("dasec_c");
  return finish_das_call(err, room);
}

// Width validation uses independent, actual DASIOC record reads. The only
// caller asking for their payload is the exceptional library handle -1:
// DASEC reserves that same value as its no-cached-record sentinel.
static int das_scan(int h, int first, int begin, int end, int rows, int width, int *next, int *longest,
                    int *count, char *payload, char *err, int room) {
  integer unit = 0;
  logical lock = SPICEFALSE;
  zzddhhlu_(&h, "DAS", &lock, &unit, 3);
  if (finish_das_call(err, room))
    return 1;
  int offset = begin, line = 0, length = 0;
  *longest = 0;
  while (offset < end && line < rows) {
    int rec = first + offset / 1024, j = offset % 1024;
    char record[1024];
    dasioc_("READ", &unit, &rec, record, 4, 1024);
    if (finish_das_call(err, room))
      return 1;
    while (offset < end && line < rows && j < 1024) {
      const unsigned char ch = (unsigned char)record[j++];
      ++offset;
      if (ch) {
        if (++length >= width)
          return das_line_error(width, line + 1, err, room);
        if (payload)
          payload[(size_t)line * (width - 1) + length - 1] = (char)ch;
      } else {
        if (payload)
          memset(payload + (size_t)line * (width - 1) + length, ' ', width - 1 - length);
        if (length > *longest)
          *longest = length;
        length = 0;
        ++line;
      }
    }
  }
  if (length) {
    if (end == INT_MAX)
      return tspice_return_error(err, room, "DAS comment count exceeds signed storage");
    chkin_c("dasec_c");
    chkin_c("DASEC");
    setmsg_c("Count of comment characters (#) exceeds the number of comment characters (#) in the DAS file #.");
    errint_c("#", end + 1);
    errint_c("#", end);
    errfnm_("#", &unit, 1);
    sigerr_c("SPICE(BADDASCOMMENTAREA)");
    chkout_c("DASEC");
    chkout_c("dasec_c");
    return finish_das_call(err, room);
  }
  *next = offset;
  *count = line;
  return 0;
}

static int das_extract(int h, int rows, int width, char *out, int *count, int *done, char *err, int room) {
  logical completed = SPICEFALSE;
  *count = 0;
  chkin_c("dasec_c");
  dasec_(&h, &rows, count, out, &completed, width - 1);
  chkout_c("dasec_c");
  if (finish_das_call(err, room))
    return 1;
  if (*count < 0 || *count > rows)
    return tspice_return_error(err, room, "Invalid DASEC output count");
  if (*count)
    F2C_ConvertTrStrArr(*count, width, out);
  *done = completed != SPICEFALSE;
  return 0;
}
int tspice_dasec(int handle, int rows, int width, unsigned char *out, int room, int *n, int *done, char *err,
                 int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, errMaxBytes))
    return 1;
  if (!out || !n || !done || room < 1 || room > TSPICE_DAS_COMMENT_BYTES ||
      (rows > 0 && width >= 2 && (int64_t)rows * width > room))
    return tspice_return_error(err, errMaxBytes, "Invalid DAS comment output storage");
  if (width < 2) {
    das_width_check((char *)out, width);
    return finish_das_call(err, errMaxBytes);
  }
  if (rows <= 0)
    return das_extract(handle, rows, width, (char *)out, n, done, err, errMaxBytes);
  DasCommentReader *r = das_reader(handle);
  if (!r)
    return tspice_return_error(err, errMaxBytes, "DAS comment extraction requires an owned DAS handle");
  int first = r->first, end = r->end, records = 0, next = 0, longest = 0, count = 0;
  int headerError = 0;
  if (!r->offset && das_layout(handle, &first, &end, &records, &headerError, err, errMaxBytes))
    return 1;
  if (headerError)
    return das_extract(handle, rows, width, (char *)out, n, done, err, errMaxBytes);
  if (!r->offset && end >= TSPICE_DAS_COMMENT_BYTES && handle != -1) {
    if (das_scan(handle, first, 0, end, INT_MAX, INT_MAX, &next, &longest, &count, NULL, err, errMaxBytes))
      return 1;
    if (longest >= TSPICE_DAS_COMMENT_BYTES)
      return tspice_return_error(err, errMaxBytes, "DAS comment line exceeds the cleanup storage bound");
  }
  int sentinel = handle == -1 && end > 0;
  if (end && das_scan(handle, first, r->offset, end, rows, width, &next, &longest, &count,
                      sentinel ? (char *)out : NULL, err, errMaxBytes))
    return 1;
  if (sentinel) {
    F2C_ConvertTrStrArr(count, width, (char *)out);
    *n = count;
    *done = next == end;
  } else if (das_extract(handle, rows, width, (char *)out, n, done, err, errMaxBytes))
    return 1;
  r->offset = *done ? 0 : next;
  r->first = first;
  r->end = end;
  return 0;
}
static int das_before_close(int h, char *err, int room) {
  DasCommentReader *r = das_reader(h);
  if (!r || r->links > 1 || !r->offset || h == -1)
    return 0;
  while (r->offset < r->end) {
    int next = 0, longest = 0, count = 0, done = 0;
    if (das_scan(h, r->first, r->offset, r->end, 64, INT_MAX, &next, &longest, &count, NULL, err, room))
      return 1;
    int width = longest + 1;
    if (width < 2)
      width = 2;
    int rows = TSPICE_DAS_COMMENT_BYTES / width;
    if (rows > 64)
      rows = 64;
    if (rows < 1)
      return tspice_return_error(err, room, "DAS comment line exceeds the cleanup storage bound");
    if (rows < 64 &&
        das_scan(h, r->first, r->offset, r->end, rows, width, &next, &longest, &count, NULL, err, room))
      return 1;
    char *buf = malloc((size_t)rows * width);
    if (!buf)
      return tspice_return_error(err, room, "Cannot allocate DAS comment cleanup storage");
    int rc = das_extract(h, rows, width, buf, &count, &done, err, room);
    free(buf);
    if (rc)
      return rc;
    if (!done && next <= r->offset)
      return tspice_return_error(err, room, "DAS extraction made no progress");
    r->offset = done ? 0 : next;
    if (done)
      break;
  }
  return 0;
}
static void das_closed(int h) {
  DasCommentReader *r = das_reader(h);
  if (r && !--r->links)
    *r = (DasCommentReader){0};
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
  return das_link(value,err,errMaxBytes);
}

int tspice_dasops(int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (!out) return tspice_return_error(err, errMaxBytes, "Invalid dasops storage");
  SpiceInt value = 0;
  dasops_c(&value);
  if (failed_c()) return finish_das_call(err, errMaxBytes);
  *out = value;
  return das_link(value,err,errMaxBytes);
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
  return das_link(value,err,errMaxBytes);
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
  if(das_before_close(handle,err,errMaxBytes))return 1;
  dasllc_c(handle);
  if(finish_das_call(err,errMaxBytes))return 1;
  das_closed(handle);return 0;
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
  return das_link(handleC,err,errMaxBytes);
}

int tspice_dascls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  if(das_before_close(handle,err,errMaxBytes))return 1;
  dascls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  das_closed(handle);return 0;
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
  return das_link(handleC,err,errMaxBytes);
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
  return das_link(handleC,err,errMaxBytes);
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
