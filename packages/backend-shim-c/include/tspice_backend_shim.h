#ifndef TSPICE_BACKEND_SHIM_H
#define TSPICE_BACKEND_SHIM_H

#include <stdint.h>


// NAIF documents frame names as up to 32 chars + NUL.
#define TSPICE_FRNAME_MAX_BYTES 33

#ifdef __cplusplus
extern "C" {
#endif

// Error-free scalar constants. These allocate nothing and preserve SPICE error state.
double tspice_pi(void);
double tspice_twopi(void);
double tspice_halfpi(void);
double tspice_dpr(void);
double tspice_rpd(void);
double tspice_spd(void);
double tspice_j2000(void);
double tspice_j1900(void);
double tspice_b1950(void);

// Error-free scalar constants. These allocate nothing and preserve SPICE error state.
double tspice_clight(void);
double tspice_dpmax(void);
double tspice_dpmin(void);
int tspice_intmax(void);
int tspice_intmin(void);
double tspice_b1900(void);
double tspice_j1950(void);
double tspice_j2100(void);
double tspice_jyear(void);
double tspice_tyear(void);

// Coordinate conversions: output is an independent triple in CSPICE argument order.
int tspice_cyllat(double radius, double lon, double z, double *out3, char *err, int errMaxBytes);
int tspice_cylrec(double radius, double lon, double z, double *out3, char *err, int errMaxBytes);
int tspice_cylsph(double radius, double lon, double z, double *out3, char *err, int errMaxBytes);
int tspice_latcyl(double radius, double lon, double lat, double *out3, char *err, int errMaxBytes);
int tspice_latsph(double radius, double lon, double lat, double *out3, char *err, int errMaxBytes);
int tspice_reccyl(const double *rect3, double *out3, char *err, int errMaxBytes);
int tspice_sphcyl(double radius, double colat, double lon, double *out3, char *err, int errMaxBytes);
int tspice_sphlat(double radius, double colat, double lon, double *out3, char *err, int errMaxBytes);

// Basic vector operations; outputs are copied into caller-owned buffers.
int tspice_vdist(const double *a, const double *b, double *out, char *err, int errMaxBytes);
int tspice_vequ(const double *v, double *out, char *err, int errMaxBytes);
int tspice_vpack(double x, double y, double z, double *out, char *err, int errMaxBytes);
int tspice_vupack(const double *v, double *out, char *err, int errMaxBytes);
int tspice_vzero(const double *v, int *out, char *err, int errMaxBytes);
int tspice_unorm(const double *v, double *outUnit3, double *outNorm, char *err, int errMaxBytes);
int tspice_ucrss(const double *a, const double *b, double *out, char *err, int errMaxBytes);
int tspice_vsep(const double *a, const double *b, double *out, char *err, int errMaxBytes);

// --- CSPICE error handling helpers ---
//
// These helpers are a stable ABI surface. Callers should treat them as part of
// the public C shim contract.
void tspice_init_cspice_error_handling_once(void);

// Writes the current CSPICE error message (if any) into `err` (up to
// `errMaxBytes`, including a trailing NUL), then calls `reset_c()`.
//
// Returns 0.
int tspice_get_spice_error_message_and_reset(char *err, int errMaxBytes);

// Retrieve the most recent error message parts captured by
// tspice_get_spice_error_message_and_reset(). These do not modify CSPICE error
// status.
int tspice_get_last_error_short(char *out, int outMaxBytes);
int tspice_get_last_error_long(char *out, int outMaxBytes);
int tspice_get_last_error_trace(char *out, int outMaxBytes);

// Clears process-global structured last-error buffers (short/long/trace)
// without modifying CSPICE error status.
//
// Useful for non-CSPICE validation errors, where JS backends should not attach
// stale `spiceShort`/`spiceLong`/`spiceTrace` fields.
void tspice_clear_last_error_buffers(void);

// --- CSPICE error/status utilities ---
int tspice_failed(int *outFailed, char *err, int errMaxBytes);
int tspice_reset(char *err, int errMaxBytes);
int tspice_getmsg(const char *which, char *out, int outMaxBytes, char *err, int errMaxBytes);
int tspice_setmsg(const char *message, char *err, int errMaxBytes);
int tspice_sigerr(const char *shortMsg, char *err, int errMaxBytes);
int tspice_chkin(const char *name, char *err, int errMaxBytes);
int tspice_chkout(const char *name, char *err, int errMaxBytes);

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes);

int tspice_furnsh(const char *path, char *err, int errMaxBytes);

int tspice_unload(const char *path, char *err, int errMaxBytes);

int tspice_kclear(char *err, int errMaxBytes);

int tspice_ktotal(const char *kind, int *outCount, char *err, int errMaxBytes);

