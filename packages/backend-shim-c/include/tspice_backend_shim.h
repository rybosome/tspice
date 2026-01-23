#ifndef TSPICE_BACKEND_SHIM_H
#define TSPICE_BACKEND_SHIM_H

#ifdef __cplusplus
extern "C" {
#endif

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

// --- Phase 3 low-level primitives ---

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

// --- Phase 6: coordinate conversions + small vector/matrix helpers ---

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

// --- Phase 4: SCLK conversions + CK attitude ---

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

#ifdef __cplusplus
}
#endif

#endif
