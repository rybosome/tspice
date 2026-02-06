// Typed subset of Emscripten module exports used by tspice.
//
// NOTE: The `FS` member is intentionally `any` because Emscripten's FS typing is
// not stable across toolchains.
export type EmscriptenModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;

  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPF64: Float64Array;
  // --- error/status utilities ---
  _tspice_get_last_error_short(outPtr: number, outMaxBytes: number): number;
  _tspice_get_last_error_long(outPtr: number, outMaxBytes: number): number;
  _tspice_get_last_error_trace(outPtr: number, outMaxBytes: number): number;

  _tspice_failed(outFailedPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_reset(errPtr: number, errMaxBytes: number): number;
  _tspice_getmsg(
    whichPtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_setmsg(messagePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_sigerr(shortPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_chkin(namePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_chkout(namePtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_tkvrsn_toolkit(
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_furnsh(pathPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_unload(pathPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_kclear(errPtr: number, errMaxBytes: number): number;
  _tspice_ktotal(kindPtr: number, outCountPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_kdata(
    which: number,
    kindPtr: number,
    filePtr: number,
    fileMaxBytes: number,
    filtypPtr: number,
    filtypMaxBytes: number,
    sourcePtr: number,
    sourceMaxBytes: number,
    handlePtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_str2et(utcPtr: number, outEtPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_et2utc(
    et: number,
    formatPtr: number,
    prec: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_timout(
    et: number,
    picturePtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_bodn2c(namePtr: number, outCodePtr: number, foundPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_bodc2n(
    code: number,
    outNamePtr: number,
    outNameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_namfrm(
    frameNamePtr: number,
    outFrameIdPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_frmnam(
    frameId: number,
    outFrameNamePtr: number,
    outFrameNameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cidfrm(
    center: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cnmfrm(
    centerNamePtr: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_scs2e(
    sc: number,
    sclkchPtr: number,
    outEtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_sce2s(
    sc: number,
    et: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    refPtr: number,
    outCmatPtr: number,
    outClkoutPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    refPtr: number,
    outCmatPtr: number,
    outAvPtr: number,
    outClkoutPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_pxform(
    fromPtr: number,
    toPtr: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sxform(
    fromPtr: number,
    toPtr: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkezr(
    targetPtr: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    obsPtr: number,
    outStatePtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkpos(
    targetPtr: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    obsPtr: number,
    outPosPtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Derived geometry primitives
  _tspice_subpnt(
    methodPtr: number,
    targetPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    observerPtr: number,
    outSpoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_subslr(
    methodPtr: number,
    targetPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    observerPtr: number,
    outSpoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sincpt(
    methodPtr: number,
    targetPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    observerPtr: number,
    drefPtr: number,
    dvec3Ptr: number,
    outSpoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ilumin(
    methodPtr: number,
    targetPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    observerPtr: number,
    spoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    outPhasePtr: number,
    outIncdncPtr: number,
    outEmissnPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_occult(
    targ1Ptr: number,
    shape1Ptr: number,
    frame1Ptr: number,
    targ2Ptr: number,
    shape2Ptr: number,
    frame2Ptr: number,
    abcorrPtr: number,
    observerPtr: number,
    et: number,
    outOcltidPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Coordinate conversions + small vector/matrix helpers
  _tspice_reclat(
    rect3Ptr: number,
    outRadiusPtr: number,
    outLonPtr: number,
    outLatPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_latrec(
    radius: number,
    lon: number,
    lat: number,
    outRect3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recsph(
    rect3Ptr: number,
    outRadiusPtr: number,
    outColatPtr: number,
    outLonPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sphrec(
    radius: number,
    colat: number,
    lon: number,
    outRect3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_vnorm(v3Ptr: number, outNormPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vhat(v3Ptr: number, outVhat3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vdot(
    a3Ptr: number,
    b3Ptr: number,
    outDotPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vcrss(
    a3Ptr: number,
    b3Ptr: number,
    outCross3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxv(
    m3x3Ptr: number,
    v3Ptr: number,
    outV3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxv(
    m3x3Ptr: number,
    v3Ptr: number,
    outV3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_mxm(
    a3x3Ptr: number,
    b3x3Ptr: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_vadd(a3Ptr: number, b3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vsub(a3Ptr: number, b3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vminus(v3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vscl(s: number, v3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_rotate(angle: number, axis: number, outM3x3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_rotmat(
    m3x3Ptr: number,
    angle: number,
    axis: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_axisar(axis3Ptr: number, angle: number, outM3x3Ptr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_georec(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outRect3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_recgeo(
    rect3Ptr: number,
    re: number,
    f: number,
    outLonPtr: number,
    outLatPtr: number,
    outAltPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Cells + windows
  _tspice_new_int_cell(size: number, outCellPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_new_double_cell(size: number, outCellPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_new_char_cell(
    size: number,
    length: number,
    outCellPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_new_window(
    maxIntervals: number,
    outWindowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_free_cell(cell: number, errPtr: number, errMaxBytes: number): number;
  _tspice_free_window(window: number, errPtr: number, errMaxBytes: number): number;

  _tspice_ssize(size: number, cell: number, errPtr: number, errMaxBytes: number): number;
  _tspice_scard(card: number, cell: number, errPtr: number, errMaxBytes: number): number;
  _tspice_card(cell: number, outCardPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_size(cell: number, outSizePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_valid(size: number, n: number, cell: number, errPtr: number, errMaxBytes: number): number;

  _tspice_insrti(item: number, cell: number, errPtr: number, errMaxBytes: number): number;
  _tspice_insrtd(item: number, cell: number, errPtr: number, errMaxBytes: number): number;
  _tspice_insrtc(itemPtr: number, cell: number, errPtr: number, errMaxBytes: number): number;

  _tspice_cell_geti(
    cell: number,
    index: number,
    outItemPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cell_getd(
    cell: number,
    index: number,
    outItemPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cell_getc(
    cell: number,
    index: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_wninsd(left: number, right: number, window: number, errPtr: number, errMaxBytes: number): number;
  _tspice_wncard(window: number, outCardPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_wnfetd(
    window: number,
    index: number,
    outLeftPtr: number,
    outRightPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnvald(size: number, n: number, window: number, errPtr: number, errMaxBytes: number): number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FS: any;
};

export function assertEmscriptenModule(module: unknown): asserts module is EmscriptenModule {
  const m = module as Partial<EmscriptenModule> | null | undefined;
  if (
    !m ||
    typeof m._tspice_tkvrsn_toolkit !== "function" ||
    typeof m._malloc !== "function" ||
    typeof m._free !== "function" ||
    typeof m.UTF8ToString !== "function" ||
    typeof m._tspice_furnsh !== "function" ||
    typeof m._tspice_unload !== "function" ||
    typeof m._tspice_kclear !== "function" ||
    typeof m._tspice_ktotal !== "function" ||
    typeof m._tspice_kdata !== "function" ||
    typeof m._tspice_str2et !== "function" ||
    typeof m._tspice_et2utc !== "function" ||
    typeof m._tspice_timout !== "function" ||
    typeof m._tspice_bodn2c !== "function" ||
    typeof m._tspice_bodc2n !== "function" ||
    typeof m._tspice_namfrm !== "function" ||
    typeof m._tspice_frmnam !== "function" ||
    typeof m._tspice_scs2e !== "function" ||
    typeof m._tspice_sce2s !== "function" ||
    typeof m._tspice_get_last_error_short !== "function" ||
    typeof m._tspice_get_last_error_long !== "function" ||
    typeof m._tspice_get_last_error_trace !== "function" ||
    typeof m._tspice_failed !== "function" ||
    typeof m._tspice_reset !== "function" ||
    typeof m._tspice_getmsg !== "function" ||
    typeof m._tspice_setmsg !== "function" ||
    typeof m._tspice_sigerr !== "function" ||
    typeof m._tspice_chkin !== "function" ||
    typeof m._tspice_chkout !== "function" ||
    typeof m._tspice_ckgp !== "function" ||
    typeof m._tspice_ckgpav !== "function" ||
    typeof m._tspice_pxform !== "function" ||
    typeof m._tspice_sxform !== "function" ||
    typeof m._tspice_spkezr !== "function" ||
    typeof m._tspice_spkpos !== "function" ||
    typeof m._tspice_reclat !== "function" ||
    typeof m._tspice_latrec !== "function" ||
    typeof m._tspice_recsph !== "function" ||
    typeof m._tspice_sphrec !== "function" ||
    typeof m._tspice_vnorm !== "function" ||
    typeof m._tspice_vhat !== "function" ||
    typeof m._tspice_vdot !== "function" ||
    typeof m._tspice_vcrss !== "function" ||
    typeof m._tspice_mxv !== "function" ||
    typeof m._tspice_mtxv !== "function" ||
    typeof m._tspice_mxm !== "function" ||
    typeof m._tspice_vadd !== "function" ||
    typeof m._tspice_vsub !== "function" ||
    typeof m._tspice_vminus !== "function" ||
    typeof m._tspice_vscl !== "function" ||
    typeof m._tspice_rotate !== "function" ||
    typeof m._tspice_rotmat !== "function" ||
    typeof m._tspice_axisar !== "function" ||
    typeof m._tspice_georec !== "function" ||
    typeof m._tspice_recgeo !== "function" ||
    typeof m._tspice_new_int_cell !== "function" ||
    typeof m._tspice_new_double_cell !== "function" ||
    typeof m._tspice_new_char_cell !== "function" ||
    typeof m._tspice_new_window !== "function" ||
    typeof m._tspice_free_cell !== "function" ||
    typeof m._tspice_free_window !== "function" ||
    typeof m._tspice_ssize !== "function" ||
    typeof m._tspice_scard !== "function" ||
    typeof m._tspice_card !== "function" ||
    typeof m._tspice_size !== "function" ||
    typeof m._tspice_valid !== "function" ||
    typeof m._tspice_insrti !== "function" ||
    typeof m._tspice_insrtd !== "function" ||
    typeof m._tspice_insrtc !== "function" ||
    typeof m._tspice_cell_geti !== "function" ||
    typeof m._tspice_cell_getd !== "function" ||
    typeof m._tspice_cell_getc !== "function" ||
    typeof m._tspice_wninsd !== "function" ||
    typeof m._tspice_wncard !== "function" ||
    typeof m._tspice_wnfetd !== "function" ||
    typeof m._tspice_wnvald !== "function"
  ) {
    throw new Error("WASM module is missing expected exports");
  }
}
