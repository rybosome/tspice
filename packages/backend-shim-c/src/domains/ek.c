#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceEK.h"

#include "SpiceZfc.h"
#include "SpiceZst.h"
#include <math.h>
#include <limits.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

// --- ABI guard ---------------------------------------------------------
//
// tspice assumes `SpiceInt` is 32-bit across native + WASM builds.
// Refuse to build if the CSPICE toolkit was compiled with a different size
// to avoid silent truncation across boundaries.
#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L
_Static_assert(sizeof(SpiceInt) == 4, "tspice_backend_shim requires sizeof(SpiceInt)==4");
#else
typedef char tspice_spiceint_must_be_32bit[(sizeof(SpiceInt) == 4) ? 1 : -1];
#endif


static int tspice_ek_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // Clear any previous structured SPICE error fields so higher-level callers
  // don't attach stale `spiceShort` / `spiceLong` / `spiceTrace` fields to
  // these non-CSPICE validation errors.
  tspice_reset(NULL, 0);

  if (err && errMaxBytes > 0) {
    if (msg) {
      strncpy(err, msg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    } else {
      err[0] = '\0';
    }
  }

  return 1;
}



// CSPICE permits one fast-load operation in the process. Keep the new
// record writers from interrupting it, even through a different EK handle.
static int tspice_ek_fast_open = 0;
static int tspice_ek_fast_handle = 0;
static int tspice_ek_fast_segment = 0;

static int begin_ek_record_call(char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = '\0';
  if (tspice_ek_fast_open) return tspice_ek_invalid_arg(err, errMaxBytes,
      "Finish the active EK fast write before a record operation");
  return 0;
}

