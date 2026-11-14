#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceUsr.h"
#include "SpiceZfc.h"
#include "SpiceZst.h"
#include "SpiceZmc.h"
#include "SpiceDLA.h"
#include "SpiceDSK.h"

#include <limits.h>
#include <math.h>
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

_Static_assert(sizeof(logical) == sizeof(SpiceBoolean) && sizeof(logical) == 4,
               "Unexpected DAF search logical ABI");
_Static_assert(sizeof(SpiceDouble) == 8, "Unexpected DAF summary word size");

static int DafStatus(char *err, int room) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, room);
  return 1;
}

// DAFPS and DAFUS copy one equivalenced word even when the effective
// integer count is zero. With ND=125 this requires a private 126th word.
static void summary_layout(int nd, int ni, int *n, int *m, int *bytes) {
  *n = nd < 0 ? 0 : nd > 125 ? 125 : nd;
  const int maxInts = 250 - 2 * *n;
  *m = ni < 0 ? 0 : ni > maxInts ? maxInts : ni;
  *bytes = 8 * (*n + (*m + 1) / 2);
}

int tspice_dafps(int nd, int ni, const double *dc, int dcCount, const int *ic, int icCount,
                 unsigned char *out, int room, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  int n, m, bytes;
  summary_layout(nd, ni, &n, &m, &bytes);
  if (!dc || !ic || !out || dcCount < n || icCount < m || room < bytes)
    return tspice_return_error(err, errMaxBytes, "Insufficient DAFPS storage");
  SpiceDouble words[126] = {0};
  dafps_c(nd, ni, dc, ic, words);
  if (DafStatus(err, errMaxBytes))
    return 1;
  memcpy(out, words, (size_t)bytes);
  // The unused last integer slot belongs to toolkit scratch from prior calls.
  if (m % 2)
    memset(out + bytes - 4, 0, 4);
  return 0;
}

int tspice_dafus(const unsigned char *summary, int size, int nd, int ni, double *dc, int dcRoom,
                 int *ic, int icRoom, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  int n, m, bytes;
  summary_layout(nd, ni, &n, &m, &bytes);
  if (!summary || !dc || !ic || size < bytes || dcRoom < n || icRoom < m)
    return tspice_return_error(err, errMaxBytes, "Insufficient DAFUS storage");
  SpiceDouble words[126] = {0};
  memcpy(words, summary, (size_t)bytes);
  dafus_c(words, nd, ni, dc, ic);
  return DafStatus(err, errMaxBytes);
}

// Non-native ZZDAFGSR translates the record's third word into a loop bound
// before it has checked whether the summaries fit. Inspect that control word
// through the uncached numeric record reader, leaving the DAF record cache
// untouched. The caller still supplies a real summary record or an EOF probe.
static int check_summary_record(int handle, int recno, char *err, int errMaxBytes) {
  logical native = SPICEFALSE, known = SPICEFALSE;
  zzddhisn_(&handle, &native, &known);
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (!known || native)
    return 0;
  SpiceDouble control[128] = {0};
  logical found = SPICEFALSE;
  zzdafgdr_(&handle, &recno, control, &found);
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (!found)
    return 0;
  SpiceInt nd = 0, ni = 0;
  dafhsf_c(handle, &nd, &ni);
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (nd < 0 || nd > 124 || ni < 2 || ni > 250 || nd + (ni + 1) / 2 > 125)
    return tspice_return_error(err, errMaxBytes, "Invalid DAF summary file format");
  const double count = control[2];
  if (!isfinite(count) || count < 0 || count > 125 / (nd + (ni + 1) / 2) || trunc(count) != count)
    return tspice_return_error(err, errMaxBytes, "Invalid non-native DAF summary record count");
  return 0;
}

