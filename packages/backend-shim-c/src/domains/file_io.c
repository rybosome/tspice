#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceZfc.h"
#include "SpiceUsr.h"
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


// The checked N0067 reader reports every canonical EOF, read-error or CLTEXT
// closure, including closes from other routines. A reused logical unit never
// inherits the previous reader's clients.
extern int tspice_last_read_text_unit(void);
extern int tspice_close_text_unit(int);
typedef struct TextClaim {
  int owner,unit;
  struct TextClaim *next;
} TextClaim;
static TextClaim *text_claims;
static int next_owner;

void tspice_text_unit_closed(int unit) {
  TextClaim **link=&text_claims;
  while(*link){
    TextClaim *claim=*link;
    if(claim->unit!=unit){link=&claim->next;continue;}
    *link=claim->next;
    free(claim);
  }
}
static int text_failure(char *err,int cap,const char *message) {
  tspice_reset(NULL,0);
  if(err && cap>0)snprintf(err,(size_t)cap,"%s",message);
  return 1;
}
static int text_status(char *err,int cap) {
  if(!failed_c())return 0;
  tspice_get_spice_error_message_and_reset(err,cap);
  return 1;
}
int tspice_text_owner(int *owner, char *err, int errMaxBytes) {
  if(!owner||next_owner==INT_MAX)return text_failure(err,errMaxBytes,"Text reader owner limit reached");
  *owner=++next_owner;return 0;
}
int tspice_release_text_owner(int owner, char *err, int errMaxBytes) {
  TextClaim **link=&text_claims;
  while(*link) {
    TextClaim *claim=*link;
    if(claim->owner!=owner){link=&claim->next;continue;}
    int unit=claim->unit;
    *link=claim->next;free(claim);
    TextClaim *other=text_claims;
    while(other && other->unit!=unit)other=other->next;
    if(!other)tspice_close_text_unit(unit);
  }
  return text_status(err,errMaxBytes);
}
int tspice_rdtext(int owner, const char *path, int width, char *line, int *eof, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if(!path || strlen(path)>255 || !line || !eof || owner<1 || owner>next_owner || width>256*1024*1024)
    return text_failure(err,errMaxBytes,"Invalid text reader owner, resolved path or output width");
  // Claim storage is acquired before advancing the shared cursor. On EOF or
  // failure there is no fresh claim, and the canonical reader handles closure.
  TextClaim *new_claim=malloc(sizeof(*new_claim));
  if(!new_claim)return text_failure(err,errMaxBytes,"Unable to allocate text reader claim");
  *eof=0;
  rdtext_c(path,width,line,eof);
  if(text_status(err,errMaxBytes)){free(new_claim);return 1;}
  if(*eof){free(new_claim);return 0;}
  // Other toolkit facilities can have a separate unit on the same filename.
  // Associate this client only with the unit RDTEXT actually consumed.
  const int unit=tspice_last_read_text_unit();
  for(TextClaim *found=text_claims;found;found=found->next)if(found->owner==owner && found->unit==unit){
    free(new_claim);return 0;
  }
  new_claim->owner=owner;new_claim->unit=unit;new_claim->next=text_claims;text_claims=new_claim;
  return 0;
}
int tspice_putcml(int argc, int packedBytes, const char *packed, char *observed, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if(argc<0 || argc>256*1024*1024/8 || packedBytes<0 || packedBytes>256*1024*1024 || argc>packedBytes || !packed || !observed)
    return text_failure(err,errMaxBytes,"Invalid packed command-line storage");
  char **args=calloc((size_t)argc+1,sizeof(char*));
  if(!args)return text_failure(err,errMaxBytes,"Unable to allocate command-line pointers");
  int offset=0;
  for(int i=0;i<argc;i++) {
    const char *end=memchr(packed+offset,0,(size_t)(packedBytes-offset));
    if(!end){free(args);return text_failure(err,errMaxBytes,"Unterminated packed command argument");}
    args[i]=(char*)packed+offset;offset=(int)(end-packed)+1;
  }
  if(offset!=packedBytes){free(args);return text_failure(err,errMaxBytes,"Unexpected trailing command data");}
  putcml_c(argc,args);
  free(args);
  if(text_status(err,errMaxBytes))return 1;
  // Immediate readback only. No public getter and no observable borrowed
  // pointers. The one-time setter retains its ordinary void contract.
  SpiceInt count=0;char **saved=NULL;
  getcml_c(&count,&saved);
  if(text_status(err,errMaxBytes))return 1;
  if(count!=argc)return text_failure(err,errMaxBytes,"Inconsistent stored command count");
  offset=0;
  for(int i=0;i<count;i++){
    size_t len=strlen(saved[i])+1;
    if(len>(size_t)(packedBytes-offset))return text_failure(err,errMaxBytes,"Inconsistent stored command length");
    memcpy(observed+offset,saved[i],len);offset+=(int)len;
  }
  return offset==packedBytes?0:text_failure(err,errMaxBytes,"Incomplete stored command");
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

  // DLAOPN has appended its three integer controls through the original
  // DASADI. Initialize only the remainder of that new physical record.
  if (clear_new_das_tail(handleC, 3, 0, 3, err, errMaxBytes)) {
    dasllc_c(handleC);
    if (failed_c()) reset_c();
    return 1;
  }
  *outHandle = (int)handleC;
  return das_link(handleC,err,errMaxBytes);
}