int tspice_kdata(
    int which,
    const char *kind,
    char *file,
    int fileMaxBytes,
    char *filtyp,
    int filtypMaxBytes,
    char *source,
    int sourceMaxBytes,
    int *outHandle,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_kinfo(
    const char *path,
    char *filtyp,
    int filtypMaxBytes,
    char *source,
    int sourceMaxBytes,
    int *outHandle,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_kxtrct(
    const char *keywd,
    int termlen,
    const char *terms,
    int nterms,
    const char *wordsqIn,
    char *wordsqOut,
    int wordsqOutMaxBytes,
    char *substr,
    int substrMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_kplfrm(int frmcls, uintptr_t idset, char *err, int errMaxBytes);

// Returns the number of loaded kernels, or -1 on error (with message in `err`).
int tspice_ktotal_all(char *err, int errMaxBytes);


// --- file i/o primitives ---------------------------------------------------

int tspice_exists(const char *path, int *outExists, char *err, int errMaxBytes);

int tspice_getfat(
    const char *path,
    char *outArch,
    int outArchMaxBytes,
    char *outType,
    int outTypeMaxBytes,
    char *err,
    int errMaxBytes);

// --- DAF -------------------------------------------------------------------

// Pinned N0067 DAF summary uses at most 125 double words.
#define TSPICE_DAF_SUMMARY_BYTES 1000
#define TSPICE_DAF_NAME_BYTES (TSPICE_DAF_SUMMARY_BYTES + 1)
int tspice_dafps(int nd, int ni, const double *dc, int dcCount, const int *ic, int icCount,
                 unsigned char *out, int room, char *err, int errMaxBytes);
int tspice_dafus(const unsigned char *summary, int size, int nd, int ni, double *dc, int dcRoom,
                 int *ic, int icRoom, char *err, int errMaxBytes);
int tspice_dafgsr(int handle, int recno, int begin, int end, unsigned char *out, int room,
                  int *outFound, char *err, int errMaxBytes);
int tspice_dafrfr(int handle, int ifnlen, char *ifname, int room, int *fields, char *err,
                  int errMaxBytes);
int tspice_dafrda(int handle, int begin, int end, double *words, int room, char *err,
                  int errMaxBytes);
int tspice_dafgda(int handle, int begin, int end, double *words, int room, char *err,
                  int errMaxBytes);
int tspice_dafbbs(int handle, char *err, int errMaxBytes);
int tspice_dafcs(int handle, char *err, int errMaxBytes);
int tspice_daffpa(int handle, int *outFound, char *err, int errMaxBytes);
int tspice_dafgh(int *outHandle, char *err, int errMaxBytes);
int tspice_dafgn(int handle, int namlen, char *out, char *err, int errMaxBytes);
#define TSPICE_DAF_PAGE_BYTES (256 * 1024 * 1024)
int tspice_dafac(int handle, int n, int width, const unsigned char *rows, int room, char *err, int errMaxBytes);
int tspice_dafdc(int handle, char *err, int errMaxBytes);
int tspice_dafec(int handle, int rows, int width, unsigned char *out, int room, int *n, int *done, char *err, int errMaxBytes);
int tspice_dafrs(int handle, const unsigned char *summary, int bytes, char *err, int errMaxBytes);
int tspice_dafgs(int handle, unsigned char *out, int room, int *bytes, char *err, int errMaxBytes);
int tspice_dafhsf(int handle, int *nd, int *ni, char *err, int errMaxBytes);
int tspice_dafopw(const char *path, int *outHandle, char *err, int errMaxBytes);
int tspice_dafopr(const char *path, int *outHandle, char *err, int errMaxBytes);
int tspice_dafcls(int handle, char *err, int errMaxBytes);
int tspice_dafbfs(int handle, char *err, int errMaxBytes);

// Selects the current DAF via `dafcs_c(handle)` and then calls `daffna_c`.
//
// `outFound` is required (non-NULL) to keep ABI usage explicit and consistent
// with the DLA APIs.
int tspice_daffna(int handle, int *outFound, char *err, int errMaxBytes);

// --- DAS -------------------------------------------------------------------

// Full N0067 DAS name/header byte capacities, including the C terminator.
#define TSPICE_DAS_COMMENT_BYTES (256 * 1024 * 1024)
int tspice_dasac(int handle, int n, int width, const unsigned char *rows, int room, char *err, int errMaxBytes);
int tspice_dasdc(int handle, char *err, int errMaxBytes);
int tspice_dasec(int handle, int rows, int width, unsigned char *out, int room, int *n, int *done, char *err, int errMaxBytes);
#define TSPICE_DAS_PATH_BYTES 256
#define TSPICE_DAS_ID_BYTES 9
#define TSPICE_DAS_IFNAME_BYTES 61
// Same transfer ceiling on native and wasm32; actual allocation may fail earlier.
#define TSPICE_DAS_DATA_MAX_BYTES (256 * 1024 * 1024)
int tspice_dasadc(int handle, int n, int bpos, int epos, int datlen, const unsigned char *data, int length, char *err, int errMaxBytes);
int tspice_dasadd(int handle, int n, const double *data, int length, char *err, int errMaxBytes);
int tspice_dasadi(int handle, int n, const int *data, int length, char *err, int errMaxBytes);
int tspice_dasrdc(int handle, int first, int last, int bpos, int epos, int datlen, unsigned char *data, int length, char *err, int errMaxBytes);
int tspice_dasrdd(int handle, int first, int last, double *data, int length, char *err, int errMaxBytes);
int tspice_dasrdi(int handle, int first, int last, int *data, int length, char *err, int errMaxBytes);
int tspice_dasudc(int handle, int first, int last, int bpos, int epos, int datlen, const unsigned char *data, int length, char *err, int errMaxBytes);
int tspice_dasudd(int handle, int first, int last, const double *data, int length, char *err, int errMaxBytes);
int tspice_dasudi(int handle, int first, int last, const int *data, int length, char *err, int errMaxBytes);

int tspice_dasonw(const char *path, const char *ftype, const char *ifname, int ncomr, int *out, char *err, int errMaxBytes);
int tspice_dasops(int *out, char *err, int errMaxBytes);
int tspice_dasopw(const char *path, int *out, char *err, int errMaxBytes);
int tspice_dashfn(int handle, int namlen, char *name, char *err, int errMaxBytes);
int tspice_dashfs(int handle, int *out, char *err, int errMaxBytes);
int tspice_daslla(int handle, int *out, char *err, int errMaxBytes);
int tspice_dasllc(int handle, char *err, int errMaxBytes);
int tspice_dasrfr(int handle, int idwlen, int ifnlen, char *idword, char *ifname, int *out, char *err, int errMaxBytes);
int tspice_daswbr(int handle, char *err, int errMaxBytes);

int tspice_dasopr(const char *path, int *outHandle, char *err, int errMaxBytes);
int tspice_dascls(int handle, char *err, int errMaxBytes);

// --- DLA (DAS-backed) ------------------------------------------------------

int tspice_dlaopn(
    const char *path,
    const char *ftype,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes);

// Writes a DLA descriptor as 8 int32s in this order:
// [bwdptr, fwdptr, ibase, isize, dbase, dsize, cbase, csize]
int tspice_dlabns(int handle, char *err, int room);
int tspice_dlaens(int handle, char *err, int room);
int tspice_dlabbs(int handle, int32_t *out, int32_t *found, char *err, int room);
int tspice_dlafps(int handle, const int32_t *input, int32_t *out, int32_t *found, char *err, int room);
int tspice_dlabfs(int handle, int32_t *outDescr8, int32_t *outFound, char *err, int errMaxBytes);
int tspice_dlafns(
    int handle,
    const int32_t *descr8,
    int32_t *outNextDescr8,
    int32_t *outFound,
    char *err,
    int errMaxBytes);

// Close a DLA handle (DLA is DAS-backed).
int tspice_dlacls(int handle, char *err, int errMaxBytes);

// --- EK --------------------------------------------------------------------

int tspice_ek_entry_extent(int handle, int segno, int recno, const char *column, int kind, int width, int *count, char *err, int errMaxBytes);
int tspice_ekacec(int handle, int segno, int recno, const char *column, int count, int width, const char *values, int isNull, char *err, int errMaxBytes);
int tspice_ekaced(int handle, int segno, int recno, const char *column, int count, const double *values, int isNull, char *err, int errMaxBytes);
int tspice_ekacei(int handle, int segno, int recno, const char *column, int count, const int *values, int isNull, char *err, int errMaxBytes);
int tspice_ekrcec(int handle, int segno, int recno, const char *column, int width, char *values, int capacity, int *nvals, int *isNull, char *err, int errMaxBytes);
int tspice_ekrced(int handle, int segno, int recno, const char *column, double *values, int capacity, int *nvals, int *isNull, char *err, int errMaxBytes);
int tspice_ekrcei(int handle, int segno, int recno, const char *column, int *values, int capacity, int *nvals, int *isNull, char *err, int errMaxBytes);
int tspice_ekucec(int handle, int segno, int recno, const char *column, int count, int width, const char *values, int isNull, char *err, int errMaxBytes);
int tspice_ekuced(int handle, int segno, int recno, const char *column, int count, const double *values, int isNull, char *err, int errMaxBytes);
int tspice_ekucei(int handle, int segno, int recno, const char *column, int count, const int *values, int isNull, char *err, int errMaxBytes);

int tspice_ekops(int *out, char *err, int errMaxBytes);
int tspice_ekbseg(int handle, const char *table, int count, int nameWidth, const char *names, int declWidth, const char *decls, int *out, char *err, int errMaxBytes);
int tspice_ekappr(int handle, int segment, int *out, char *err, int errMaxBytes);
int tspice_ekinsr(int handle, int segment, int row, char *err, int errMaxBytes);
int tspice_ekdelr(int handle, int segment, int row, char *err, int errMaxBytes);

int tspice_ekccnt(const char *table, int *count, char *err, int errMaxBytes);
int tspice_ekcii(const char *table, int index, int width, int *words, char *name, char *err, int errMaxBytes);
int tspice_eklef(const char *path, int *generation, char *err, int errMaxBytes);
int tspice_eknelt(int selectIndex, int row, int *count, char *err, int errMaxBytes);
int tspice_ekpsel(const char *query, int *words, char *text, char *err, int errMaxBytes);
int tspice_ekssum(int id, int loaded, int segment, int *words, char *text, char *err, int errMaxBytes);
int tspice_ekuef(int generation, char *err, int errMaxBytes);
int tspice_ekload_nseg(int generation, int *count, char *err, int errMaxBytes);

int tspice_ekopr(const char *path, int *outHandle, char *err, int errMaxBytes);
int tspice_ekopw(const char *path, int *outHandle, char *err, int errMaxBytes);

int tspice_ekopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes);

int tspice_ekcls(int handle, char *err, int errMaxBytes);

int tspice_ekntab(int *outN, char *err, int errMaxBytes);

int tspice_ektnam(
    int n,
    char *outName,
    int outNameMaxBytes,
    char *err,
    int errMaxBytes);

int tspice_eknseg(int handle, int *outNseg, char *err, int errMaxBytes);

// --- EK query/data ops -----------------------------------------------------

int tspice_ekfind(
    const char *query,
    int outErrmsgMaxBytes,
    int *outNmrows,
    int *outError,
    char *outErrmsg,
    char *err,
    int errMaxBytes);

int tspice_ekgc(
    int selidx,
    int row,
    int elment,
    char *outCdata,
    int outCdataMaxBytes,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_ekgd(
    int selidx,
    int row,
    int elment,
    double *outDdata,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_ekgi(
    int selidx,
    int row,
    int elment,
    int *outIdata,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes);

// --- EK fast write ---------------------------------------------------------

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
    int errMaxBytes);

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
    int errMaxBytes);

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
    int errMaxBytes);

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
    int errMaxBytes);

int tspice_ekffld(int handle, int segno, int nrows, int *rcptrs, char *err, int errMaxBytes);

// --- DSK -------------------------------------------------------------------

int tspice_dskopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes);

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
    int errMaxBytes);

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
    int errMaxBytes);

int tspice_dskobj(const char *dsk, uintptr_t bodidsCellHandle, char *err, int errMaxBytes);