int tspice_dafgsr(int handle, int recno, int begin, int end, unsigned char *out, int room,
                  int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (recno > 0 && (int64_t)(recno - 1) * 1024 > LONG_MAX)
    return tspice_return_error(err, errMaxBytes, "DAF record exceeds platform seek range");
  int first = begin < 1 ? 1 : begin;
  int last = end > 128 ? 128 : end;
  // DAFRWD forms its source pointer even for an empty slice. Use a valid
  // first word and an empty interval, keeping the actual record lookup.
  if (first > last) {
    first = 1;
    last = 0;
  }
  const int bytes = (last - first + 1) * 8;
  if (!out || !outFound || room < bytes)
    return tspice_return_error(err, errMaxBytes, "Insufficient DAFGSR storage");
  if (check_summary_record(handle, recno, err, errMaxBytes))
    return 1;
  SpiceDouble words[128] = {0};
  SpiceBoolean found = SPICEFALSE;
  dafgsr_c(handle, recno, first, last, words, &found);
  if (DafStatus(err, errMaxBytes))
    return 1;
  *outFound = found != SPICEFALSE;
  if (*outFound)
    memcpy(out, words, (size_t)bytes);
  return 0;
}

int tspice_dafrfr(int handle, int ifnlen, char *ifname, int room, int *fields, char *err,
                  int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  const int length = ifnlen > 61 ? 61 : ifnlen;
  if (!ifname || !fields || length < 1 || room < length)
    return tspice_return_error(err, errMaxBytes, "Invalid DAFRFR name capacity");
  memset(ifname, 0, (size_t)length);
  dafrfr_c(handle, length, &fields[0], &fields[1], ifname, &fields[2], &fields[3], &fields[4]);
  return DafStatus(err, errMaxBytes);
}

static int check_address_storage(int begin, int end, int room, char *err, int errMaxBytes) {
  // Invalid address ordering is diagnosed by the actual CSPICE routine.
  if (begin <= 0 || end < begin)
    return 0;
  const int64_t words = (int64_t)end - begin + 1;
  if ((int64_t)((end - 1) / 128) * 1024 > LONG_MAX)
    return tspice_return_error(err, errMaxBytes, "DAF address exceeds platform seek range");
  if (words > 33554432 || words > room)
    return tspice_return_error(err, errMaxBytes, "Insufficient DAF address output storage");
  return 0;
}

int tspice_dafrda(int handle, int begin, int end, double *words, int room, char *err,
                  int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (!words)
    return tspice_return_error(err, errMaxBytes, "Missing DAFRDA output storage");
  int bad = check_address_storage(begin, end, room, err, errMaxBytes);
  if (bad)
    return bad;
  dafrda_c(handle, begin, end, words);
  return DafStatus(err, errMaxBytes);
}

int tspice_dafgda(int handle, int begin, int end, double *words, int room, char *err,
                  int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (!words)
    return tspice_return_error(err, errMaxBytes, "Missing DAFGDA output storage");
  int bad = check_address_storage(begin, end, room, err, errMaxBytes);
  if (bad)
    return bad;
  dafgda_c(handle, begin, end, words);
  return DafStatus(err, errMaxBytes);
}

int tspice_dafbbs(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  dafbbs_c(handle);
  return DafStatus(err, errMaxBytes);
}

int tspice_dafcs(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  dafcs_c(handle);
  return DafStatus(err, errMaxBytes);
}

int tspice_daffpa(int handle, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!outFound) return tspice_return_error(err, errMaxBytes, "Missing DAF search output");
  dafcs_c(handle);
  if (DafStatus(err, errMaxBytes)) return 1;
  // daffpa_c copies its uninitialized private fnd even on early errors.
  logical found = SPICEFALSE;
  chkin_c("daffpa_c");
  daffpa_(&found);
  chkout_c("daffpa_c");
  if (DafStatus(err, errMaxBytes)) return 1;
  *outFound = found != SPICEFALSE;
  return 0;
}