static int finish_ek_record_call(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

static int ek_record_segment(int handle, int segment, int grows,
                             char *err, int errMaxBytes) {
  if (segment == INT_MAX) return tspice_ek_invalid_arg(err, errMaxBytes,
      "EK segment index exceeds the N0067 one-based conversion");
  // Both read-only and invalid handles fail in the canonical writer's
  // first operation, before any metadata is read or mutated. In that case
  // let it report its own complete diagnostic and call trace.
  zzekpgch_(&handle, "WRITE", (ftnlen)5);
  if (failed_c()) {
    reset_c();
    return 0;
  }
  SpiceInt nseg = eknseg_c(handle);
  if (failed_c()) return finish_ek_record_call(err, errMaxBytes);
  if (segment < 0 || segment >= nseg) return 0;
  SpiceEKSegSum summary;
  ekssum_c(handle, segment, &summary);
  if (failed_c()) return finish_ek_record_call(err, errMaxBytes);
  if (grows && summary.nrows == INT_MAX)
    return tspice_ek_invalid_arg(err, errMaxBytes, "EK row count exceeds the N0067 index range");
  for (int i = 0; i < summary.ncols; ++i)
    if (summary.cdescrs[i].cclass < 1 || summary.cdescrs[i].cclass > 6)
      return tspice_ek_invalid_arg(err, errMaxBytes, "EK row edits require a variable-count segment");
  return 0;
}

int tspice_ekops(int *out, char *err, int errMaxBytes) {
  if (begin_ek_record_call(err, errMaxBytes)) return 1;
  if (!out) return tspice_ek_invalid_arg(err, errMaxBytes, "Expected an EK result pointer");
  *out = 0;
  ekops_c(out);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekbseg(int handle, const char *table, int count, int nameWidth, const char *names, int declWidth, const char *decls, int *out, char *err, int errMaxBytes) {
  if (begin_ek_record_call(err, errMaxBytes)) return 1;
  if (!out) return tspice_ek_invalid_arg(err, errMaxBytes, "Expected an EK result pointer");
  *out = 0;
  if (!table || !names || !decls || count < 1 || count > SPICE_EK_MXCLSG ||
      nameWidth < 2 || declWidth < 2 || nameWidth > (256*1024*1024)/count ||
      declWidth > (256*1024*1024)/count)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Invalid EK schema dimensions");
  for (int i = 0; i < count; ++i)
    if (!memchr(names + i*nameWidth, 0, nameWidth) || !memchr(decls + i*declWidth, 0, declWidth))
      return tspice_ek_invalid_arg(err, errMaxBytes, "Unterminated EK schema row");
  ekbseg_c(handle, table, count, nameWidth, names, declWidth, decls, out);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekappr(int handle, int segment, int *out, char *err, int errMaxBytes) {
  if (begin_ek_record_call(err, errMaxBytes)) return 1;
  if (!out) return tspice_ek_invalid_arg(err, errMaxBytes, "Expected an EK result pointer");
  *out = 0;
  if (ek_record_segment(handle, segment, 1, err, errMaxBytes)) return 1;
  ekappr_c(handle, segment, out);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekinsr(int handle, int segment, int row, char *err, int errMaxBytes) {
  if (begin_ek_record_call(err, errMaxBytes)) return 1;
  if (row == INT_MAX) return tspice_ek_invalid_arg(err, errMaxBytes, "EK record index exceeds the N0067 one-based conversion");
  if (ek_record_segment(handle, segment, 1, err, errMaxBytes)) return 1;
  ekinsr_c(handle, segment, row);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekdelr(int handle, int segment, int row, char *err, int errMaxBytes) {
  if (begin_ek_record_call(err, errMaxBytes)) return 1;
  if (row == INT_MAX) return tspice_ek_invalid_arg(err, errMaxBytes, "EK record index exceeds the N0067 one-based conversion");
  if (ek_record_segment(handle, segment, 0, err, errMaxBytes)) return 1;
  ekdelr_c(handle, segment, row);
  return finish_ek_record_call(err, errMaxBytes);
}


enum { EK_ENTRY_LIMIT = 256 * 1024 * 1024 };
typedef struct {
  integer segment[24], column[11], record;
  int matched;
} EkEntryLocation;

// Run descriptor lookups in their original order. N0067's ZZEKSDSc
// computes base+1 even when ZZEKMLOC fails without assigning base.
static int locate_ek_entry(int handle, int segno, int recno, const char *column, int kind,
                           const char *entry, int writing, EkEntryLocation *loc, char *err,
                           int errMaxBytes) {
  if (begin_ek_record_call(err, errMaxBytes))
    return 1;
  if (!column || strlen(column) >= EK_ENTRY_LIMIT || segno == INT_MAX || recno == INT_MAX)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Invalid EK column or one-based ordinal");
  if (!*column)
    return 0; // Direct C string check has precedence.
  integer s = segno + 1, row = recno + 1, page = 0, base = 0;
  chkin_c(entry);
  zzekmloc_(&handle, &s, &page, &base);
  if (!failed_c()) {
    int first = base + 1, last = base + 24;
    dasrdi_c(handle, first, last, loc->segment);
    if (!failed_c())
      zzekcdsc_(&handle, loc->segment, (char *)column, loc->column, (ftnlen)strlen(column));
  }
  if (!failed_c()) {
    int type = loc->column[1], cls = loc->column[0];
    loc->matched = type == kind || (kind == 2 && type == 4);
    if (loc->matched && cls >= 7 && (writing || row < 1 || row > loc->segment[5])) {
      chkout_c(entry);
      return tspice_ek_invalid_arg(
          err, errMaxBytes, "Fixed-count EK entries require a valid row and support reading only");
    }
    // The ordinary toolkit readers/writers continue into the class handler
    // after a failed tree lookup. Stop before they consume a missing pointer.
    if (loc->matched && cls <= 6)
      zzektrdp_(&handle, &loc->segment[6], &row, &loc->record);
    if (writing && loc->matched && !failed_c())
      zzekpgch_(&handle, "WRITE", (ftnlen)5);
  }
  chkout_c(entry);
  return finish_ek_record_call(err, errMaxBytes);
}

static const char *ek_reader(int kind) {
  return kind == 1 ? "ekrcec_c" : kind == 2 ? "ekrced_c" : "ekrcei_c";
}
int tspice_ek_entry_extent(int handle, int segno, int recno, const char *column, int kind,
                           int width, int *count, char *err, int errMaxBytes) {
  if (!count || kind < 1 || kind > 3)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Invalid EK entry extent request");
  *count = 1;
  // Both C-level checks return before entering the defective read adapter.
  if (column && (!*column || (kind == 1 && width < 2))) {
    if (begin_ek_record_call(err, errMaxBytes))
      return 1;
    int n = 0, null = 0, i = 0;
    double d = 0;
    char c = 0;
    if (kind == 1)
      ekrcec_c(handle, segno, recno, column, width, &n, &c, &null);
    else if (kind == 2)
      ekrced_c(handle, segno, recno, column, &n, &d, &null);
    else
      ekrcei_c(handle, segno, recno, column, &n, &i, &null);
    return finish_ek_record_call(err, errMaxBytes);
  }
  EkEntryLocation loc = {0};
  if (locate_ek_entry(handle, segno, recno, column, kind, ek_reader(kind), 0, &loc, err,
                      errMaxBytes))
    return 1;
  if (loc.matched && loc.column[0] >= 4 && loc.column[0] <= 6) {
    chkin_c(ek_reader(kind));
    *count = zzekesiz_(&handle, loc.segment, loc.column, &loc.record);
    chkout_c(ek_reader(kind));
    if (finish_ek_record_call(err, errMaxBytes))
      return 1;
  }
  int stride = kind == 1 ? width : kind == 2 ? (int)sizeof(double) : (int)sizeof(int);
  if (*count < 1 || stride < 1 || *count > EK_ENTRY_LIMIT / stride)
    return tspice_ek_invalid_arg(err, errMaxBytes, "EK entry exceeds the bounded output capacity");
  return 0;
}

static int prepare_ek_write(int handle, int segno, int recno, const char *column, int kind,
                            const char *entry, int adding, int count, int width, const void *values,
                            int isNull, char *err, int errMaxBytes) {
  if (!values || count < 0 || width < 1 || count > EK_ENTRY_LIMIT / width ||
      (kind == 1 && (width < 2 || count > EK_ENTRY_LIMIT / (int)sizeof(char *))) ||
      (isNull != 0 && isNull != 1))
    return tspice_ek_invalid_arg(err, errMaxBytes, "Invalid EK entry type, count or row stride");
  if (kind == 1)
    for (int i = 0; i < count; i++)
      if (!memchr((const char *)values + i * width, 0, width))
        return tspice_ek_invalid_arg(err, errMaxBytes, "Unterminated EK entry string");
  if (kind == 2)
    for (int i = 0; i < count; i++)
      if (!isfinite(((const double *)values)[i]))
        return tspice_ek_invalid_arg(err, errMaxBytes, "Expected finite EK doubles");
  EkEntryLocation loc = {0};
  if (locate_ek_entry(handle, segno, recno, column, kind, entry, 1, &loc, err, errMaxBytes))
    return 1;
  if (!loc.matched)
    return 0; // Canonical wrong type or empty name.
  int cls = loc.column[0];
  if (!count && cls <= 3)
    return tspice_ek_invalid_arg(err, errMaxBytes,
                                 "Scalar EK writes require a value or null placeholder");
  if (kind == 1 && cls == 6 && loc.column[2] > 0 && !isNull &&
      count > EK_ENTRY_LIMIT / loc.column[2])
    return tspice_ek_invalid_arg(err, errMaxBytes,
                                 "Stored character entry exceeds the bounded extent");
  // ZZEKUE01/02 can mark an existing scalar NULL without checking NULLS_OK.
  // The new-entry paths perform the real BADATTRIBUTE check themselves.
  const int checkNullUpdate = !adding && cls <= 2 && isNull && loc.column[7] != 1;
  // Classes 1 and 2 diagnose repeated adds. The other classes assume a new
  // entry and can overwrite a pointer without releasing its original storage.
  if ((adding && cls >= 3) || checkNullUpdate) {
    int addr = loc.record + 2 + loc.column[8], pointer = 0;
    dasrdi_c(handle, addr, addr, &pointer);
    if (finish_ek_record_call(err, errMaxBytes))
      return 1;
    if (pointer != -1 && pointer != -3) {
      if (checkNullUpdate)
        return tspice_ek_invalid_arg(err, errMaxBytes,
            "Cannot mark a populated non-nullable numeric scalar NULL");
      return tspice_ek_invalid_arg(err, errMaxBytes,
            "EK add requires an uninitialized entry; use update");
    }
  }
  return 0;
}

int tspice_ekacec(int handle, int segno, int recno, const char *column, int count, int width,
                  const char *values, int isNull, char *err, int errMaxBytes) {
  if (prepare_ek_write(handle, segno, recno, column, 1, "ekacec_c", 1, count, width, values, isNull,
                       err, errMaxBytes))
    return 1;
  if (count == 0 && *column) {
    // Avoid two allocator-dependent malloc(0) calls in the C row packer.
    integer s = segno + 1, row = recno + 1;
    logical null = isNull;
    char blank = ' ';
    chkin_c("ekacec_c");
    ekacec_(&handle, &s, &row, (char *)column, &count, &blank, &null, (ftnlen)strlen(column),
            (ftnlen)1);
    chkout_c("ekacec_c");
  } else
    ekacec_c(handle, segno, recno, column, count, width, values, isNull);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekaced(int handle, int segno, int recno, const char *column, int count,
                  const double *values, int isNull, char *err, int errMaxBytes) {
  if (prepare_ek_write(handle, segno, recno, column, 2, "ekaced_c", 1, count, sizeof(double),
                       values, isNull, err, errMaxBytes))
    return 1;
  ekaced_c(handle, segno, recno, column, count, values, isNull);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekacei(int handle, int segno, int recno, const char *column, int count,
                  const int *values, int isNull, char *err, int errMaxBytes) {
  if (prepare_ek_write(handle, segno, recno, column, 3, "ekacei_c", 1, count, sizeof(int), values,
                       isNull, err, errMaxBytes))
    return 1;
  ekacei_c(handle, segno, recno, column, count, values, isNull);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekrcec(int handle, int segno, int recno, const char *column, int width, char *values,
                  int capacity, int *nvals, int *isNull, char *err, int errMaxBytes) {
  int expected = 0;
  if (!values || !nvals || !isNull)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Missing EK result buffer");
  if (tspice_ek_entry_extent(handle, segno, recno, column, 1, width, &expected, err, errMaxBytes))
    return 1;
  if (capacity < expected)
    return tspice_ek_invalid_arg(err, errMaxBytes, "EK result buffer is too small");
  integer s = segno + 1, row = recno + 1;
  logical null = 0;
  *nvals = 0;
  *isNull = 0;
  chkin_c("ekrcec_c");
  ekrcec_(&handle, &s, &row, (char *)column, nvals, values, &null, (ftnlen)strlen(column),
          (ftnlen)(width - 1));
  if (!failed_c() && !null && *nvals == expected)
    F2C_ConvertStrArr(*nvals, width, values);
  chkout_c("ekrcec_c");
  if (finish_ek_record_call(err, errMaxBytes))
    return 1;
  if (*nvals != expected)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Inconsistent EK entry extent");
  *isNull = null != 0;
  return 0;
}

int tspice_ekrced(int handle, int segno, int recno, const char *column, double *values,
                  int capacity, int *nvals, int *isNull, char *err, int errMaxBytes) {
  int expected = 0;
  if (!values || !nvals || !isNull)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Missing EK result buffer");
  if (tspice_ek_entry_extent(handle, segno, recno, column, 2, 0, &expected, err, errMaxBytes))
    return 1;
  if (capacity < expected)
    return tspice_ek_invalid_arg(err, errMaxBytes, "EK result buffer is too small");
  integer s = segno + 1, row = recno + 1;
  logical null = 0;
  *nvals = 0;
  *isNull = 0;
  chkin_c("ekrced_c");
  ekrced_(&handle, &s, &row, (char *)column, nvals, values, &null, (ftnlen)strlen(column));
  chkout_c("ekrced_c");
  if (finish_ek_record_call(err, errMaxBytes))
    return 1;
  if (*nvals != expected)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Inconsistent EK entry extent");
  *isNull = null != 0;
  return 0;
}

int tspice_ekrcei(int handle, int segno, int recno, const char *column, int *values, int capacity,
                  int *nvals, int *isNull, char *err, int errMaxBytes) {
  int expected = 0;
  if (!values || !nvals || !isNull)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Missing EK result buffer");
  if (tspice_ek_entry_extent(handle, segno, recno, column, 3, 0, &expected, err, errMaxBytes))
    return 1;
  if (capacity < expected)
    return tspice_ek_invalid_arg(err, errMaxBytes, "EK result buffer is too small");
  integer s = segno + 1, row = recno + 1;
  logical null = 0;
  *nvals = 0;
  *isNull = 0;
  chkin_c("ekrcei_c");
  ekrcei_(&handle, &s, &row, (char *)column, nvals, values, &null, (ftnlen)strlen(column));
  chkout_c("ekrcei_c");
  if (finish_ek_record_call(err, errMaxBytes))
    return 1;
  if (*nvals != expected)
    return tspice_ek_invalid_arg(err, errMaxBytes, "Inconsistent EK entry extent");
  *isNull = null != 0;
  return 0;
}

int tspice_ekucec(int handle, int segno, int recno, const char *column, int count, int width,
                  const char *values, int isNull, char *err, int errMaxBytes) {
  if (prepare_ek_write(handle, segno, recno, column, 1, "ekucec_c", 0, count, width, values, isNull,
                       err, errMaxBytes))
    return 1;
  if (count == 0 && *column) {
    // Avoid two allocator-dependent malloc(0) calls in the C row packer.
    integer s = segno + 1, row = recno + 1;
    logical null = isNull;
    char blank = ' ';
    chkin_c("ekucec_c");
    ekucec_(&handle, &s, &row, (char *)column, &count, &blank, &null, (ftnlen)strlen(column),
            (ftnlen)1);
    chkout_c("ekucec_c");
  } else
    ekucec_c(handle, segno, recno, column, count, width, values, isNull);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekuced(int handle, int segno, int recno, const char *column, int count,
                  const double *values, int isNull, char *err, int errMaxBytes) {
  if (prepare_ek_write(handle, segno, recno, column, 2, "ekuced_c", 0, count, sizeof(double),
                       values, isNull, err, errMaxBytes))
    return 1;
  ekuced_c(handle, segno, recno, column, count, values, isNull);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekucei(int handle, int segno, int recno, const char *column, int count,
                  const int *values, int isNull, char *err, int errMaxBytes) {
  if (prepare_ek_write(handle, segno, recno, column, 3, "ekucei_c", 0, count, sizeof(int), values,
                       isNull, err, errMaxBytes))
    return 1;
  ekucei_c(handle, segno, recno, column, count, values, isNull);
  return finish_ek_record_call(err, errMaxBytes);
}

int tspice_ekopr(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopr: path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopr: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  ekopr_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_ekopw(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopw: path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopw: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  ekopw_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_ekopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: path must be a non-empty string");
  }
  if (!ifname || ifname[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: ifname must be a non-empty string");
  }
  if (ncomch < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: ncomch must be >= 0");
  }
  if (!outHandle) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  ekopn_c(path, ifname, (SpiceInt)ncomch, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_ekcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  ekcls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (tspice_ek_fast_handle == handle) tspice_ek_fast_open = 0;
  return 0;
}

int tspice_ekntab(int *outN, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }

  if (!outN) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekntab: outN must be non-NULL");
  }

  SpiceInt nC = 0;
  ekntab_c(&nC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (nC < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekntab: expected a non-negative table count");
  }

  *outN = (int)nC;
  return 0;
}

int tspice_ektnam(int n, char *outName, int outNameMaxBytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outName && outNameMaxBytes > 0) {
    outName[0] = '\0';
  }

  if (!outName) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ektnam: outName must be non-NULL");
  }
  if (outNameMaxBytes < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ektnam: outNameMaxBytes must be >= 2");
  }
  if (n < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ektnam: n must be >= 0");
  }

  ektnam_c((SpiceInt)n, (SpiceInt)outNameMaxBytes, outName);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // Ensure stable NUL-termination even if code changes.
  outName[outNameMaxBytes - 1] = '\0';
  return 0;
}

int tspice_eknseg(int handle, int *outNseg, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNseg) {
    *outNseg = 0;
  }

  if (!outNseg) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_eknseg: outNseg must be non-NULL");
  }
  const SpiceInt nsegC = eknseg_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (nsegC < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_eknseg: expected a non-negative segment count");
  }

  *outNseg = (int)nsegC;
  return 0;
}


// --- EK query/data ops -----------------------------------------------------

int tspice_ekfind(
    const char *query,
    int outErrmsgMaxBytes,
    int *outNmrows,
    int *outError,
    char *outErrmsg,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNmrows) {
    *outNmrows = 0;
  }
  if (outError) {
    *outError = 0;
  }
  if (outErrmsg && outErrmsgMaxBytes > 0) {
    outErrmsg[0] = '\0';
  }

  if (!query || query[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: query must be a non-empty string");
  }
  if (!outNmrows) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outNmrows must be non-NULL");
  }
  if (!outError) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outError must be non-NULL");
  }
  if (!outErrmsg) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outErrmsg must be non-NULL");
  }
  if (outErrmsgMaxBytes < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outErrmsgMaxBytes must be >= 2");
  }

  SpiceInt nmrowsC = 0;
  SpiceBoolean errorC = SPICEFALSE;
  ekfind_c(query, (SpiceInt)outErrmsgMaxBytes, &nmrowsC, &errorC, outErrmsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // Ensure stable NUL-termination even if code changes.
  outErrmsg[outErrmsgMaxBytes - 1] = '\0';

  *outError = errorC == SPICETRUE ? 1 : 0;
  *outNmrows = (errorC == SPICETRUE) ? 0 : (int)nmrowsC;
  return 0;
}

int tspice_ekgc(
    int selidx,
    int row,
    int elment,
    char *outCdata,
    int outCdataMaxBytes,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCdata && outCdataMaxBytes > 0) {
    outCdata[0] = '\0';
  }
  if (outNull) {
    *outNull = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!outCdata) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outCdata must be non-NULL");
  }
  if (outCdataMaxBytes < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outCdataMaxBytes must be >= 2");
  }
  if (!outNull) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outNull must be non-NULL");
  }
  if (!outFound) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outFound must be non-NULL");
  }
  if (selidx < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: selidx must be >= 0");
  }
  if (row < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: row must be >= 0");
  }
  if (elment < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: elment must be >= 0");
  }

  SpiceBoolean nullC = SPICEFALSE;
  SpiceBoolean foundC = SPICEFALSE;
  ekgc_c(
      (SpiceInt)selidx,
      (SpiceInt)row,
      (SpiceInt)elment,
      (SpiceInt)outCdataMaxBytes,
      outCdata,
      &nullC,
      &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // Ensure stable NUL-termination even if code changes.
  outCdata[outCdataMaxBytes - 1] = '\0';

  *outNull = nullC == SPICETRUE ? 1 : 0;
  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_ekgd(
    int selidx,
    int row,
    int elment,
    double *outDdata,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDdata) {
    *outDdata = 0;
  }
  if (outNull) {
    *outNull = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!outDdata) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: outDdata must be non-NULL");
  }
  if (!outNull) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: outNull must be non-NULL");
  }
  if (!outFound) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: outFound must be non-NULL");
  }
  if (selidx < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: selidx must be >= 0");
  }
  if (row < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: row must be >= 0");
  }
  if (elment < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: elment must be >= 0");
  }

  SpiceBoolean nullC = SPICEFALSE;
  SpiceBoolean foundC = SPICEFALSE;
  SpiceDouble ddataC = 0;
  ekgd_c((SpiceInt)selidx, (SpiceInt)row, (SpiceInt)elment, &ddataC, &nullC, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outDdata = (double)ddataC;
  *outNull = nullC == SPICETRUE ? 1 : 0;
  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_ekgi(
    int selidx,
    int row,
    int elment,
    int *outIdata,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outIdata) {
    *outIdata = 0;
  }
  if (outNull) {
    *outNull = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!outIdata) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: outIdata must be non-NULL");
  }
  if (!outNull) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: outNull must be non-NULL");
  }
  if (!outFound) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: outFound must be non-NULL");
  }
  if (selidx < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: selidx must be >= 0");
  }
  if (row < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: row must be >= 0");
  }
  if (elment < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: elment must be >= 0");
  }

  SpiceBoolean nullC = SPICEFALSE;
  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt idataC = 0;
  ekgi_c((SpiceInt)selidx, (SpiceInt)row, (SpiceInt)elment, &idataC, &nullC, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outIdata = (int)idataC;
  *outNull = nullC == SPICETRUE ? 1 : 0;
  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}