int tspice_dsksrf(
    const char *dsk,
    int bodyid,
    uintptr_t srfidsCellHandle,
    char *err,
    int errMaxBytes);

// `outInts6` layout:
// [surfce, center, dclass, dtype, frmcde, corsys]
//
// `outDoubles18` layout:
// [corpar(10), co1min, co1max, co2min, co2max, co3min, co3max, start, stop]
int tspice_dskgd(
    int handle,
    const int32_t *dladscInts8,
    int32_t *outInts6,
    double *outDoubles18,
    char *err,
    int errMaxBytes);

// `outInts10` layout:
// [nv, np, nvxtot, vgrext(3), cgscal, vtxnpl, voxnpt, voxnpl]
//
// `outDoubles10` layout:
// [vtxbds(6), voxsiz, voxori(3)]
int tspice_dskb02(
    int handle,
    const int32_t *dladscInts8,
    int32_t *outInts10,
    double *outDoubles10,
    char *err,
    int errMaxBytes);

// --- Kernel pool -----------------------------------------------------------

// N0067 pool MAXVAL, MAXLIN and MAXCHR bound the largest meaningful output buffers.
#define TSPICE_POOL_MAX_VALUES 400000
#define TSPICE_POOL_MAX_CHAR_ROWS 15000
#define TSPICE_POOL_TEXT_CAPACITY (TSPICE_POOL_MAX_CHAR_ROWS * 80 + 1)
int tspice_badkpv(const char *caller, const char *name, const char *comp, int size, int divby, int type, int *bad, char *err, int errMaxBytes);
int tspice_bodvcd(int body, const char *item, int maxn, int *dim, double *values, char *err, int errMaxBytes);
int tspice_bodvrd(const char *body, const char *item, int maxn, int *dim, double *values, char *err, int errMaxBytes);
int tspice_clpool(char *err, int errMaxBytes);
int tspice_dvpool(const char *name, char *err, int errMaxBytes);
int tspice_ldpool(const char *path, char *err, int errMaxBytes);
int tspice_lmpool(const char *rows, int stride, int count, char *err, int errMaxBytes);
int tspice_stpool(const char *item, int nth, const char *contin, int lenout, char *text, int *size, int *found, char *err, int errMaxBytes);
int tspice_szpool(const char *name, int *n, int *found, char *err, int errMaxBytes);