int tspice_dafgh(int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!outHandle) return tspice_return_error(err, errMaxBytes, "Missing DAF handle output");
  SpiceInt handle = 0;
  dafgh_c(&handle);
  if (DafStatus(err, errMaxBytes)) return 1;
  *outHandle = handle;
  return 0;
}

int tspice_dafgn(int handle, int namlen, char *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || namlen > TSPICE_DAF_NAME_BYTES)
    return tspice_return_error(err, errMaxBytes, "Invalid DAF name storage");
  dafcs_c(handle);
  if (DafStatus(err, errMaxBytes)) return 1;
  // N0067 also applies F2C_ConvertStr to the buffer on a search error.
  if (namlen > 0) memset(out, 0, (size_t)namlen);
  dafgn_c(namlen, out);
  return DafStatus(err, errMaxBytes);
}

int tspice_dafgs(int handle, unsigned char *out, int room, int *bytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!out || !bytes || room < TSPICE_DAF_SUMMARY_BYTES)
    return tspice_return_error(err, errMaxBytes, "Invalid DAF packed summary storage");
  dafcs_c(handle);
  if (DafStatus(err, errMaxBytes)) return 1;
  SpiceInt nd = 0, ni = 0;
  dafhsf_c(handle, &nd, &ni);
  if (DafStatus(err, errMaxBytes)) return 1;
  if (nd < 0 || nd > 124 || ni < 2 || ni > 250 || nd + (ni + 1) / 2 > 125)
    return tspice_return_error(err, errMaxBytes, "Invalid DAF summary format");
  SpiceDouble summary[TSPICE_DAF_SUMMARY_BYTES / sizeof(SpiceDouble)] = {0};
  dafgs_c(summary);
  if (DafStatus(err, errMaxBytes)) return 1;
  *bytes = (int)sizeof(SpiceDouble) * (nd + (ni + 1) / 2);
  memcpy(out, summary, (size_t)*bytes);
  return 0;
}

int tspice_dafhsf(int handle, int *nd, int *ni, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!nd || !ni) return tspice_return_error(err, errMaxBytes, "Missing DAF summary format outputs");
  SpiceInt doubles = 0, integers = 0;
  dafhsf_c(handle, &doubles, &integers);
  if (DafStatus(err, errMaxBytes)) return 1;
  *nd = doubles;
  *ni = integers;
  return 0;
}

// The pinned DAFEC cursor is shared by every open link to a file. The original
// routine releases its private slot only at EOF. Keep the number of local DAF
// links and the next byte offset under the same process mutex as the DAF call.
typedef struct {
  int handle, links, writable, offset, end;
} DafCommentReader;
static DafCommentReader daf_readers[5000];

static DafCommentReader *comment_reader(int handle) {
  for (size_t i = 0; i < 5000; ++i)
    if (daf_readers[i].links && daf_readers[i].handle == handle)
      return &daf_readers[i];
  return NULL;
}

static int remember_daf_link(int handle, int writable, char *err, int room) {
  DafCommentReader *r = comment_reader(handle);
  if (r && r->links < INT_MAX) {
    ++r->links;
    return 0;
  }
  if (!r)
    for (size_t i = 0; i < 5000; ++i) {
      if (!daf_readers[i].links) {
        daf_readers[i] = (DafCommentReader){handle, 1, writable, 0, 0};
        return 0;
      }
    }
  dafcls_c(handle);
  return tspice_return_error(err, room, "Cannot register an additional DAF open link");
}

// DAFAC/DAFDC can move every summary/data record. Their pinned arithmetic
// assumes the ordinary, supported DAF layout and representable record seeks.
static int comment_header(int handle, int *first, int *freeWord, char *err, int room) {
  SpiceInt nd = 0, ni = 0, bward = 0;
  SpiceChar name[61] = {0};
  dafrfr_c(handle, sizeof(name), &nd, &ni, name, first, &bward, freeWord);
  if (DafStatus(err, room))
    return 1;
  if (nd < 0 || nd > 124 || ni < 2 || ni > 250 || nd + (ni + 1) / 2 > 125 || *first < 2 ||
      *first > INT_MAX / 1000 + 2 || bward < *first || *freeWord < 1)
    return tspice_return_error(err, room, "Unsupported DAF comment record layout");
  return 0;
}