// --- EK fast write ---------------------------------------------------------

static int tspice_ek_sum_entszs(
    int nrows,
    const int *entszs,
    const int *nlflgs,
    int *outSum,
    char *err,
    int errMaxBytes) {
  if (!outSum) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: outSum must be non-NULL");
  }
  *outSum = 0;

  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: nlflgs must be non-NULL");
  }

  long long sum = 0;
  for (int i = 0; i < nrows; i++) {
    const int sz = entszs[i];
    const int isNull = nlflgs[i];

    if (isNull != 0 && isNull != 1) {
      return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: nlflgs must contain only 0/1");
    }
    // CSPICE semantics:
    // - nlflgs[i] indicates whether the row entry is NULL.
    // - For NULL entries, entszs[i] may be 0 (and is allowed to be any value >= 0).
    // - For non-NULL entries, entszs[i] must be >= 1.
    if (isNull == 1) {
      if (sz < 0) {
        return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: NULL entries must have entszs[i] >= 0");
      }
    } else {
      if (sz < 1) {
        return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: non-NULL entries must have entszs[i] >= 1");
      }
    }

    sum += (long long)sz;
    if (sum > 2147483647LL) {
      return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: total value count overflow");
    }
  }

  *outSum = (int)sum;
  return 0;
}

int tspice_ekifld(
    int handle,
    const char *tabnam,
    int ncols,
    int nrows,
    int cnamln,
    const char *cnames,
    int declen,
    const char *decls,
    int *outSegno,
    int *outRcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSegno) {
    *outSegno = 0;
  }
  if (outRcptrs && nrows > 0) {
    // Best-effort init.
    for (int i = 0; i < nrows; i++) {
      outRcptrs[i] = 0;
    }
  }

  if (!tabnam || tabnam[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: tabnam must be a non-empty string");
  }
  if (ncols <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: ncols must be > 0");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: nrows must be > 0");
  }
  if (!cnames) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: cnames must be non-NULL");
  }
  if (!decls) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: decls must be non-NULL");
  }
  if (cnamln < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: cnamln must be >= 2");
  }
  if (declen < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: declen must be >= 2");
  }
  if (!outSegno) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: outSegno must be non-NULL");
  }
  if (!outRcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: outRcptrs must be non-NULL");
  }

  SpiceInt segnoC = 0;
  ekifld_c(
      (SpiceInt)handle,
      tabnam,
      (SpiceInt)ncols,
      (SpiceInt)nrows,
      (SpiceInt)cnamln,
      (const void *)cnames,
      (SpiceInt)declen,
      (const void *)decls,
      &segnoC,
      (SpiceInt *)outRcptrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  tspice_ek_fast_open = 1;
  tspice_ek_fast_handle = handle;
  tspice_ek_fast_segment = (int)segnoC;
  *outSegno = (int)segnoC;
  return 0;
}