int tspice_gdpool(
    const char *name,
    int start,
    int room,
    int *outN,
    double *outValues,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_gipool(
    const char *name,
    int start,
    int room,
    int *outN,
    int *outValues,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_gcpool(
    const char *name,
    int start,
    int room,
    int cvalen,
    int *outN,
    void *outCvals,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_gnpool(
    const char *name,
    int start,
    int room,
    int cvalen,
    int *outN,
    void *outCvals,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_dtpool(
    const char *name,
    int *outFound,
    int *outN,
    char *outType,
    int outTypeMaxBytes,
    char *err,
    int errMaxBytes);

int tspice_pdpool(
    const char *name,
    int n,
    const double *values,
    char *err,
    int errMaxBytes);

int tspice_pipool(
    const char *name,
    int n,
    const int *ivals,
    char *err,
    int errMaxBytes);

int tspice_pcpool(
    const char *name,
    int n,
    int lenvals,
    const void *cvals,
    char *err,
    int errMaxBytes);

int tspice_swpool(
    const char *agent,
    int nnames,
    int namlen,
    const void *names,
    char *err,
    int errMaxBytes);

int tspice_cvpool(
    const char *agent,
    int *outUpdate,
    char *err,
    int errMaxBytes);

int tspice_expool(
    const char *name,
    int *outFound,
    char *err,
    int errMaxBytes);

// --- low-level primitives ---

// str2et_c: convert time string -> ET seconds past J2000.
int tspice_etcal(double et, int callen, char *out, char *err, int errMaxBytes);
int tspice_utc2et(const char *utc, double *et, char *err, int errMaxBytes);
int tspice_tparch(const char *type, char *err, int errMaxBytes);
int tspice_tsetyr(int year, char *err, int errMaxBytes);
int tspice_et2lst(double et, int body, double lon, const char *type, int timlen, int ampmlen,
                  int *hms, char *time, char *ampm, char *err, int errMaxBytes);
int tspice_str2et(const char *time, double *outEt, char *err, int errMaxBytes);

// et2utc_c: convert ET seconds past J2000 -> formatted UTC string.
int tspice_et2utc(
    double et,
    const char *format,
    int prec,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

// timout_c: format ET using a time picture.
int tspice_timout(
    double et,
    const char *picture,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

// deltet_c: return difference ET - UTC (Delta ET).
int tspice_deltet(
    double epoch,
    const char *eptype,
    double *outDelta,
    char *err,
    int errMaxBytes);

// unitim_c: convert time epoch from one system to another.
int tspice_unitim(
    double epoch,
    const char *insys,
    const char *outsys,
    double *outEpoch,
    char *err,
    int errMaxBytes);

// tparse_c: parse a UTC time string -> UTC seconds past J2000 (formal calendar; no leap seconds).
int tspice_tparse(const char *timstr, double *outEt, char *err, int errMaxBytes);

// tpictr_c: create a time picture from a sample time string.
int tspice_tpictr(
    const char *sample,
    const char *picturIn,
    char *outPictur,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

// timdef_c: set/get time conversion defaults.
int tspice_timdef_get(
    const char *item,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

int tspice_timdef_set(
    const char *item,
    const char *value,
    char *err,
    int errMaxBytes);

// bodn2c_c: body name -> integer code.
int tspice_bodn2c(
    const char *name,
    int *outCode,
    int *outFound,
    char *err,
    int errMaxBytes);

// bodc2n_c: body code -> name.
int tspice_bodc2n(
    int code,
    char *outName,
    int outNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_srfc2s(int code, int bodyId, int srflen, char *outText, int *outIsName, char *err, int errMaxBytes);
int tspice_srfcss(int code, const char *body, int srflen, char *outText, int *outIsName, char *err, int errMaxBytes);
int tspice_srfs2c(const char *surface, const char *body, int *outCode, int *outFound, char *err, int errMaxBytes);
int tspice_srfscc(const char *surface, int bodyId, int *outCode, int *outFound, char *err, int errMaxBytes);
// bodc2s_c: body code -> mapped name (or decimal string if unknown).
int tspice_bodc2s(
    int code,
    char *outName,
    int outNameMaxBytes,
    char *err,
    int errMaxBytes);

// bods2c_c: body name (or numeric string) -> integer code.
int tspice_bods2c(
    const char *name,
    int *outCode,
    int *outFound,
    char *err,
    int errMaxBytes);

// boddef_c: define a body name/code mapping (side effect).
int tspice_boddef(
    const char *name,
    int code,
    char *err,
    int errMaxBytes);

// bodfnd_c: return true if body constant exists in the kernel pool.
int tspice_bodfnd(
    int body,
    const char *item,
    int *outResult,
    char *err,
    int errMaxBytes);

// bodvar_c: return values of a body constant from the kernel pool.
//
// NOTE: CSPICE's `bodvar_c` is deprecated; this shim uses `bodvcd_c`
// under the hood to allow the caller to bound output size.
//
// Missing-item semantics:
// - If the requested item is not found for the body, this returns success with
//   `*outDim = 0`. Call `tspice_bodfnd` if you need a strict presence check.
// - maxn == 0 queries the numeric dimension in outDim without writing values;
//   adapters can then allocate the exact required output storage.
int tspice_bodvar(
    int body,
    const char *item,
    int maxn,
    int *outDim,
    double *outValues,
    char *err,
    int errMaxBytes);

// namfrm_c: frame name -> frame id.
int tspice_namfrm(
    const char *frameName,
    int *outFrameId,
    int *outFound,
    char *err,
    int errMaxBytes);

// frmnam_c: frame id -> frame name.
int tspice_frmnam(
    int frameId,
    char *outFrameName,
    int outFrameNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes);

// cidfrm_c: frame info from body id.
int tspice_cidfrm(
    int center,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes);

// cnmfrm_c: frame info from body name.
int tspice_cnmfrm(
    const char *centerName,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes);

// frinfo_c: frame code -> frame center/class/classId.
int tspice_frinfo(
    int frameId,
    int *outCenter,
    int *outFrameClass,
    int *outClassId,
    int *outFound,
    char *err,
    int errMaxBytes);

// ccifrm_c: frame class/classId -> frame code/name/center.
//
// If `outFrname` is non-NULL and `outFrnameMaxBytes > 0`, the buffer
// must be at least `TSPICE_FRNAME_MAX_BYTES` (33, including the trailing NUL).
// Smaller buffers are rejected with an error to avoid silent truncation.
int tspice_ccifrm(
    int frameClass,
    int classId,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outCenter,
    int *outFound,
    char *err,
    int errMaxBytes);

int tspice_bltfrm(int frameClass, uintptr_t handle, char *err, int errMaxBytes);
int tspice_pxfrm2(const char *from, const char *to, double etfrom, double etto, double *out, char *err, int errMaxBytes);
int tspice_tipbod(const char *ref, int body, double et, double *out, char *err, int errMaxBytes);
int tspice_tisbod(const char *ref, int body, double et, double *out, char *err, int errMaxBytes);
int tspice_tkfram(int typeId, double *out, int *frame, int *found, char *err, int errMaxBytes);
int tspice_xfmsta(const double *state, const char *from, const char *to, const char *body, double *out, char *err, int errMaxBytes);

// pxform_c: compute frame transformation matrix.
//
// Output matrix is written as 9 doubles in row-major order:
// [m00, m01, m02, m10, m11, m12, m20, m21, m22]
int tspice_pxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix3x3,
    char *err,
    int errMaxBytes);

// sxform_c: compute state transformation matrix.
//
// Output matrix is written as 36 doubles in row-major order.
// Frame algebra uses flat row-major matrices and position/velocity state vectors.
int tspice_frame(
    const double *x, double *outX, double *outY, double *outZ, char *err, int errMaxBytes);
int tspice_twovec(
    const double *axdef, int indexa, const double *plndef, int indexp, double *outRotation, char *err, int errMaxBytes);
int tspice_twovxf(
    const double *axdef, int indexa, const double *plndef, int indexp, double *outXform, char *err, int errMaxBytes);
int tspice_eul2xf(
    const double *eulang, int axisa, int axisb, int axisc, double *outXform, char *err, int errMaxBytes);
int tspice_xf2eul(
    const double *xform, int axisa, int axisb, int axisc, double *outEulang, int *outUnique, char *err, int errMaxBytes);
int tspice_xf2rav(
    const double *xform, double *outRot, double *outAv, char *err, int errMaxBytes);
int tspice_rav2xf(
    const double *rot, const double *av, double *outXform, char *err, int errMaxBytes);
int tspice_invstm(
    const double *mat, double *outInvmat, char *err, int errMaxBytes);
int tspice_xpose6(
    const double *m1, double *outMout, char *err, int errMaxBytes);

int tspice_sxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix6x6,
    char *err,
    int errMaxBytes);

// spkezr_c: compute state (6 doubles) and light time.
int tspice_spkezr(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes);

// spkpos_c: compute position (3 doubles) and light time.
int tspice_spkpos(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes);

// spkez_c: compute state (6 doubles) and light time (numeric IDs).
int tspice_spkez(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes);

// spkezp_c: compute position (3 doubles) and light time (numeric IDs).
int tspice_spkezp(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes);

// spkgeo_c: compute geometric state (6 doubles) and light time (numeric IDs).
int tspice_spkgeo(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes);

// spkgps_c: compute geometric position (3 doubles) and light time (numeric IDs).
int tspice_spkgps(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes);

// illumg_c: compute illumination angles at a surface point, using a caller-specified
// illumination source body.
int tspice_illumg(
    const char *method,
    const char *target,
    const char *ilusrc,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *obsrvr,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    char *err,
    int errMaxBytes);

// illumf_c: compute illumination angles + visibility/lighting flags at a surface point.
//
// `outVisibl` and `outLit` are written as integer 0/1 values.
int tspice_illumf(
    const char *method,
    const char *target,
    const char *ilusrc,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *obsrvr,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    int *outVisibl,
    int *outLit,
    char *err,
    int errMaxBytes);

// spkssb_c: compute state (6 doubles) of target body relative to SSB.
int tspice_spkssb(
    int target,
    double et,
    const char *ref,
    double *outState6,
    char *err,
    int errMaxBytes);

// --- plane helpers ---

// nvc2pl_c: normal vector + constant -> plane.
//
// Output plane is written as 4 doubles: [normalX, normalY, normalZ, constant]
int tspice_nvc2pl(
    const double *normal3,
    double konst,
    double *outPlane4,
    char *err,
    int errMaxBytes);

// pl2nvc_c: plane -> unit normal vector + constant.
//
// Input plane must be a length-4 array: [normalX, normalY, normalZ, constant]
int tspice_pl2nvc(
    const double *plane4,
    double *outNormal3,
    double *outKonst,
    char *err,
    int errMaxBytes);

// spkcov_c: compute the coverage window for an object in an SPK file.
int tspice_spkcov(
    const char *spk,
    int idcode,
    uintptr_t coverWindowHandle,
    char *err,
    int errMaxBytes);

// spkobj_c: find the set of objects present in an SPK file.
int tspice_spkobj(
    const char *spk,
    uintptr_t idsCellHandle,
    char *err,
    int errMaxBytes);

// spksfs_c: select the highest-priority segment for a body+time from loaded SPKs.
//
// Segment identifiers may be up to 40 characters; `outIdentMaxBytes` must be
// at least 41 (including trailing NUL).
int tspice_spksfs(
    int body,
    double et,
    int *outHandle,
    double *outDescr5,
    char *outIdent,
    int outIdentMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes);

// spkpds_c: pack an SPK segment descriptor.
int tspice_spkpds(
    int body,
    int center,
    const char *frame,
    int type,
    double first,
    double last,
    double *outDescr5,
    char *err,
    int errMaxBytes);

// spkuds_c: unpack a packed SPK segment descriptor.
int tspice_spkuds(
    const double *descr5,
    int *outBody,
    int *outCenter,
    int *outFrame,
    int *outType,
    double *outFirst,
    double *outLast,
    int *outBaddr,
    int *outEaddr,
    char *err,
    int errMaxBytes);

// --- SPK writers --------------------------------------------------------

// spkopn_c: open a new SPK file for write.
int tspice_spkopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes);

// spkopa_c: open an existing SPK file for append.
int tspice_spkopa(const char *path, int *outHandle, char *err, int errMaxBytes);

// spkcls_c: close an SPK file handle.
int tspice_spkcls(int handle, char *err, int errMaxBytes);

// spkw08_c: write a type 8 segment (equal time steps, Lagrange interpolation).
//
// `states6n` is a flat array of length `n*6` doubles.
// `epoch1` is the epoch of the first state record; successive epochs are `epoch1 + i*step`.
int tspice_spkw08(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes);

// spkw08_c (v2): like tspice_spkw08, but validates `states6nLen == 6*n` before
// casting.
int tspice_spkw08_v2(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    int states6nLen,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes);

// --- Derived geometry primitives ---

// subpnt_c: compute the sub-observer point on a target body's surface.
int tspice_subpnt(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    char *err,
    int errMaxBytes);

// subslr_c: compute the sub-solar point on a target body's surface.
int tspice_subslr(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    char *err,
    int errMaxBytes);

// sincpt_c: compute the surface intercept point of a ray.
int tspice_sincpt(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    const char *dref,
    const double *dvec3,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    int *outFound,
    char *err,
    int errMaxBytes);

// ilumin_c: compute illumination angles at a surface point.
int tspice_ilumin(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    char *err,
    int errMaxBytes);

// occult_c: determine occultation condition code for one target vs another.
int tspice_occult(
    const char *targ1,
    const char *shape1,
    const char *frame1,
    const char *targ2,
    const char *shape2,
    const char *frame2,
    const char *abcorr,
    const char *observer,
    double et,
    int *outOcltid,
    char *err,
    int errMaxBytes);

// --- GF (Geometry Finder) event finding ---

// gfsstp_c: set the constant step size used by gfstep_c.
int tspice_gfsstp(double step, char *err, int errMaxBytes);

// gfstep_c: return the constant step size set by gfsstp_c.
int tspice_gfstep(double time, double *outStep, char *err, int errMaxBytes);

// gfstol_c: set GF convergence tolerance.
int tspice_gfstol(double value, char *err, int errMaxBytes);

// gfrefn_c: default refinement estimator.
int tspice_gfrefn(double t1, double t2, int s1, int s2, double *outT, char *err, int errMaxBytes);

// gfrepi_c: progress report init.
int tspice_gfrepi(uintptr_t windowHandle, const char *begmss, const char *endmss, char *err, int errMaxBytes);

// gfrepf_c: progress report finalize.
int tspice_gfrepf(char *err, int errMaxBytes);

// gfsep_c: angular separation search.
int tspice_gfsep(
    const char *targ1,
    const char *shape1,
    const char *frame1,
    const char *targ2,
    const char *shape2,
    const char *frame2,
    const char *abcorr,
    const char *obsrvr,
    const char *relate,
    double refval,
    double adjust,
    double step,
    int nintvls,
    uintptr_t cnfineWindowHandle,
    uintptr_t resultWindowHandle,
    char *err,
    int errMaxBytes);

// gfdist_c: observer-target distance search.
int tspice_gfdist(
    const char *target,
    const char *abcorr,
    const char *obsrvr,
    const char *relate,
    double refval,
    double adjust,
    double step,
    int nintvls,
    uintptr_t cnfineWindowHandle,
    uintptr_t resultWindowHandle,
    char *err,
    int errMaxBytes);

// --- coordinate conversions + small vector/matrix helpers ---

// vlcom_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vlcom(double a, const double *v1, double b, const double *v2, double *out, char *err, int errMaxBytes);
// vlcom3_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vlcom3(double a, const double *v1, double b, const double *v2, double c, const double *v3, double *out, char *err, int errMaxBytes);
// vperp_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vperp(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// vproj_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vproj(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// vrel_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vrel(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// vrotv_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vrotv(const double *v, const double *axis, double theta, double *out, char *err, int errMaxBytes);
// rotvec_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_rotvec(const double *v, double angle, int axis, double *out, char *err, int errMaxBytes);
// vtmv_c: preserved argument order; vector/matrix inputs are borrowed.
int tspice_vtmv(const double *v1, const double *matrix, const double *v2, double *out, char *err, int errMaxBytes);

// azlrec_c: out stores rectangular x, y, z.
int tspice_azlrec(double range, double az, double el, int azccw, int elplsz, double *out, char *err, int errMaxBytes);
// recazl_c: out stores range, az, el.
int tspice_recazl(const double *rect, int azccw, int elplsz, double *out, char *err, int errMaxBytes);
// pgrrec_c: out stores rectangular x, y, z.
int tspice_pgrrec(const char *body, double lon, double lat, double alt, double re, double f, double *out, char *err, int errMaxBytes);
// recpgr_c: out stores lon, lat, alt.
int tspice_recpgr(const char *body, const double *rect, double re, double f, double *out, char *err, int errMaxBytes);
// radrec_c: out stores rectangular x, y, z.
int tspice_radrec(double range, double ra, double dec, double *out, char *err, int errMaxBytes);
// recrad_c: out stores range, ra, dec.
int tspice_recrad(const double *rect, double *out, char *err, int errMaxBytes);
// srfrec_c: out stores rectangular x, y, z.
int tspice_srfrec(int body, double lon, double lat, double *out, char *err, int errMaxBytes);

// brcktd_c: preserves CSPICE argument order.
int tspice_brcktd(double value, double end1, double end2, double *out, char *err, int errMaxBytes);
// brckti_c: preserves CSPICE argument order.
int tspice_brckti(int value, int end1, int end2, int *out, char *err, int errMaxBytes);
// convrt_c: preserves CSPICE argument order.
int tspice_convrt(double value, const char *inUnit, const char *outUnit, double *out, char *err, int errMaxBytes);
// sumad_c: array length supplies count.
int tspice_sumad(const double *values, int count, double *out, char *err, int errMaxBytes);
// sumai_c: array length supplies count.
int tspice_sumai(const int *values, int count, int *out, char *err, int errMaxBytes);
// maxd_c: array length supplies count.
int tspice_maxd(const double *values, int count, double *out, char *err, int errMaxBytes);
// maxi_c: array length supplies count.
int tspice_maxi(const int *values, int count, int *out, char *err, int errMaxBytes);
// mind_c: array length supplies count.
int tspice_mind(const double *values, int count, double *out, char *err, int errMaxBytes);
// mini_c: array length supplies count.
int tspice_mini(const int *values, int count, int *out, char *err, int errMaxBytes);

// ducrss_c: input states contain six doubles; out contains six doubles.
int tspice_ducrss(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// dvcrss_c: input states contain six doubles; out contains six doubles.
int tspice_dvcrss(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// dvdot_c: input states contain six doubles; out contains one double.
int tspice_dvdot(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// dvhat_c: input states contain six doubles; out contains six doubles.
int tspice_dvhat(const double *state, double *out, char *err, int errMaxBytes);
// dvnorm_c: input states contain six doubles; out contains one double.
int tspice_dvnorm(const double *state, double *out, char *err, int errMaxBytes);
// dvsep_c: input states contain six doubles; out contains one double.
int tspice_dvsep(const double *a, const double *b, double *out, char *err, int errMaxBytes);

// chbder_c: adapters infer degree from ncoeff; empty buffers remain non-NULL.
int tspice_chbder(const double *cp, int ncoeff, const double x2s[2], double x, int nderiv, double *workspace, double *out, char *err, int errMaxBytes);
// chbigr_c: adapters infer degree from ncoeff; empty buffers remain non-NULL.
int tspice_chbigr(const double *cp, int ncoeff, const double x2s[2], double x, double *outP, double *outIntegral, char *err, int errMaxBytes);
// chbint_c: adapters infer degree from ncoeff; empty buffers remain non-NULL.
int tspice_chbint(const double *cp, int ncoeff, const double x2s[2], double x, double *outP, double *outDerivative, char *err, int errMaxBytes);
// chbval_c: adapters infer degree from ncoeff; empty buffers remain non-NULL.
int tspice_chbval(const double *cp, int ncoeff, const double x2s[2], double x, double *out, char *err, int errMaxBytes);
// polyds_c: adapters infer degree from ncoeff; empty buffers remain non-NULL.
int tspice_polyds(const double *coeffs, int ncoeff, int nderiv, double t, double *out, char *err, int errMaxBytes);
// rquad_c: adapters infer degree from ncoeff; empty buffers remain non-NULL.
int tspice_rquad(double a, double b, double c, double root1[2], double root2[2], char *err, int errMaxBytes);

// hrmesp_c: inferred count, non-NULL buffers, guarded toolkit workspace/index sizes.
int tspice_hrmesp(int n, double first, double step, const double *yvals, double x, double *outF, double *outDerivative, char *err, int errMaxBytes);
// hrmint_c: inferred count, non-NULL buffers, guarded toolkit workspace/index sizes.
int tspice_hrmint(int n, const double *xvals, const double *yvals, double x, double *work, double *outF, double *outDerivative, char *err, int errMaxBytes);
// lgresp_c: inferred count, non-NULL buffers, guarded toolkit workspace/index sizes.
int tspice_lgresp(int n, double first, double step, const double *yvals, double x, double *out, char *err, int errMaxBytes);
// lgrind_c: inferred count, non-NULL buffers, guarded toolkit workspace/index sizes.
int tspice_lgrind(int n, const double *xvals, const double *yvals, double *work, double x, double *outP, double *outDerivative, char *err, int errMaxBytes);
// lgrint_c: inferred count, non-NULL buffers, guarded toolkit workspace/index sizes.
int tspice_lgrint(int n, const double *xvals, const double *yvals, double x, double *out, char *err, int errMaxBytes);
// qderiv_c: inferred count, non-NULL buffers, guarded toolkit workspace/index sizes.
int tspice_qderiv(int n, const double *f0, const double *f2, double delta, double *out, char *err, int errMaxBytes);

// Array capacities are in elements. Empty buffers still have a non-NULL address.
int tspice_clearc(
    int ndim, int arrlen, unsigned char *bytes, int length, char *err, int errMaxBytes);
int tspice_cleard(
    int ndim, double *values, int length, char *err, int errMaxBytes);
int tspice_cleari(
    int ndim, int *values, int length, char *err, int errMaxBytes);
int tspice_filld(
    double value, int ndim, double *values, int length, char *err, int errMaxBytes);
int tspice_filli(
    int value, int ndim, int *values, int length, char *err, int errMaxBytes);
int tspice_moved(
    const double *source, int sourceLength, int ndim, double *destination, int destinationLength, char *err, int errMaxBytes);

// det_c: flat row-major matrix buffers.
int tspice_eul2m(double angle3, double angle2, double angle1, int axis3, int axis2, int axis1, double *r, char *err, int errMaxBytes);
int tspice_m2eul(const double * m, int axis3, int axis2, int axis1, double *angle3, double *angle2, double *angle1, char *err, int errMaxBytes);
int tspice_m2q(const double * m, double *q, char *err, int errMaxBytes);
int tspice_q2m(const double * q, double *r, char *err, int errMaxBytes);
int tspice_qxq(const double * q1, const double * q2, double *qout, char *err, int errMaxBytes);
int tspice_qdq2av(const double * q, const double * dq, double *av, char *err, int errMaxBytes);
int tspice_raxisa(const double * m, double *axis, double *angle, char *err, int errMaxBytes);
int tspice_dazldr(double x, double y, double z, int azccw, int elplsz, double *out, char *err, int errMaxBytes);
int tspice_dcyldr(double x, double y, double z, double *out, char *err, int errMaxBytes);
int tspice_dgeodr(double x, double y, double z, double re, double f, double *out, char *err, int errMaxBytes);
int tspice_dlatdr(double x, double y, double z, double *out, char *err, int errMaxBytes);
int tspice_dpgrdr(const char *body, double x, double y, double z, double re, double f, double *out, char *err, int errMaxBytes);
int tspice_drdazl(double range, double az, double el, int azccw, int elplsz, double *out, char *err, int errMaxBytes);
int tspice_drdcyl(double radius, double lon, double z, double *out, char *err, int errMaxBytes);
int tspice_drdgeo(double lon, double lat, double alt, double re, double f, double *out, char *err, int errMaxBytes);
int tspice_drdlat(double radius, double lon, double lat, double *out, char *err, int errMaxBytes);
int tspice_drdpgr(const char *body, double lon, double lat, double alt, double re, double f, double *out, char *err, int errMaxBytes);
int tspice_drdsph(double radius, double colat, double lon, double *out, char *err, int errMaxBytes);
int tspice_dsphdr(double x, double y, double z, double *out, char *err, int errMaxBytes);

int tspice_det(const double *m, double *out, char *err, int errMaxBytes);
// diags2_c: flat row-major matrix buffers.
int tspice_diags2(const double *symmat, double *diag, double *rotate, char *err, int errMaxBytes);
// ident_c: flat row-major matrix buffers.
int tspice_ident(double *out, char *err, int errMaxBytes);
// invert_c: flat row-major matrix buffers.
int tspice_invert(const double *m, double *out, char *err, int errMaxBytes);
// invort_c: flat row-major matrix buffers.
int tspice_invort(const double *m, double *out, char *err, int errMaxBytes);
// isrot_c: flat row-major matrix buffers.
int tspice_isrot(const double *m, double ntol, double dtol, int *out, char *err, int errMaxBytes);
// mequ_c: flat row-major matrix buffers.
int tspice_mequ(const double *m, double *out, char *err, int errMaxBytes);
// mtxm_c: flat row-major matrix buffers.
int tspice_mtxm(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// mxmt_c: flat row-major matrix buffers.
int tspice_mxmt(const double *a, const double *b, double *out, char *err, int errMaxBytes);
// trace_c: flat row-major matrix buffers.
int tspice_trace(const double *m, double *out, char *err, int errMaxBytes);
// xpose_c: flat row-major matrix buffers.
int tspice_xpose(const double *m, double *out, char *err, int errMaxBytes);

// General matrices use flat row-major inputs and explicit signed dimensions.
int tspice_mequg(
    const double *m1,
    int nr,
    int nc,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_mtxmg(
    const double *m1,
    const double *m2,
    int nc1,
    int nr1r2,
    int nc2,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_mtxvg(
    const double *m1,
    const double *v2,
    int nc1,
    int nr1r2,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_mxmg(
    const double *m1,
    const double *m2,
    int nr1,
    int nc1r2,
    int nc2,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_mxmtg(
    const double *m1,
    const double *m2,
    int nr1,
    int nc1c2,
    int nr2,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_mxvg(
    const double *m1,
    const double *v2,
    int nr1,
    int nc1r2,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_vtmvg(
    const double *v1,
    const double *matrix,
    const double *v2,
    int nrow,
    int ncol,
    double *out,
    char *err,
    int errMaxBytes);
int tspice_xposeg(
    const double *matrix,
    int nrow,
    int ncol,
    double *out,
    char *err,
    int errMaxBytes);
// vaddg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vaddg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vdistg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vdistg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vdotg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vdotg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vequg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vequg(const double *v, int ndim, double *out, char *err, int errMaxBytes);
// vhatg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vhatg(const double *v, int ndim, double *out, char *err, int errMaxBytes);
// vlcomg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vlcomg(double a, const double *v1, double b, const double *v2, int ndim, double *out, char *err, int errMaxBytes);
// vminug_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vminug(const double *v, int ndim, double *out, char *err, int errMaxBytes);
// vnormg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vnormg(const double *v, int ndim, double *out, char *err, int errMaxBytes);
// vprojg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vprojg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vrelg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vrelg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vsclg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vsclg(double s, const double *v, int ndim, double *out, char *err, int errMaxBytes);
// vsepg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vsepg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vsubg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vsubg(const double *a, const double *b, int ndim, double *out, char *err, int errMaxBytes);
// vzerog_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_vzerog(const double *v, int ndim, int *out, char *err, int errMaxBytes);
// unormg_c: dimension is inferred by adapters; empty buffers remain non-NULL.
int tspice_unormg(const double *v, int ndim, double *outUnit, double *outNorm, char *err, int errMaxBytes);

int tspice_cpos(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes);
int tspice_cposr(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes);
int tspice_ncpos(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes);
int tspice_ncposr(const char *text, const char *chars, int start, int *out, char *err, int errMaxBytes);
int tspice_pos(const char *text, const char *substr, int start, int *out, char *err, int errMaxBytes);
int tspice_posr(const char *text, const char *substr, int start, int *out, char *err, int errMaxBytes);
int tspice_esrchc(const char *value, int count, int width, const char *rows, int *out, char *err, int errMaxBytes);
int tspice_dp2hx(double value, int lenout, char *text, int *size, char *err, int errMaxBytes);
int tspice_hx2dp(const char *input, int lenout, double *number, int *error, char *text, char *err, int errMaxBytes);
int tspice_prsdp(const char *input, double *number, char *err, int errMaxBytes);
int tspice_prsint(const char *input, int *number, char *err, int errMaxBytes);
int tspice_repmc(const char *input, const char *marker, const char *value, int lenout, char *text, char *err, int errMaxBytes);
int tspice_repmct(const char *input, const char *marker, int value, int rtcase, int lenout, char *text, char *err, int errMaxBytes);
int tspice_repmd(const char *input, const char *marker, double value, int sigdig, int lenout, char *text, char *err, int errMaxBytes);
int tspice_repmf(const char *input, const char *marker, double value, int sigdig, int format, int lenout, char *text, char *err, int errMaxBytes);
int tspice_repmi(const char *input, const char *marker, int value, int lenout, char *text, char *err, int errMaxBytes);
int tspice_repml(const char *input, const char *marker, int value, int rtcase, int lenout, char *text, char *err, int errMaxBytes);
int tspice_repmot(const char *input, const char *marker, int value, int rtcase, int lenout, char *text, char *err, int errMaxBytes);

int tspice_nextwd(const char *input, int nexlen, int reslen, char *next, char *rest, char *err, int errMaxBytes);
int tspice_nthwd(const char *input, int nth, int worlen, char *word, int *loc, char *err, int errMaxBytes);
int tspice_lparse(const char *list, const char *delim, int nmax, int itemln, int *n, char *items, char *err, int errMaxBytes);
int tspice_lparsm(const char *list, const char *delims, int nmax, int itemln, int *n, char *items, char *err, int errMaxBytes);
int tspice_lx4dec(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes);
int tspice_lx4num(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes);
int tspice_lx4sgn(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes);
int tspice_lx4uns(const char *input, int first, double *last, int *nchar, char *err, int errMaxBytes);
int tspice_lxqstr(const char *input, int qchar, int first, double *last, int *nchar, char *err, int errMaxBytes);
int tspice_cmprss(int delim, int n, const char *input, int lenout, char *out, char *err, int errMaxBytes);
int tspice_eqstr(const char *a, const char *b, int *out, char *err, int errMaxBytes);
int tspice_iswhsp(const char *input, int *out, char *err, int errMaxBytes);
int tspice_lastnb(const char *input, int *out, char *err, int errMaxBytes);
int tspice_lcase(char *input, int lenout, char *out, char *err, int errMaxBytes);
int tspice_ucase(char *input, int lenout, char *out, char *err, int errMaxBytes);
int tspice_matchi(const char *input, const char *templ, int wstr, int wchr, int *out, char *err, int errMaxBytes);
int tspice_matchw(const char *input, const char *templ, int wstr, int wchr, int *out, char *err, int errMaxBytes);

// Binary and linear array searches return physical indices, with -1 for a miss.
int tspice_bschoc(
    const char *key, int n, int width, const char *rows, const int *order, int *out, char *err, int errMaxBytes);
int tspice_bschoi(
    int key, int n, const int *values, const int *order, int *out, char *err, int errMaxBytes);
int tspice_bsrchc(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes);
int tspice_bsrchd(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes);
int tspice_bsrchi(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes);
int tspice_isrchc(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes);
int tspice_isrchd(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes);
int tspice_isrchi(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes);

// Sorted bounds use zero-based result indices. Character rows are blank padded and NUL terminated.
int tspice_isordv(int n, int *values, int *out, char *err, int cap);
int tspice_orderc(int n, int width, char *values, int *out, char *err, int cap);
int tspice_orderd(int n, double *values, int *out, char *err, int cap);
int tspice_orderi(int n, int *values, int *out, char *err, int cap);
int tspice_reordc(int n, int *order, int width, char *values, char *err, int cap);
int tspice_reordd(int n, int *order, double *values, char *err, int cap);
int tspice_reordi(int n, int *order, int *values, char *err, int cap);
int tspice_reordl(int n, int *order, int *values, char *err, int cap);
int tspice_shellc(int n, int width, char *values, char *err, int cap);
int tspice_shelld(int n, double *values, char *err, int cap);
int tspice_shelli(int n, int *values, char *err, int cap);
int tspice_lstlec(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes);
int tspice_lstled(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes);
int tspice_lstlei(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes);
int tspice_lstltc(
    const char *key, int n, int width, const char *rows, int *out, char *err, int errMaxBytes);
int tspice_lstltd(
    double key, int n, const double *values, int *out, char *err, int errMaxBytes);
int tspice_lstlti(
    int key, int n, const int *values, int *out, char *err, int errMaxBytes);

// reclat_c: rectangular -> latitudinal coordinates.
int tspice_reclat(
    const double *rect3,
    double *outRadius,
    double *outLon,
    double *outLat,
    char *err,
    int errMaxBytes);

// latrec_c: latitudinal -> rectangular coordinates.
int tspice_latrec(
    double radius,
    double lon,
    double lat,
    double *outRect3,
    char *err,
    int errMaxBytes);

// recsph_c: rectangular -> spherical coordinates.
int tspice_recsph(
    const double *rect3,
    double *outRadius,
    double *outColat,
    double *outLon,
    char *err,
    int errMaxBytes);

// sphrec_c: spherical -> rectangular coordinates.
int tspice_sphrec(
    double radius,
    double colat,
    double lon,
    double *outRect3,
    char *err,
    int errMaxBytes);

// vnorm_c: vector norm.
int tspice_vnorm(const double *v3, double *outNorm, char *err, int errMaxBytes);

// vhat_c: unit vector.
//
// Zero-vector behavior: if `v3` is [0, 0, 0], `outVhat3` is [0, 0, 0] and this
// function returns success (no error).
int tspice_vhat(const double *v3, double *outVhat3, char *err, int errMaxBytes);

// vdot_c: dot product.
int tspice_vdot(const double *a3, const double *b3, double *outDot, char *err, int errMaxBytes);

// vcrss_c: cross product.
int tspice_vcrss(const double *a3, const double *b3, double *outCross3, char *err, int errMaxBytes);

// mxv_c: matrix times vector (3x3).
// Matrix input is expected as 9 doubles in row-major order.
int tspice_mxv(const double *m3x3, const double *v3, double *outV3, char *err, int errMaxBytes);

// mtxv_c: transpose(matrix) times vector (3x3).
// Matrix input is expected as 9 doubles in row-major order.
int tspice_mtxv(const double *m3x3, const double *v3, double *outV3, char *err, int errMaxBytes);

// mxm_c: matrix times matrix (3x3).
// Matrix inputs/outputs are expected as 9 doubles in row-major order.
int tspice_mxm(
    const double *a3x3,
    const double *b3x3,
    double *outM3x3,
    char *err,
    int errMaxBytes);

// vadd_c: vector addition.
int tspice_vadd(const double *a3, const double *b3, double *out3, char *err, int errMaxBytes);

// vsub_c: vector subtraction.
int tspice_vsub(const double *a3, const double *b3, double *out3, char *err, int errMaxBytes);

// vminus_c: vector negation.
int tspice_vminus(const double *v3, double *out3, char *err, int errMaxBytes);

// vscl_c: vector scaling.
int tspice_vscl(double s, const double *v3, double *out3, char *err, int errMaxBytes);

// rotate_c: generate a rotation matrix about a coordinate axis.
int tspice_rotate(double angle, int axis, double *outM3x3, char *err, int errMaxBytes);

// rotmat_c: rotate a matrix about a coordinate axis.
int tspice_rotmat(
    const double *m3x3,
    double angle,
    int axis,
    double *outM3x3,
    char *err,
    int errMaxBytes);

// axisar_c: axis and angle to rotation matrix.
int tspice_axisar(
    const double *axis3,
    double angle,
    double *outM3x3,
    char *err,
    int errMaxBytes);

// georec_c: geodetic coordinates to rectangular coordinates.
int tspice_georec(
    double lon,
    double lat,
    double alt,
    double re,
    double f,
    double *outRect3,
    char *err,
    int errMaxBytes);

// recgeo_c: rectangular coordinates to geodetic coordinates.
int tspice_recgeo(
    const double *rect3,
    double re,
    double f,
    double *outLon,
    double *outLat,
    double *outAlt,
    char *err,
    int errMaxBytes);

// --- SCLK conversions + CK attitude ---

// scs2e_c: convert an encoded SCLK string -> ET seconds past J2000.
int tspice_scs2e(
    int sc,
    const char *sclkch,
    double *outEt,
    char *err,
    int errMaxBytes);

// N0067 SCPART has no room parameter. Supply full-size caller-owned arrays.
#define TSPICE_SCLK_MAX_PARTITIONS 9999
// A type-1 clock has at most 10 fields, each with nominal width <=309.
#define TSPICE_SCLK_FORMAT_MAX_BYTES 3100
int tspice_sce2t(int sc, double et, double *out, char *err, int errMaxBytes);
int tspice_scfmt(int sc, double ticks, int clklen, char *out, char *err, int errMaxBytes);
int tspice_scpart(int sc, int room, int *count, double *pstart, double *pstop, char *err, int errMaxBytes);
int tspice_sctiks(int sc, const char *clkstr, double *out, char *err, int errMaxBytes);

// sce2s_c: convert ET seconds past J2000 -> an encoded SCLK string.
int tspice_sce2s(
    int sc,
    double et,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

// scencd_c: convert an encoded SCLK string -> ticks.
int tspice_scencd(
    int sc,
    const char *sclkch,
    double *outSclkdp,
    char *err,
    int errMaxBytes);

// scdecd_c: convert ticks -> an encoded SCLK string.
int tspice_scdecd(
    int sc,
    double sclkdp,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

// sct2e_c: convert ticks -> ET seconds past J2000.
int tspice_sct2e(
    int sc,
    double sclkdp,
    double *outEt,
    char *err,
    int errMaxBytes);

// sce2c_c: convert ET seconds past J2000 -> ticks.
int tspice_sce2c(
    int sc,
    double et,
    double *outSclkdp,
    char *err,
    int errMaxBytes);

// ckgp_c: get pointing (attitude) for a CK instrument at an encoded spacecraft clock time.
//
// Output matrix is written as 9 doubles in row-major order.
int tspice_ckgp(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outClkout,
    int *outFound,
    char *err,
    int errMaxBytes);

// ckgpav_c: get pointing + angular velocity for a CK instrument at an encoded spacecraft clock time.
//
// Output matrix is written as 9 doubles in row-major order.
// Output angular velocity is written as 3 doubles.
int tspice_ckgpav(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outAv3,
    double *outClkout,
    int *outFound,
    char *err,
    int errMaxBytes);

// --- CK file query / management (read-only) --------------------------------

int tspice_pckcls(int handle, char *err, int errMaxBytes);
int tspice_pckcov(const char *path, int classId, uintptr_t dest, char *err, int errMaxBytes);
int tspice_pckfrm(const char *path, uintptr_t dest, char *err, int errMaxBytes);
int tspice_pcklof(const char *path, int *out, char *err, int errMaxBytes);
int tspice_pckopn(const char *path, const char *ifname, int ncomch, int *out, char *err, int errMaxBytes);
int tspice_pckuof(int handle, char *err, int errMaxBytes);
int tspice_pckw02(int handle, int classId, const char *frame, double first, double last, const char *segid, double intlen, int n, int degree, const double *coefficients, int count, double btime, char *err, int errMaxBytes);

int tspice_ckopn(const char *path, const char *ifname, int ncomch, int *out, char *err, int errMaxBytes);
int tspice_ckcls(int handle, char *err, int errMaxBytes);
int tspice_ckw01(int handle, double beg, double end, int inst, const char *ref, int av, const char *segid, int n, const double *data, int count, char *err, int errMaxBytes);
int tspice_ckw02(int handle, double beg, double end, int inst, const char *ref, const char *segid, int n, const double *data, int count, char *err, int errMaxBytes);
int tspice_ckw03(int handle, double beg, double end, int inst, const char *ref, int av, const char *segid, int n, int nints, const double *data, int count, char *err, int errMaxBytes);
int tspice_ckw05(int handle, int subtype, int degree, double beg, double end, int inst, const char *ref, int av, const char *segid, int n, int nints, double rate, const double *data, int count, char *err, int errMaxBytes);

int tspice_ckfrot(int inst, double et, double *out, int *ref, int *found, char *err, int errMaxBytes);
int tspice_ckfxfm(int inst, double et, double *out, int *ref, int *found, char *err, int errMaxBytes);
int tspice_ckgr02(int handle, const unsigned char *bytes, int size, int recno, double *out, char *err, int errMaxBytes);
int tspice_ckgr03(int handle, const unsigned char *bytes, int size, int recno, double *out, int *nwords, char *err, int errMaxBytes);
int tspice_ckmeta(int ckid, const char *meta, int *out, char *err, int errMaxBytes);
int tspice_cknr02(int handle, const unsigned char *bytes, int size, int *out, char *err, int errMaxBytes);
int tspice_cknr03(int handle, const unsigned char *bytes, int size, int *out, char *err, int errMaxBytes);

// cklpf_c: load a CK file for access by pointing routines.
int tspice_cklpf(const char *ck, int *outHandle, char *err, int errMaxBytes);

// ckupf_c: unload a CK file previously loaded by cklpf.
int tspice_ckupf(int handle, char *err, int errMaxBytes);

// ckobj_c: return the set of instrument/object IDs present in a CK file.
int tspice_ckobj(const char *ck, uintptr_t idsCellHandle, char *err, int errMaxBytes);

// ckcov_c: return coverage for an instrument/object in a CK file.
int tspice_ckcov(
    const char *ck,
    int idcode,
    int needav,
    const char *level,
    double tol,
    const char *timsys,
    uintptr_t coverWindowHandle,
    char *err,
    int errMaxBytes);

// --- Cells + windows --------------------------------------------------------

// Creation functions allocate on the heap and return an opaque handle.
//
// - Node backend: the shim pointer is stored in a handle table and JS sees a
//   stable opaque integer.
// - WASM backend: JS receives the raw pointer value as an opaque integer *handle*,
//   but the C shim validates every handle against an internal allocation registry
//   before dereferencing or freeing it. (This prevents forged handles from
//   becoming arbitrary pointers.)

int tspice_new_int_cell(int size, uintptr_t *outCell, char *err, int errMaxBytes);
int tspice_new_double_cell(int size, uintptr_t *outCell, char *err, int errMaxBytes);
int tspice_new_char_cell(
    int size,
    int length,
    uintptr_t *outCell,
    char *err,
    int errMaxBytes);

// `maxIntervals` is the number of intervals the window can hold. The underlying
// DP cell size is `2*maxIntervals` endpoints.
int tspice_new_window(int maxIntervals, uintptr_t *outWindow, char *err, int errMaxBytes);

int tspice_free_cell(uintptr_t cell, char *err, int errMaxBytes);
int tspice_free_window(uintptr_t window, char *err, int errMaxBytes);

// Return the fixed string length (including trailing NUL) for a `SPICE_CHR`
// cell created by this shim.
int tspice_char_cell_length(uintptr_t cell, int *outLength, char *err, int errMaxBytes);

int tspice_ssize(int size, uintptr_t cell, char *err, int errMaxBytes);
int tspice_scard(int card, uintptr_t cell, char *err, int errMaxBytes);
int tspice_card(uintptr_t cell, int *outCard, char *err, int errMaxBytes);
int tspice_size(uintptr_t cell, int *outSize, char *err, int errMaxBytes);
int tspice_valid(int size, int n, uintptr_t cell, char *err, int errMaxBytes);

int tspice_insrti(int item, uintptr_t cell, char *err, int errMaxBytes);
int tspice_insrtd(double item, uintptr_t cell, char *err, int errMaxBytes);
int tspice_lparss(const char *list, const char *delims, uintptr_t handle, char *err, int errMaxBytes);
int tspice_insrtc(const char *item, uintptr_t cell, char *err, int errMaxBytes);

int tspice_appndc(const char *item, uintptr_t handle, char *err, int errMaxBytes);
int tspice_appndd(double item, uintptr_t handle, char *err, int errMaxBytes);
int tspice_appndi(int item, uintptr_t handle, char *err, int errMaxBytes);
int tspice_elemc(const char *item, uintptr_t handle, int *out, char *err, int errMaxBytes);
int tspice_elemd(double item, uintptr_t handle, int *out, char *err, int errMaxBytes);
int tspice_elemi(int item, uintptr_t handle, int *out, char *err, int errMaxBytes);
int tspice_diff(uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_inter(uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_sdiff(uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_union(uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_set(uintptr_t aHandle, const char *op, uintptr_t bHandle, int *out, char *err, int errMaxBytes);
int tspice_removc(const char *item, uintptr_t handle, char *err, int errMaxBytes);
int tspice_removd(double item, uintptr_t handle, char *err, int errMaxBytes);
int tspice_removi(int item, uintptr_t handle, char *err, int errMaxBytes);
int tspice_ordc(const char *item, uintptr_t handle, int *out, char *err, int errMaxBytes);
int tspice_ordd(double item, uintptr_t handle, int *out, char *err, int errMaxBytes);
int tspice_ordi(int item, uintptr_t handle, int *out, char *err, int errMaxBytes);
int tspice_copy(uintptr_t sourceHandle, uintptr_t destinationHandle, char *err, int errMaxBytes);

int tspice_cell_geti(uintptr_t cell, int index, int *outItem, char *err, int errMaxBytes);
int tspice_cell_getd(uintptr_t cell, int index, double *outItem, char *err, int errMaxBytes);
int tspice_cell_getc(
    uintptr_t cell,
    int index,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

int tspice_wncomd(
    double left, double right, uintptr_t windowHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_wncond(
    double left, double right, uintptr_t windowHandle, char *err, int errMaxBytes);
int tspice_wndifd(
    uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_wnelmd(
    double point, uintptr_t windowHandle, int *out, char *err, int errMaxBytes);
int tspice_wnexpd(
    double left, double right, uintptr_t windowHandle, char *err, int errMaxBytes);
int tspice_wnextd(
    int side, uintptr_t windowHandle, char *err, int errMaxBytes);
int tspice_wnfild(
    double small, uintptr_t windowHandle, char *err, int errMaxBytes);
int tspice_wnfltd(
    double small, uintptr_t windowHandle, char *err, int errMaxBytes);
int tspice_wnincd(
    double left, double right, uintptr_t windowHandle, int *out, char *err, int errMaxBytes);
int tspice_wnintd(
    uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);
int tspice_wnreld(
    uintptr_t aHandle, const char *op, uintptr_t bHandle, int *out, char *err, int errMaxBytes);
int tspice_wnsumd(
    uintptr_t windowHandle, double *meas, double *avg, double *stddev, int *shortest, int *longest, char *err, int errMaxBytes);
int tspice_wnunid(
    uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes);

int tspice_wninsd(double left, double right, uintptr_t window, char *err, int errMaxBytes);
int tspice_wncard(uintptr_t window, int *outCard, char *err, int errMaxBytes);
int tspice_wnfetd(
    uintptr_t window,
    int index,
    double *outLeft,
    double *outRight,
    char *err,
    int errMaxBytes);
int tspice_wnvald(int size, int n, uintptr_t window, char *err, int errMaxBytes);

#ifdef __cplusplus
}
#endif

#endif