static int seekable_record(int64_t record) { return record >= 1 && record - 1 <= LONG_MAX / 1024; }

// N0067 counts 1000 bytes per reserved DAF comment record. Unused trailing
// records contain zeros. Inspect only the tail needed to find the EOC marker.
static int comment_end(int handle, int first, int *end, char *err, int room) {
  char record[1000];
  *end = 0;
  for (int nr = first - 1; nr >= 2; --nr) {
    if (!seekable_record(nr))
      return tspice_return_error(err, room, "DAF comment seek exceeds platform range");
    dafrcr_(&handle, &nr, record, 1000);
    if (DafStatus(err, room))
      return 1;
    const char *marker = memchr(record, 4, sizeof(record));
    if (marker) {
      int64_t size = (int64_t)(nr - 2) * 1000 + (marker - record);
      if (size >= INT_MAX)
        return tspice_return_error(err, room, "DAF comment area exceeds signed counter range");
      *end = (int)size;
      return 0;
    }
    for (size_t i = 0; i < sizeof(record); i++)
      if (record[i]) {
        // The original routine diagnoses the missing EOC before reading output.
        *end = -1;
        return 0;
      }
  }
  return 0;
}

static int active_mutation(int handle, char *err, int room) {
  DafCommentReader *r = comment_reader(handle);
  if (r && r->writable && r->offset)
    return tspice_return_error(err, room,
                               "Finish the active DAF comment extraction before changing its comment area");
  return 0;
}

int tspice_dafac(int handle, int n, int width, const unsigned char *rows, int room, char *err,
                 int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (n < 0 || width < 2 || !rows || (int64_t)n * width > room || room > TSPICE_DAF_PAGE_BYTES)
    return tspice_return_error(err, errMaxBytes, "Invalid DAF comment input storage");
  int64_t added = 1 + n;
  int ordinary = n > 0;
  for (int i = 0; i < n; i++) {
    const unsigned char *row = rows + (size_t)i * width;
    const unsigned char *z = memchr(row, 0, (size_t)width);
    if (!z)
      return tspice_return_error(err, errMaxBytes, "Missing DAF comment string terminator");
    int length = (int)(z - row);
    while (length && row[length - 1] == ' ')
      --length;
    added += length;
    for (int j = 0; j < length; j++)
      if (row[j] < 32 || row[j] > 126)
        ordinary = 0;
  }
  if (ordinary) {
    // Read-only access and illegal characters have their own upstream errors.
    // A partial extraction cannot be mutated, including through another alias.
    if (active_mutation(handle, err, errMaxBytes))
      return 1;
    int first = 0, freeWord = 0;
    if (comment_header(handle, &first, &freeWord, err, errMaxBytes))
      return 1;
    int64_t maxGrowth = (added + 999) / 1000;
    if ((int64_t)(first - 2) * 1000 + added >= INT_MAX || freeWord + 128 * maxGrowth > INT_MAX ||
        !seekable_record((freeWord - 1) / 128 + 1 + maxGrowth)) {
      int end = 0;
      if (comment_end(handle, first, &end, err, errMaxBytes))
        return 1;
      if (end >= 0) {
        int64_t used = end + added, required = (used + 999) / 1000, growth = required - (first - 2);
        if (growth < 0)
          growth = 0;
        if (used >= INT_MAX || (int64_t)freeWord + 128 * growth > INT_MAX ||
            !seekable_record((freeWord - 1) / 128 + 1 + growth))
          return tspice_return_error(err, errMaxBytes,
                                     "DAF comment growth exceeds the address or seek limit");
      }
    }
  }
  dafac_c(handle, n, width, rows);
  return DafStatus(err, errMaxBytes);
}