// ekac* routines require a `wkindx` workspace array of length `nrows`,
// initialized to all zeros for each call.
//
// Allocating/freeing this buffer on every call is measurable overhead when
// streaming large EK writes. Since CSPICE EK operations are inherently
// non-thread-safe (global state), cache and reuse a single process-global
// buffer, growing it as needed.
static SpiceInt *tspice_ek_wkindx_cache = NULL;
static size_t tspice_ek_wkindx_cache_cap = 0;

static int tspice_ek_get_wkindx_workspace(
    int nrows,
    SpiceInt **outWkindx,
    char *err,
    int errMaxBytes,
    const char *ctx) {
  if (!outWkindx) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_get_wkindx_workspace: outWkindx must be non-NULL");
  }
  *outWkindx = NULL;

  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_get_wkindx_workspace: nrows must be > 0");
  }

  const size_t needed = (size_t)nrows;

  if (needed > tspice_ek_wkindx_cache_cap) {
    const size_t bytes = needed * sizeof(SpiceInt);
    SpiceInt *next = (SpiceInt *)realloc(tspice_ek_wkindx_cache, bytes);
    if (!next) {
      return tspice_ek_invalid_arg(err, errMaxBytes, ctx);
    }
    tspice_ek_wkindx_cache = next;
    tspice_ek_wkindx_cache_cap = needed;
  }

  memset(tspice_ek_wkindx_cache, 0, needed * sizeof(SpiceInt));
  *outWkindx = tspice_ek_wkindx_cache;
  return 0;
}

