// Typed subset of Emscripten module exports used by tspice.
//
// NOTE: The `FS` member is intentionally `any` because Emscripten's FS typing is
// not stable across toolchains.
export type EmscriptenModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;

  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
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

  // --- kernels ---
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

  // --- file i/o primitives ---

  _tspice_exists(pathPtr: number, outExistsPtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_getfat(
    pathPtr: number,
    outArchPtr: number,
    outArchMaxBytes: number,
    outTypePtr: number,
    outTypeMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dafopr(pathPtr: number, outHandlePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dafcls(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dafbfs(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_daffna(handle: number, outFoundPtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_dasopr(pathPtr: number, outHandlePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dascls(handle: number, errPtr: number, errMaxBytes: number): number;

  _tspice_dlaopn(
    pathPtr: number,
    ftypePtr: number,
    ifnamePtr: number,
    ncomch: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dlabfs(handle: number, outDescr8Ptr: number, outFoundPtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_dlafns(
    handle: number,
    descr8Ptr: number,
    outNextDescr8Ptr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dlacls(handle: number, errPtr: number, errMaxBytes: number): number;

  // --- EK ---

  _tspice_ekopr(pathPtr: number, outHandlePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_ekopw(pathPtr: number, outHandlePtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_ekopn(
    pathPtr: number,
    ifnamePtr: number,
    ncomch: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekcls(handle: number, errPtr: number, errMaxBytes: number): number;

  _tspice_ekntab(outNPtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_ektnam(
    n: number,
    outNamePtr: number,
    outNameMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_eknseg(handle: number, outNsegPtr: number, errPtr: number, errMaxBytes: number): number;

  // --- DSK ---

  _tspice_dskopn(
    pathPtr: number,
    ifnamePtr: number,
    ncomch: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dskmi2(
    nv: number,
    vrtcesPtr: number,
    np: number,
    platesPtr: number,
    finscl: number,
    corscl: number,
    worksz: number,
    voxpsz: number,
    voxlsz: number,
    makvtl: number,
    spxisz: number,
    outSpaixdPtr: number,
    outSpaixdLen: number,
    outSpaixiPtr: number,
    outSpaixiLen: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dskw02(
    handle: number,
    center: number,
    surfid: number,
    dclass: number,
    framePtr: number,
    corsys: number,
    corparPtr: number,
    mncor1: number,
    mxcor1: number,
    mncor2: number,
    mxcor2: number,
    mncor3: number,
    mxcor3: number,
    first: number,
    last: number,
    nv: number,
    vrtcesPtr: number,
    np: number,
    platesPtr: number,
    spaixdPtr: number,
    spaixdLen: number,
    spaixiPtr: number,
    spaixiLen: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dskobj(dskPathPtr: number, bodidsCellHandle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dsksrf(
    dskPathPtr: number,
    bodyid: number,
    srfidsCellHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dskgd(
    handle: number,
    dladscInts8Ptr: number,
    outInts6Ptr: number,
    outDoubles18Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dskb02(
    handle: number,
    dladscInts8Ptr: number,
    outInts10Ptr: number,
    outDoubles10Ptr: number,
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
  _tspice_spkez(
    target: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    observer: number,
    outStatePtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkezp(
    target: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    observer: number,
    outPosPtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkgeo(
    target: number,
    et: number,
    refPtr: number,
    observer: number,
    outStatePtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkgps(
    target: number,
    et: number,
    refPtr: number,
    observer: number,
    outPosPtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkssb(
    target: number,
    et: number,
    refPtr: number,
    outStatePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkcov(
    spkPathPtr: number,
    idcode: number,
    coverWindowHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkobj(
    spkPathPtr: number,
    idsCellHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spksfs(
    body: number,
    et: number,
    outHandlePtr: number,
    outDescr5Ptr: number,
    outIdentPtr: number,
    outIdentMaxBytes: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkpds(
    body: number,
    center: number,
    framePtr: number,
    type: number,
    first: number,
    last: number,
    outDescr5Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkuds(
    descr5Ptr: number,
    outBodyPtr: number,
    outCenterPtr: number,
    outFramePtr: number,
    outTypePtr: number,
    outFirstPtr: number,
    outLastPtr: number,
    outBaddrPtr: number,
    outEaddrPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;


  // --- SPK writers ---
  _tspice_spkopn(
    pathPtr: number,
    ifnamePtr: number,
    ncomch: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkopa(
    pathPtr: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkcls(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_spkw08(
    handle: number,
    body: number,
    center: number,
    framePtr: number,
    first: number,
    last: number,
    segidPtr: number,
    degree: number,
    n: number,
    states6nPtr: number,
    epoch1: number,
    step: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkw08_v2(
    handle: number,
    body: number,
    center: number,
    framePtr: number,
    first: number,
    last: number,
    segidPtr: number,
    degree: number,
    n: number,
    states6nPtr: number,
    states6nLen: number,
    epoch1: number,
    step: number,
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

// --- kernel pool ---
  _tspice_gdpool(
    namePtr: number,
    start: number,
    room: number,
    outNPtr: number,
    outValuesPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_gipool(
    namePtr: number,
    start: number,
    room: number,
    outNPtr: number,
    outValuesPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_gcpool(
    namePtr: number,
    start: number,
    room: number,
    cvalen: number,
    outNPtr: number,
    outCvalsPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_gnpool(
    namePtr: number,
    start: number,
    room: number,
    cvalen: number,
    outNPtr: number,
    outCvalsPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dtpool(
    namePtr: number,
    foundPtr: number,
    outNPtr: number,
    outTypePtr: number,
    outTypeMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_pdpool(namePtr: number, n: number, valuesPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_pipool(namePtr: number, n: number, valuesPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_pcpool(
    namePtr: number,
    n: number,
    lenvals: number,
    cvalsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_swpool(
    agentPtr: number,
    nnames: number,
    namlen: number,
    namesPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cvpool(agentPtr: number, outUpdatePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_expool(namePtr: number, outFoundPtr: number, errPtr: number, errMaxBytes: number): number;

  // --- time ---
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

  _tspice_deltet(epoch: number, eptypePtr: number, outDeltaPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_unitim(
    epoch: number,
    insysPtr: number,
    outsysPtr: number,
    outEpochPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_tparse(timstrPtr: number, outEtPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_tpictr(
    samplePtr: number,
    picturInPtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_timdef_get(itemPtr: number, outPtr: number, outMaxBytes: number, errPtr: number, errMaxBytes: number): number;
  _tspice_timdef_set(itemPtr: number, valuePtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_scencd(sc: number, sclkchPtr: number, outSclkdpPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_scdecd(
    sc: number,
    sclkdp: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sct2e(sc: number, sclkdp: number, outEtPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_sce2c(sc: number, et: number, outSclkdpPtr: number, errPtr: number, errMaxBytes: number): number;

  // --- ids/names/frames ---
  _tspice_bodn2c(namePtr: number, outCodePtr: number, foundPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_bodc2n(
    code: number,
    outNamePtr: number,
    outNameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bodc2s(
    code: number,
    outNamePtr: number,
    outNameMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_bods2c(namePtr: number, outCodePtr: number, foundPtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_boddef(namePtr: number, code: number, errPtr: number, errMaxBytes: number): number;

  _tspice_bodfnd(body: number, itemPtr: number, outResultPtr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_bodvar(
    body: number,
    itemPtr: number,
    maxn: number,
    outDimPtr: number,
    outValuesPtr: number,
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

  _tspice_frinfo(
    frameId: number,
    outCenterPtr: number,
    outFrameClassPtr: number,
    outClassIdPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ccifrm(
    frameClass: number,
    classId: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    outCenterPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // --- ephemeris/frames ---
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

  _tspice_cklpf(
    ckPathPtr: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ckupf(
    handle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ckobj(
    ckPathPtr: number,
    idsCellHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ckcov(
    ckPathPtr: number,
    idcode: number,
    needav: number,
    levelPtr: number,
    tol: number,
    timsysPtr: number,
    coverWindowHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // --- derived geometry ---
  _tspice_pxform(fromPtr: number, toPtr: number, et: number, outPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_sxform(fromPtr: number, toPtr: number, et: number, outPtr: number, errPtr: number, errMaxBytes: number): number;
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
  _tspice_spkez(
    target: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    observer: number,
    outStatePtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkezp(
    target: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    observer: number,
    outPosPtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkgeo(
    target: number,
    et: number,
    refPtr: number,
    observer: number,
    outStatePtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkgps(
    target: number,
    et: number,
    refPtr: number,
    observer: number,
    outPosPtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkssb(
    target: number,
    et: number,
    refPtr: number,
    outStatePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkcov(
    spkPathPtr: number,
    idcode: number,
    coverWindowHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkobj(
    spkPathPtr: number,
    idsCellHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spksfs(
    body: number,
    et: number,
    outHandlePtr: number,
    outDescr5Ptr: number,
    outIdentPtr: number,
    outIdentMaxBytes: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkpds(
    body: number,
    center: number,
    framePtr: number,
    type: number,
    first: number,
    last: number,
    outDescr5Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_spkuds(
    descr5Ptr: number,
    outBodyPtr: number,
    outCenterPtr: number,
    outFramePtr: number,
    outTypePtr: number,
    outFirstPtr: number,
    outLastPtr: number,
    outBaddrPtr: number,
    outEaddrPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;


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

  // --- coordinate conversions + small vector/matrix helpers ---
  _tspice_reclat(rect3Ptr: number, outRadiusPtr: number, outLonPtr: number, outLatPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_latrec(radius: number, lon: number, lat: number, outRect3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_recsph(rect3Ptr: number, outRadiusPtr: number, outColatPtr: number, outLonPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_sphrec(radius: number, colat: number, lon: number, outRect3Ptr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_vnorm(v3Ptr: number, outNormPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vhat(v3Ptr: number, outVhat3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vdot(a3Ptr: number, b3Ptr: number, outDotPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vcrss(a3Ptr: number, b3Ptr: number, outCross3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_mxv(m3x3Ptr: number, v3Ptr: number, outV3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_mtxv(m3x3Ptr: number, v3Ptr: number, outV3Ptr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_mxm(a3x3Ptr: number, b3x3Ptr: number, outM3x3Ptr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_vadd(a3Ptr: number, b3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vsub(a3Ptr: number, b3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vminus(v3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_vscl(s: number, v3Ptr: number, out3Ptr: number, errPtr: number, errMaxBytes: number): number;

  _tspice_rotate(angle: number, axis: number, outM3x3Ptr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_rotmat(m3x3Ptr: number, angle: number, axis: number, outM3x3Ptr: number, errPtr: number, errMaxBytes: number): number;

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
  _tspice_new_char_cell(size: number, length: number, outCellPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_new_window(maxIntervals: number, outWindowPtr: number, errPtr: number, errMaxBytes: number): number;
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

  _tspice_cell_geti(cell: number, index: number, outItemPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_cell_getd(cell: number, index: number, outItemPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_cell_getc(cell: number, index: number, outPtr: number, outMaxBytes: number, errPtr: number, errMaxBytes: number): number;

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

const REQUIRED_FUNCTION_EXPORTS = [
  "_malloc",
  "_free",
  "UTF8ToString",
  "_tspice_get_last_error_short",
  "_tspice_get_last_error_long",
  "_tspice_get_last_error_trace",
  "_tspice_failed",
  "_tspice_reset",
  "_tspice_getmsg",
  "_tspice_setmsg",
  "_tspice_sigerr",
  "_tspice_chkin",
  "_tspice_chkout",
  "_tspice_tkvrsn_toolkit",
  "_tspice_furnsh",
  "_tspice_unload",
  "_tspice_kclear",
  "_tspice_ktotal",
  "_tspice_kdata",

  // File I/O
  "_tspice_exists",
  "_tspice_getfat",
  "_tspice_dafopr",
  "_tspice_dafcls",
  "_tspice_dafbfs",
  "_tspice_daffna",
  "_tspice_dasopr",
  "_tspice_dascls",
  "_tspice_dlaopn",
  "_tspice_dlabfs",
  "_tspice_dlafns",
  "_tspice_dlacls",

  // Kernel pool
  "_tspice_gdpool",
  "_tspice_gipool",
  "_tspice_gcpool",
  "_tspice_gnpool",
  "_tspice_dtpool",
  "_tspice_pdpool",
  "_tspice_pipool",
  "_tspice_pcpool",
  "_tspice_swpool",
  "_tspice_cvpool",
  "_tspice_expool",

  "_tspice_str2et",
  "_tspice_et2utc",
  "_tspice_timout",
  "_tspice_deltet",
  "_tspice_unitim",
  "_tspice_tparse",
  "_tspice_tpictr",
  "_tspice_timdef_get",
  "_tspice_timdef_set",
  "_tspice_scencd",
  "_tspice_scdecd",
  "_tspice_sct2e",
  "_tspice_sce2c",
  "_tspice_bodn2c",
  "_tspice_bodc2n",
  "_tspice_bodc2s",
  "_tspice_bods2c",
  "_tspice_boddef",
  "_tspice_bodfnd",
  "_tspice_bodvar",
  "_tspice_namfrm",
  "_tspice_frmnam",
  "_tspice_cidfrm",
  "_tspice_cnmfrm",
  "_tspice_frinfo",
  "_tspice_ccifrm",
  "_tspice_scs2e",
  "_tspice_sce2s",
  "_tspice_ckgp",
  "_tspice_ckgpav",
  "_tspice_cklpf",
  "_tspice_ckupf",
  "_tspice_ckobj",
  "_tspice_ckcov",
  "_tspice_pxform",
  "_tspice_sxform",
  "_tspice_spkezr",
  "_tspice_spkpos",
  "_tspice_spkez",
  "_tspice_spkezp",
  "_tspice_spkgeo",
  "_tspice_spkgps",
  "_tspice_spkssb",
  "_tspice_spkcov",
  "_tspice_spkobj",
  "_tspice_spksfs",
  "_tspice_spkpds",
  "_tspice_spkuds",
  "_tspice_spkopn",
  "_tspice_spkopa",
  "_tspice_spkw08",
  "_tspice_spkw08_v2",
  "_tspice_spkcls",
  "_tspice_subpnt",
  "_tspice_subslr",
  "_tspice_sincpt",
  "_tspice_ilumin",
  "_tspice_occult",
  "_tspice_reclat",
  "_tspice_latrec",
  "_tspice_recsph",
  "_tspice_sphrec",
  "_tspice_vnorm",
  "_tspice_vhat",
  "_tspice_vdot",
  "_tspice_vcrss",
  "_tspice_mxv",
  "_tspice_mtxv",
  "_tspice_mxm",
  "_tspice_vadd",
  "_tspice_vsub",
  "_tspice_vminus",
  "_tspice_vscl",
  "_tspice_rotate",
  "_tspice_rotmat",
  "_tspice_axisar",
  "_tspice_georec",
  "_tspice_recgeo",

  // EK
  "_tspice_ekopr",
  "_tspice_ekopw",
  "_tspice_ekopn",
  "_tspice_ekcls",
  "_tspice_ekntab",
  "_tspice_ektnam",
  "_tspice_eknseg",

  // DSK
  "_tspice_dskopn",
  "_tspice_dskmi2",
  "_tspice_dskw02",
  "_tspice_dskobj",
  "_tspice_dsksrf",
  "_tspice_dskgd",
  "_tspice_dskb02",

  // Cells + windows
  "_tspice_new_int_cell",
  "_tspice_new_double_cell",
  "_tspice_new_char_cell",
  "_tspice_new_window",
  "_tspice_free_cell",
  "_tspice_free_window",
  "_tspice_ssize",
  "_tspice_scard",
  "_tspice_card",
  "_tspice_size",
  "_tspice_valid",
  "_tspice_insrti",
  "_tspice_insrtd",
  "_tspice_insrtc",
  "_tspice_cell_geti",
  "_tspice_cell_getd",
  "_tspice_cell_getc",
  "_tspice_wninsd",
  "_tspice_wncard",
  "_tspice_wnfetd",
  "_tspice_wnvald",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function assertEmscriptenModule(m: unknown): asserts m is EmscriptenModule {
  if (!isRecord(m)) {
    throw new TypeError("Expected Emscripten module to be an object");
  }

  const invalid: string[] = [];

  for (const key of REQUIRED_FUNCTION_EXPORTS) {
    if (typeof m[key] !== "function") {
      invalid.push(key);
    }
  }

  if (!(m.HEAPU8 instanceof Uint8Array)) invalid.push("HEAPU8");
  if (!(m.HEAP32 instanceof Int32Array)) invalid.push("HEAP32");
  if (!(m.HEAPF64 instanceof Float64Array)) invalid.push("HEAPF64");

  if (typeof m.FS !== "object" || m.FS === null) {
    invalid.push("FS");
  } else {
    // We rely on this for file I/O (see createWasmFs + file-io domain).
    if (typeof (m.FS as any).mkdirTree !== "function") {
      invalid.push("FS.mkdirTree");
    }
  }

  if (invalid.length > 0) {
    throw new TypeError(
      `Invalid tspice WASM module (missing/invalid exports): ${invalid.join(", ")}. ` +
        `tspice requires the full export surface (core wrappers + cells/windows helpers + Emscripten FS incl FS.mkdirTree). ` +
        `You can skip this check for debugging via CreateWasmBackendOptions.validateEmscriptenModule=false ` +
        `(Node: TSPICE_WASM_SKIP_EMSCRIPTEN_ASSERT=1), but missing exports will still crash later.`,
    );
  }
}