int tspice_dafdc(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes) || active_mutation(handle, err, errMaxBytes))
    return 1;
  int first = 0, freeWord = 0;
  if (comment_header(handle, &first, &freeWord, err, errMaxBytes))
    return 1;
  if (first > 2 && !seekable_record((freeWord - 1) / 128 + 1))
    return tspice_return_error(err, errMaxBytes, "DAF comment deletion exceeds platform seek range");
  dafdc_c(handle);
  return DafStatus(err, errMaxBytes);
}

static void comment_width_check(char *buffer, int width) {
  // Reuse the public C adapter's exact early output-width diagnostic.
  chkin_c("dafec_c");
  CHKOSTR(CHK_STANDARD, "dafec_c", buffer, width);
  chkout_c("dafec_c");
}

static int comment_line_error(int width, int row, char *err, int room) {
  chkin_c("dafec_c");
  chkin_c("DAFEC");
  setmsg_c("The output buffer line length (#) was not long enough to contain comment line #.");
  errint_c("#", width - 1);
  errint_c("#", row);
  sigerr_c("SPICE(COMMENTTOOLONG)");
  chkout_c("DAFEC");
  chkout_c("dafec_c");
  return DafStatus(err, room);
}

// A failed cross-record extraction can overwrite DAFEC's private record cache
// without advancing its saved position. Check widths on the original records
// without touching that cache. Return only the lines produced by real DAFEC.
static int scan_page(int h, int begin, int end, int rows, int width, int *next, int *longest, char *err,
                     int room) {
  int offset = begin, line = 0, length = 0;
  char record[1000];
  *longest = 0;
  while (offset < end && line < rows) {
    int nr = 2 + offset / 1000, j = offset % 1000;
    dafrcr_(&h, &nr, record, 1000);
    if (DafStatus(err, room))
      return 1;
    while (j < 1000 && offset < end && line < rows) {
      ++offset;
      if (record[j++]) {
        if (++length >= width)
          return comment_line_error(width, line + 1, err, room);
      } else {
        if (length > *longest)
          *longest = length;
        length = 0;
        ++line;
      }
    }
  }
  *next = offset;
  return 0;
}

static int extract_rows(int handle, int rows, int width, char *out, int *n, int *done, char *err, int room) {
  logical finished = SPICEFALSE;
  *n = 0;
  *done = 0;
  chkin_c("dafec_c");
  dafec_(&handle, &rows, n, out, &finished, width - 1);
  chkout_c("dafec_c");
  if (DafStatus(err, room))
    return 1;
  if (*n < 0 || *n > rows)
    return tspice_return_error(err, room, "Invalid DAFEC row count");
  if (*n)
    F2C_ConvertTrStrArr(*n, width, out);
  *done = finished != SPICEFALSE;
  return 0;
}

int tspice_dafec(int handle, int rows, int width, unsigned char *out, int room, int *n, int *done, char *err,
                 int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (!out || !n || !done || room < 1 || room > TSPICE_DAF_PAGE_BYTES ||
      (rows > 0 && width >= 2 && (int64_t)rows * width > room))
    return tspice_return_error(err, errMaxBytes, "Invalid DAFEC output storage");
  if (width < 2) {
    comment_width_check((char *)out, width);
    return DafStatus(err, errMaxBytes);
  }
  DafCommentReader *r = comment_reader(handle);
  if (!r)
    return tspice_return_error(err, errMaxBytes, "DAF comment extraction requires an owned DAF handle");
  int end = r->end, next = 0, longest = 0;
  if (rows > 0 && r->offset == 0) {
    int first = 0, freeWord = 0;
    if (comment_header(handle, &first, &freeWord, err, errMaxBytes) ||
        comment_end(handle, first, &end, err, errMaxBytes))
      return 1;
  }
  // Every partial read must be drainable on last close, including when an
  // existing file has more reserved comment space than one public buffer.
  if (rows > 0 && !r->offset && end > TSPICE_DAF_PAGE_BYTES - 1) {
    int finalOffset = 0;
    if (scan_page(handle, 0, end, INT_MAX, INT_MAX, &finalOffset, &longest, err, errMaxBytes))
      return 1;
    if (longest >= TSPICE_DAF_PAGE_BYTES)
      return tspice_return_error(err, errMaxBytes, "DAF contains a comment exceeding supported line storage");
  }
  if (rows > 0 && end >= 0 &&
      scan_page(handle, r->offset, end, rows, width, &next, &longest, err, errMaxBytes))
    return 1;
  if (extract_rows(handle, rows, width, (char *)out, n, done, err, errMaxBytes))
    return 1;
  r->offset = *done ? 0 : next;
  r->end = *done ? 0 : end;
  return 0;
}