/* The toolkit's column writers derive their row/entry counts from the actual
   segment, not from our caller-provided array lengths. Validate before any
   downstream array read. ekssum_c is also used by the toolkit writers themselves
   and does not interrupt the active fast-write workspace. */
static int tspice_ek_check_column_storage(
    int handle, int segno, const char *column, int nrows,
    const int *entszs, const int *nlflgs, int nvals,
    SpiceEKAttDsc *outDescriptor, char *err, int errMaxBytes) {
  SpiceEKSegSum summary;
  ekssum_c((SpiceInt)handle, (SpiceInt)segno, &summary);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (nrows != summary.nrows) {
    return tspice_ek_invalid_arg(err, errMaxBytes,
        "EK column arrays must match the actual segment row count");
  }
  for (SpiceInt i = 0; i < summary.ncols; ++i) {
    if (!eqstr_c(column, summary.cnames[i])) continue;
    const SpiceEKAttDsc descriptor = summary.cdescrs[i];
    if (descriptor.size != SPICE_EK_VARSIZ) {
      const long long required = (long long)nrows * descriptor.size;
      if (required != nvals) {
        return tspice_ek_invalid_arg(err, errMaxBytes,
            "EK values must cover every actual fixed-size column entry");
      }
      for (int row = 0; row < nrows; ++row) {
        if (entszs[row] != descriptor.size) {
          return tspice_ek_invalid_arg(err, errMaxBytes,
              "EK fixed-size entszs must match the declared entry size");
        }
      }
    } else if (!descriptor.nullok) {
      for (int row = 0; row < nrows; ++row) {
        if (entszs[row] < 1) {
          return tspice_ek_invalid_arg(err, errMaxBytes,
              "EK non-nullable entries require at least one value; null flags are ignored");
        }
      }
    }
    *outDescriptor = descriptor;
    return 0;
  }
  /* Preserve actual toolkit NOCOLUMN/WRONGDATATYPE reporting. Row storage is
     already safe; no unknown column's values can be consumed. */
  memset(outDescriptor, 0, sizeof(*outDescriptor));
  (void)nlflgs;
  return 0;
}

