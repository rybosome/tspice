#ifndef TSPICE_BACKEND_SHIM_H
#define TSPICE_BACKEND_SHIM_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

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

int tspice_dafopr(const char *path, int *outHandle, char *err, int errMaxBytes);
int tspice_dafcls(int handle, char *err, int errMaxBytes);
int tspice_dafbfs(int handle, char *err, int errMaxBytes);

// Selects the current DAF via `dafcs_c(handle)` and then calls `daffna_c`.
//
// `outFound` is required (non-NULL) to keep ABI usage explicit and consistent
// with the DLA APIs.
int tspice_daffna(int handle, int *outFound, char *err, int errMaxBytes);

// --- DAS -------------------------------------------------------------------

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


// --- Kernel pool -----------------------------------------------------------

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

// tparse_c: parse a time string -> ET seconds past J2000.
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

// --- coordinate conversions + small vector/matrix helpers ---

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
int tspice_insrtc(const char *item, uintptr_t cell, char *err, int errMaxBytes);

int tspice_cell_geti(uintptr_t cell, int index, int *outItem, char *err, int errMaxBytes);
int tspice_cell_getd(uintptr_t cell, int index, double *outItem, char *err, int errMaxBytes);
int tspice_cell_getc(
    uintptr_t cell,
    int index,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes);

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