static int finish_comment_reader(DafCommentReader *r, char *err, int room) {
  // Ordinary pages use small scratch. A longer line needs only its actual
  // measured width. The same explicit bound applies to public extraction.
  while (r->offset) {
    int next = 0, longest = 0;
    if (scan_page(r->handle, r->offset, r->end, 64, INT_MAX, &next, &longest, err, room))
      return 1;
    int width = longest < 1 ? 2 : longest + 1;
    if (width > TSPICE_DAF_PAGE_BYTES)
      return tspice_return_error(err, room, "DAF comment line exceeds supported cleanup storage");
    int rows = TSPICE_DAF_PAGE_BYTES / width;
    if (rows > 64)
      rows = 64;
    if (rows < 64 && scan_page(r->handle, r->offset, r->end, rows, width, &next, &longest, err, room))
      return 1;
    char *buffer = malloc((size_t)width * rows);
    if (!buffer)
      return tspice_return_error(err, room, "Cannot allocate DAF comment cleanup storage");
    int n = 0, done = 0;
    int rc = extract_rows(r->handle, rows, width, buffer, &n, &done, err, room);
    free(buffer);
    if (rc)
      return rc;
    if (!done && next <= r->offset)
      return tspice_return_error(err, room, "DAF comment cleanup made no progress");
    r->offset = done ? 0 : next;
  }
  return 0;
}

int tspice_dafrs(int handle, const unsigned char *summary, int bytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (!summary || bytes < 8 || bytes > TSPICE_DAF_SUMMARY_BYTES || bytes % 8)
    return tspice_return_error(err, errMaxBytes, "Invalid packed DAF summary length");
  dafcs_c(handle);
  if (DafStatus(err, errMaxBytes))
    return 1;
  SpiceInt nd = 0, ni = 0;
  dafhsf_c(handle, &nd, &ni);
  if (DafStatus(err, errMaxBytes))
    return 1;
  if (nd < 0 || nd > 124 || ni < 2 || ni > 250 || nd + (ni + 1) / 2 > 125 || bytes != 8 * (nd + (ni + 1) / 2))
    return tspice_return_error(err, errMaxBytes, "Packed DAF summary must match the selected file format");
  SpiceDouble aligned[125] = {0};
  memcpy(aligned, summary, (size_t)bytes);
  dafrs_c(aligned);
  return DafStatus(err, errMaxBytes);
}

int tspice_dafopw(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!path || !outHandle) return tspice_return_error(err, errMaxBytes, "Missing DAF writer input or output");
  SpiceInt handle = 0;
  dafopw_c(path, &handle);
  if (DafStatus(err, errMaxBytes)) return 1;
  *outHandle = handle;
  return remember_daf_link(handle, 1, err, errMaxBytes);
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
  return remember_daf_link(handleC, 0, err, errMaxBytes);
}

int tspice_dafcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';

  DafCommentReader *reader = comment_reader(handle);
  if (reader && reader->links == 1 && reader->offset && finish_comment_reader(reader, err, errMaxBytes))
    return 1;
  dafcls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (reader && !--reader->links)
    *reader = (DafCommentReader){0};
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