int tspice_ekacli(
    int handle,
    int segno,
    const char *column,
    int nrows,
    const int *ivals,
    int nvals,
    const int *entszs,
    const int *nlflgs,
    int *rcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: segno must be >= 0");
  }
  if (!column || column[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: column must be a non-empty string");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nlflgs must be non-NULL");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: rcptrs must be non-NULL");
  }
  if (nvals < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nvals must be >= 0");
  }
  if (nvals > 0 && !ivals) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: ivals must be non-NULL when nvals > 0");
  }

  SpiceEKAttDsc descriptor;
  if (tspice_ek_check_column_storage(handle, segno, column, nrows, entszs,
          nlflgs, nvals, &descriptor, err, errMaxBytes) != 0) return 1;

  int required = 0;
  const int sumCode = tspice_ek_sum_entszs(nrows, entszs, nlflgs, &required, err, errMaxBytes);
  if (sumCode != 0) {
    return 1;
  }
  if (nvals != required) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nvals must match sum(entszs)");
  }

  SpiceInt *wkindx = NULL;
  if (tspice_ek_get_wkindx_workspace(
          nrows,
          &wkindx,
          err,
          errMaxBytes,
          "tspice_ekacli: failed to allocate wkindx workspace") != 0) {
    return 1;
  }

  ekacli_c(
      (SpiceInt)handle,
      (SpiceInt)segno,
      column,
      (const SpiceInt *)ivals,
      (const SpiceInt *)entszs,
      (const SpiceBoolean *)nlflgs,
      (const SpiceInt *)rcptrs,
      wkindx);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ekacld(
    int handle,
    int segno,
    const char *column,
    int nrows,
    const double *dvals,
    int nvals,
    const int *entszs,
    const int *nlflgs,
    int *rcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: segno must be >= 0");
  }
  if (!column || column[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: column must be a non-empty string");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nlflgs must be non-NULL");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: rcptrs must be non-NULL");
  }
  if (nvals < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nvals must be >= 0");
  }
  if (nvals > 0 && !dvals) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: dvals must be non-NULL when nvals > 0");
  }

  SpiceEKAttDsc descriptor;
  if (tspice_ek_check_column_storage(handle, segno, column, nrows, entszs,
          nlflgs, nvals, &descriptor, err, errMaxBytes) != 0) return 1;

  int required = 0;
  const int sumCode = tspice_ek_sum_entszs(nrows, entszs, nlflgs, &required, err, errMaxBytes);
  if (sumCode != 0) {
    return 1;
  }
  if (nvals != required) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nvals must match sum(entszs)");
  }

  SpiceInt *wkindx = NULL;
  if (tspice_ek_get_wkindx_workspace(
          nrows,
          &wkindx,
          err,
          errMaxBytes,
          "tspice_ekacld: failed to allocate wkindx workspace") != 0) {
    return 1;
  }

  ekacld_c(
      (SpiceInt)handle,
      (SpiceInt)segno,
      column,
      (const SpiceDouble *)dvals,
      (const SpiceInt *)entszs,
      (const SpiceBoolean *)nlflgs,
      (const SpiceInt *)rcptrs,
      wkindx);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ekaclc(
    int handle,
    int segno,
    const char *column,
    int nrows,
    int nvals,
    int vallen,
    int cvalsMaxBytes,
    const char *cvals,
    const int *entszs,
    const int *nlflgs,
    int *rcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: segno must be >= 0");
  }
  if (!column || column[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: column must be a non-empty string");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nlflgs must be non-NULL");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: rcptrs must be non-NULL");
  }
  if (nvals < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nvals must be >= 0");
  }
  if (nvals > 0 && !cvals) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvals must be non-NULL when nvals > 0");
  }
  if (vallen < 1) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: vallen must be > 0");
  }
  if (cvalsMaxBytes < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvalsMaxBytes must be >= 0");
  }

  SpiceEKAttDsc descriptor;
  if (tspice_ek_check_column_storage(handle, segno, column, nrows, entszs,
          nlflgs, nvals, &descriptor, err, errMaxBytes) != 0) return 1;

  int required = 0;
  const int sumCode = tspice_ek_sum_entszs(nrows, entszs, nlflgs, &required, err, errMaxBytes);
  if (sumCode != 0) {
    return 1;
  }
  if (nvals != required) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nvals must match sum(entszs)");
  }

  // Ensure the caller-provided `cvals` buffer is large enough to safely read
  // `nvals` fixed-width strings (each of width `vallen`).
  const long long requiredBytes = (long long)nvals * (long long)vallen;
  if (requiredBytes < 0 || requiredBytes > 2147483647LL) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvals byte size overflow");
  }
  if ((long long)cvalsMaxBytes < requiredBytes) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvalsMaxBytes must be >= nvals*vallen");
  }

  SpiceInt *wkindx = NULL;
  if (tspice_ek_get_wkindx_workspace(
          nrows,
          &wkindx,
          err,
          errMaxBytes,
          "tspice_ekaclc: failed to allocate wkindx workspace") != 0) {
    return 1;
  }

  /* N0067 ekaclc_c allocates its logical flag array using the total
     character count, then copies nrows flags. Give zero-size NULL rows one
     ignored blank placeholder so that count is at least nrows. This preserves
     every observable NULL/value while avoiding its zero/short allocation.
     Empty character values also require a two-byte C-string slot. */
  int *paddedSizes = NULL;
  char *paddedValues = NULL;
  const int *callSizes = entszs;
  const char *callValues = cvals;
  int missingSlots = 0;
  if (descriptor.size == SPICE_EK_VARSIZ && descriptor.nullok) {
    for (int row = 0; row < nrows; ++row)
      if (nlflgs[row] && entszs[row] == 0) ++missingSlots;
  }
  if (missingSlots > 0) {
    const long long paddedCount = (long long)nvals + missingSlots;
    const long long paddedBytes = paddedCount * vallen;
    if (vallen < 2 || paddedBytes > 256LL * 1024 * 1024) {
      return tspice_ek_invalid_arg(err, errMaxBytes,
          "EK NULL placeholder storage exceeds character buffer bounds");
    }
    paddedSizes = (int *)malloc((size_t)nrows * sizeof(int));
    paddedValues = (char *)calloc((size_t)paddedCount, (size_t)vallen);
    if (!paddedSizes || !paddedValues) {
      free(paddedSizes);
      free(paddedValues);
      return tspice_ek_invalid_arg(err, errMaxBytes,
          "EK failed to allocate NULL placeholder storage");
    }
    size_t inputIndex = 0, outputIndex = 0;
    for (int row = 0; row < nrows; ++row) {
      if (nlflgs[row] && entszs[row] == 0) {
        paddedSizes[row] = 1;
        ++outputIndex;
      } else {
        paddedSizes[row] = entszs[row];
        const size_t bytes = (size_t)entszs[row] * (size_t)vallen;
        memcpy(paddedValues + outputIndex * (size_t)vallen,
               cvals + inputIndex * (size_t)vallen, bytes);
        inputIndex += (size_t)entszs[row];
        outputIndex += (size_t)entszs[row];
      }
    }
    callSizes = paddedSizes;
    callValues = paddedValues;
  }

  ekaclc_c(
      (SpiceInt)handle,
      (SpiceInt)segno,
      column,
      (SpiceInt)vallen,
      (const void *)callValues,
      (const SpiceInt *)callSizes,
      (const SpiceBoolean *)nlflgs,
      (const SpiceInt *)rcptrs,
      wkindx);
  free(paddedSizes);
  free(paddedValues);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ekffld(int handle, int segno, int nrows, int *rcptrs, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekffld: segno must be >= 0");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekffld: rcptrs must be non-NULL");
  }

  SpiceEKSegSum summary;
  ekssum_c((SpiceInt)handle, (SpiceInt)segno, &summary);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (nrows != summary.nrows) {
    return tspice_ek_invalid_arg(err, errMaxBytes,
        "ekffld record pointers must match the actual segment row count");
  }

  ekffld_c((SpiceInt)handle, (SpiceInt)segno, (SpiceInt *)rcptrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_ek_fast_handle == handle && tspice_ek_fast_segment == segno) tspice_ek_fast_open = 0;
  return 0;
}