// DLA's translated routines assume all preliminary reads succeeded. Check
// their actual DAS operands under the same lock before the canonical call.
// DASRDI validates its first address only, so an invalid last address is
// submitted as a singleton and can never expose unused physical padding.
static void dla_read(int h, int high, int first, int last, int *out) {
  if (failed_c()) return;
  int invalid = first < 1 || first > high ? first : last;
  if (invalid < 1 || invalid > high) {
    int ignored = 0;
    dasrdi_(&h, &invalid, &invalid, &ignored);
  } else {
    dasrdi_(&h, &first, &last, out);
  }
}

enum DlaOperation { DLA_BEGIN, DLA_END, DLA_LAST, DLA_PREVIOUS };

static int dla_prepare(int h, const char *outer, const char *inner, enum DlaOperation mode, int backward,
                       int *oldHigh, char *err, int room) {
  int lastc = 0, lastd = 0, high = 0, control[2] = {0}, descriptor[8] = {0};
  const char *invalid = NULL;
  chkin_c(outer);
  chkin_c(inner);
  // DLABNS explicitly checks write access before it reads any control words.
  if (mode == DLA_BEGIN) dassih_(&h, "WRITE", 5);
  if (!failed_c()) daslla_(&h, &lastc, &lastd, &high);
  if (!failed_c() && (high < 0 || high > INT_MAX / 256 * 256))
    invalid = "DLA integer address exceeds the supported DAS extent";
  if (!invalid && !failed_c()) {
    if (mode == DLA_BEGIN) {
      dla_read(h, high, 2, 3, control);
      backward = control[1];
    } else if (mode != DLA_PREVIOUS) {
      dla_read(h, high, 3, 3, &backward);
    }
  }
  if (!invalid && !failed_c() && (backward != SPICE_DLA_NULPTR || mode == DLA_END)) {
    if (backward > INT_MAX - 7) {
      invalid = "DLA descriptor address exceeds signed word range";
    } else if (backward > 0 && backward < 4) {
      invalid = "DLA descriptor overlaps the file control words";
    } else {
      dla_read(h, high, backward, backward + 7, descriptor);
      if (!failed_c() && mode == DLA_END &&
          (descriptor[2] < 0 || descriptor[2] > high ||
           descriptor[4] < 0 || descriptor[4] > lastd ||
           descriptor[6] < 0 || descriptor[6] > lastc))
        invalid = "DLA segment bases exceed current logical data extents";
    }
  }
  chkout_c(inner);
  chkout_c(outer);
  if (failed_c()) return finish_das_call(err, room);
  if (invalid) return das_data_invalid(err, room, invalid);
  *oldHigh = high;
  return 0;
}

int tspice_dlabns(int handle, char *err, int room) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, room)) return 1;
  int oldHigh = 0;
  if (dla_prepare(handle, "dlabns_c", "DLABNS", DLA_BEGIN, 0, &oldHigh, err, room) ||
      check_das_append(handle, 3, 8, &oldHigh, err, room)) return 1;
  dlabns_c(handle);
  if (failed_c()) return finish_das_call(err, room);
  // The descriptor itself was appended through DASADI. Apply C05's padding
  // policy when those eight words created a new partial physical record.
  return clear_new_das_tail(handle, 3, oldHigh, 8, err, room);
}

int tspice_dlaens(int handle, char *err, int room) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, room)) return 1;
  int high = 0;
  if (dla_prepare(handle, "dlaens_c", "DLAENS", DLA_END, 0, &high, err, room)) return 1;
  dlaens_c(handle);
  return finish_das_call(err, room);
}

int tspice_dlabbs(int handle, int32_t *out, int32_t *found, char *err, int room) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, room)) return 1;
  if (!out || !found) return das_data_invalid(err, room, "Missing DLA output storage");
  int high = 0;
  if (dla_prepare(handle, "dlabbs_c", "DLABBS", DLA_LAST, 0, &high, err, room)) return 1;
  SpiceDLADescr descriptor = {0};
  SpiceBoolean present = SPICEFALSE;
  dlabbs_c(handle, &descriptor, &present);
  if (failed_c()) return finish_das_call(err, room);
  *found = present != SPICEFALSE;
  if (*found) tspice_write_dla_descr8(&descriptor, out);
  return 0;
}

int tspice_dlafps(int handle, const int32_t *input, int32_t *out, int32_t *found, char *err, int room) {
  tspice_init_cspice_error_handling_once();
  if (finish_das_call(err, room)) return 1;
  if (!input || !out || !found) return das_data_invalid(err, room, "Missing DLA descriptor storage");
  int high = 0;
  // A null previous pointer yields a miss without reading the file.
  if (input[0] != SPICE_DLA_NULPTR &&
      dla_prepare(handle, "dlafps_c", "DLAFPS", DLA_PREVIOUS, input[0], &high, err, room)) return 1;
  SpiceDLADescr current = {0}, previous = {0};
  SpiceBoolean present = SPICEFALSE;
  tspice_read_dla_descr8(input, &current);
  dlafps_c(handle, &current, &previous, &present);
  if (failed_c()) return finish_das_call(err, room);
  *found = present != SPICEFALSE;
  if (*found) tspice_write_dla_descr8(&previous, out);
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
