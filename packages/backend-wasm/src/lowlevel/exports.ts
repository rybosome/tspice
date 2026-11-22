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

  // Error-free scalar constants return their double directly.
  _tspice_pi(): number;
  _tspice_twopi(): number;
  _tspice_halfpi(): number;
  _tspice_dpr(): number;
  _tspice_rpd(): number;
  _tspice_spd(): number;
  _tspice_j2000(): number;
  _tspice_j1900(): number;
  _tspice_b1950(): number;

  // Error-free scalar constants return their double or signed integer directly.
  _tspice_clight(): number;
  _tspice_dpmax(): number;
  _tspice_dpmin(): number;
  _tspice_intmax(): number;
  _tspice_intmin(): number;
  _tspice_b1900(): number;
  _tspice_j1950(): number;
  _tspice_j2100(): number;
  _tspice_jyear(): number;
  _tspice_tyear(): number;

  _tspice_cyllat(
    radius: number,
    lon: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cylrec(
    radius: number,
    lon: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cylsph(
    radius: number,
    lon: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_latcyl(
    radius: number,
    lon: number,
    lat: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_latsph(
    radius: number,
    lon: number,
    lat: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_reccyl(
    rectPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sphcyl(
    radius: number,
    colat: number,
    lon: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sphlat(
    radius: number,
    colat: number,
    lon: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_vdist(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vequ(
    vPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vpack(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vupack(
    vPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vzero(
    vPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_unorm(
    vPtr: number,
    outPtr: number,
    normPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ucrss(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsep(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // --- error/status utilities ---
  _tspice_get_last_error_short(outPtr: number, outMaxBytes: number): number;
  _tspice_get_last_error_long(outPtr: number, outMaxBytes: number): number;
  _tspice_get_last_error_trace(outPtr: number, outMaxBytes: number): number;

  _tspice_failed(
    outFailedPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_reset(errPtr: number, errMaxBytes: number): number;
  _tspice_getmsg(
    whichPtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_setmsg(
    messagePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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
  _tspice_kplfrm(
    frmcls: number,
    idset: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ktotal(
    kindPtr: number,
    outCountPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_exists(
    pathPtr: number,
    outExistsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_getfat(
    pathPtr: number,
    outArchPtr: number,
    outArchMaxBytes: number,
    outTypePtr: number,
    outTypeMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dafac(
    handle: number,
    rows: number,
    width: number,
    data: number,
    room: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafdc(handle: number, err: number, errMaxBytes: number): number;
  _tspice_dafec(
    handle: number,
    rows: number,
    width: number,
    data: number,
    room: number,
    n: number,
    done: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafrs(
    handle: number,
    data: number,
    bytes: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafps(
    nd: number,
    ni: number,
    dc: number,
    dcCount: number,
    ic: number,
    icCount: number,
    out: number,
    room: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafus(
    summary: number,
    size: number,
    nd: number,
    ni: number,
    dc: number,
    dcRoom: number,
    ic: number,
    icRoom: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafgsr(
    handle: number,
    recno: number,
    begin: number,
    end: number,
    out: number,
    room: number,
    outFound: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafrfr(
    handle: number,
    ifnlen: number,
    ifname: number,
    room: number,
    fields: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafrda(
    handle: number,
    begin: number,
    end: number,
    words: number,
    room: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafgda(
    handle: number,
    begin: number,
    end: number,
    words: number,
    room: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafbbs(handle: number, err: number, errMaxBytes: number): number;
  _tspice_dafcs(handle: number, err: number, errMaxBytes: number): number;
  _tspice_daffpa(
    handle: number,
    outFound: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafgh(outHandle: number, err: number, errMaxBytes: number): number;
  _tspice_dafgn(
    handle: number,
    namlen: number,
    out: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafgs(
    handle: number,
    out: number,
    room: number,
    bytes: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafhsf(
    handle: number,
    nd: number,
    ni: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafopw(
    path: number,
    outHandle: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafopr(
    pathPtr: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dafcls(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dafbfs(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_daffna(
    handle: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dasac(
    h: number,
    n: number,
    w: number,
    data: number,
    room: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasdc(h: number, err: number, errMaxBytes: number): number;
  _tspice_dasec(
    h: number,
    rows: number,
    w: number,
    data: number,
    room: number,
    n: number,
    done: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasadc(
    handle: number,
    n: number,
    bpos: number,
    epos: number,
    datlen: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasadd(
    handle: number,
    n: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasadi(
    handle: number,
    n: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasrdc(
    handle: number,
    first: number,
    last: number,
    bpos: number,
    epos: number,
    datlen: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasrdd(
    handle: number,
    first: number,
    last: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasrdi(
    handle: number,
    first: number,
    last: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasudc(
    handle: number,
    first: number,
    last: number,
    bpos: number,
    epos: number,
    datlen: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasudd(
    handle: number,
    first: number,
    last: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasudi(
    handle: number,
    first: number,
    last: number,
    ptr: number,
    length: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasonw(
    path: number,
    ftype: number,
    ifname: number,
    ncomr: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasops(out: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dasopw(
    path: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dashfn(
    handle: number,
    namlen: number,
    name: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dashfs(
    handle: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_daslla(
    handle: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dasllc(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dasrfr(
    handle: number,
    idwlen: number,
    ifnlen: number,
    idword: number,
    ifname: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_daswbr(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dasopr(
    pathPtr: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_dlabbs(
    handle: number,
    outDescr8Ptr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dlafps(
    handle: number,
    descr8Ptr: number,
    outNextDescr8Ptr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dlabns(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dlaens(handle: number, errPtr: number, errMaxBytes: number): number;
  _tspice_dlabfs(
    handle: number,
    outDescr8Ptr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_ekopr(
    pathPtr: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ekopw(
    pathPtr: number,
    outHandlePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_eknseg(
    handle: number,
    outNsegPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekfind(
    queryPtr: number,
    outErrmsgMaxBytes: number,
    outNmrowsPtr: number,
    outErrorPtr: number,
    outErrmsgPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekgc(
    selidx: number,
    row: number,
    elment: number,
    outCdataPtr: number,
    outCdataMaxBytes: number,
    outNullPtr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekgd(
    selidx: number,
    row: number,
    elment: number,
    outDdataPtr: number,
    outNullPtr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekgi(
    selidx: number,
    row: number,
    elment: number,
    outIdataPtr: number,
    outNullPtr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekifld(
    handle: number,
    tabnamPtr: number,
    ncols: number,
    nrows: number,
    cnamln: number,
    cnamesPtr: number,
    declen: number,
    declsPtr: number,
    outSegnoPtr: number,
    outRcptrsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekacli(
    handle: number,
    segno: number,
    columnPtr: number,
    nrows: number,
    ivalsPtr: number,
    nvals: number,
    entszsPtr: number,
    nlflgsPtr: number,
    rcptrsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekacld(
    handle: number,
    segno: number,
    columnPtr: number,
    nrows: number,
    dvalsPtr: number,
    nvals: number,
    entszsPtr: number,
    nlflgsPtr: number,
    rcptrsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekaclc(
    handle: number,
    segno: number,
    columnPtr: number,
    nrows: number,
    nvals: number,
    vallen: number,
    cvalsMaxBytes: number,
    cvalsPtr: number,
    entszsPtr: number,
    nlflgsPtr: number,
    rcptrsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ekffld(
    handle: number,
    segno: number,
    nrows: number,
    rcptrsPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_dskobj(
    dskPathPtr: number,
    bodidsCellHandle: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_str2et(
    utcPtr: number,
    outEtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_bodn2c(
    namePtr: number,
    outCodePtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_sce2t(
    sc: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scfmt(
    sc: number,
    ticks: number,
    clklen: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scpart(
    sc: number,
    room: number,
    countPtr: number,
    startPtr: number,
    stopPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sctiks(
    sc: number,
    textPtr: number,
    outPtr: number,
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

  _tspice_bltfrm(
    frameClass: number,
    ids: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pxfrm2(
    fromPtr: number,
    toPtr: number,
    etfrom: number,
    etto: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_tipbod(
    refPtr: number,
    body: number,
    et: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_tisbod(
    refPtr: number,
    body: number,
    et: number,
    out: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_tkfram(
    typeId: number,
    out: number,
    frame: number,
    found: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xfmsta(
    state: number,
    fromPtr: number,
    toPtr: number,
    bodyPtr: number,
    out: number,
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
  _tspice_frame(
    xPtr: number,
    outXPtr: number,
    outYPtr: number,
    outZPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_twovec(
    axdefPtr: number,
    indexa: number,
    plndefPtr: number,
    indexp: number,
    outRotationPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_twovxf(
    axdefPtr: number,
    indexa: number,
    plndefPtr: number,
    indexp: number,
    outXformPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_eul2xf(
    eulangPtr: number,
    axisa: number,
    axisb: number,
    axisc: number,
    outXformPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xf2eul(
    xformPtr: number,
    axisa: number,
    axisb: number,
    axisc: number,
    outEulangPtr: number,
    outUniquePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xf2rav(
    xformPtr: number,
    outRotPtr: number,
    outAvPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rav2xf(
    rotPtr: number,
    avPtr: number,
    outXformPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_invstm(
    matPtr: number,
    outInvmatPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xpose6(
    m1Ptr: number,
    outMoutPtr: number,
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

  // Geometry classic
  _tspice_illumg(
    methodPtr: number,
    targetPtr: number,
    ilusrcPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    obsrvrPtr: number,
    spoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    outPhasePtr: number,
    outIncdncPtr: number,
    outEmissnPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_illumf(
    methodPtr: number,
    targetPtr: number,
    ilusrcPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    obsrvrPtr: number,
    spoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    outPhasePtr: number,
    outIncdncPtr: number,
    outEmissnPtr: number,
    outVisiblPtr: number,
    outLitPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Plane helpers
  _tspice_nvc2pl(
    normal3Ptr: number,
    konst: number,
    outPlane4Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pl2nvc(
    plane4Ptr: number,
    outNormal3Ptr: number,
    outKonstPtr: number,
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

  // --- GF (Geometry Finder) ---

  _tspice_gfsstp(step: number, errPtr: number, errMaxBytes: number): number;
  _tspice_gfstep(
    time: number,
    outStepPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_gfstol(value: number, errPtr: number, errMaxBytes: number): number;
  _tspice_gfrefn(
    t1: number,
    t2: number,
    s1: number,
    s2: number,
    outTPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_gfrepi(
    window: number,
    begmssPtr: number,
    endmssPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_gfrepf(errPtr: number, errMaxBytes: number): number;
  _tspice_gfsep(
    targ1Ptr: number,
    shape1Ptr: number,
    frame1Ptr: number,
    targ2Ptr: number,
    shape2Ptr: number,
    frame2Ptr: number,
    abcorrPtr: number,
    obsrvrPtr: number,
    relatePtr: number,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    cnfine: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_gfdist(
    targetPtr: number,
    abcorrPtr: number,
    obsrvrPtr: number,
    relatePtr: number,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    cnfine: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Coordinate conversions + small vector/matrix helpers
  _tspice_vlcom(
    a: number,
    v1Ptr: number,
    b: number,
    v2Ptr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vlcom3(
    a: number,
    v1Ptr: number,
    b: number,
    v2Ptr: number,
    c: number,
    v3Ptr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vperp(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vproj(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vrel(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vrotv(
    vPtr: number,
    axisPtr: number,
    theta: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rotvec(
    vPtr: number,
    angle: number,
    axis: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vtmv(
    v1Ptr: number,
    matrixPtr: number,
    v2Ptr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_azlrec(
    range: number,
    az: number,
    el: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recazl(
    rectPtr: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pgrrec(
    bodyPtr: number,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recpgr(
    bodyPtr: number,
    rectPtr: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_radrec(
    range: number,
    ra: number,
    dec: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recrad(
    rectPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_srfrec(
    body: number,
    lon: number,
    lat: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_brcktd(
    value: number,
    end1: number,
    end2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_brckti(
    value: number,
    end1: number,
    end2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_convrt(
    value: number,
    inUnitPtr: number,
    outUnitPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sumad(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sumai(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_maxd(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_maxi(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mind(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mini(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ducrss(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvcrss(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvdot(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvhat(
    statePtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvnorm(
    statePtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvsep(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_chbder(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    nderiv: number,
    workspacePtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_chbigr(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    outPtr: number,
    secondaryPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_chbint(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    outPtr: number,
    secondaryPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_chbval(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_polyds(
    coeffsPtr: number,
    ncoeff: number,
    nderiv: number,
    t: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rquad(
    a: number,
    b: number,
    c: number,
    root1Ptr: number,
    root2Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_hrmesp(
    count: number,
    first: number,
    step: number,
    yvalsPtr: number,
    x: number,
    outPtr: number,
    derivativePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_hrmint(
    count: number,
    xvalsPtr: number,
    yvalsPtr: number,
    x: number,
    workPtr: number,
    outPtr: number,
    derivativePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lgresp(
    count: number,
    first: number,
    step: number,
    yvalsPtr: number,
    x: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lgrind(
    count: number,
    xvalsPtr: number,
    yvalsPtr: number,
    workPtr: number,
    x: number,
    outPtr: number,
    derivativePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lgrint(
    count: number,
    xvalsPtr: number,
    yvalsPtr: number,
    x: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_qderiv(
    count: number,
    f0Ptr: number,
    f2Ptr: number,
    delta: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_clearc(
    ndim: number,
    arrlen: number,
    bytesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cleard(
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cleari(
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_filld(
    value: number,
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_filli(
    value: number,
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_moved(
    sourcePtr: number,
    sourceLength: number,
    ndim: number,
    destinationPtr: number,
    destinationLength: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_eul2m(
    angle3: number,
    angle2: number,
    angle1: number,
    axis3: number,
    axis2: number,
    axis1: number,
    rPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_m2eul(
    mPtr: number,
    axis3: number,
    axis2: number,
    axis1: number,
    angle3Ptr: number,
    angle2Ptr: number,
    angle1Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_m2q(
    mPtr: number,
    qPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_q2m(
    qPtr: number,
    rPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_qxq(
    q1Ptr: number,
    q2Ptr: number,
    qoutPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_qdq2av(
    qPtr: number,
    dqPtr: number,
    avPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_raxisa(
    mPtr: number,
    axisPtr: number,
    anglePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dazldr(
    x: number,
    y: number,
    z: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dcyldr(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dgeodr(
    x: number,
    y: number,
    z: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dlatdr(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dpgrdr(
    bodyPtr: number,
    x: number,
    y: number,
    z: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdazl(
    range: number,
    az: number,
    el: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdcyl(
    radius: number,
    lon: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdgeo(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdlat(
    radius: number,
    lon: number,
    lat: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdpgr(
    bodyPtr: number,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdsph(
    radius: number,
    colat: number,
    lon: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dsphdr(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_det(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_diags2(
    symmatPtr: number,
    diagPtr: number,
    rotatePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ident(outPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_invert(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_invort(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrot(
    mPtr: number,
    ntol: number,
    dtol: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mequ(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxm(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxmt(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_trace(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xpose(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_mequg(
    m1Ptr: number,
    nr: number,
    nc: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxmg(
    m1Ptr: number,
    m2Ptr: number,
    nc1: number,
    nr1r2: number,
    nc2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxvg(
    m1Ptr: number,
    v2Ptr: number,
    nc1: number,
    nr1r2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxmg(
    m1Ptr: number,
    m2Ptr: number,
    nr1: number,
    nc1r2: number,
    nc2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxmtg(
    m1Ptr: number,
    m2Ptr: number,
    nr1: number,
    nc1c2: number,
    nr2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxvg(
    m1Ptr: number,
    v2Ptr: number,
    nr1: number,
    nc1r2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vtmvg(
    v1Ptr: number,
    matrixPtr: number,
    v2Ptr: number,
    nrow: number,
    ncol: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xposeg(
    matrixPtr: number,
    nrow: number,
    ncol: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vaddg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vdistg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vdotg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vequg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vhatg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vlcomg(
    a: number,
    v1Ptr: number,
    b: number,
    v2Ptr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vminug(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vnormg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vprojg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vrelg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsclg(
    s: number,
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsepg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsubg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vzerog(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_unormg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    normPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cpos(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cposr(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ncpos(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ncposr(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pos(
    textPtr: number,
    substrPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_posr(
    textPtr: number,
    substrPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_esrchc(
    valuePtr: number,
    count: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dp2hx(
    value: number,
    lenout: number,
    text: number,
    size: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_hx2dp(
    input: number,
    lenout: number,
    number: number,
    error: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_prsdp(
    input: number,
    number: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_prsint(
    input: number,
    number: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repmc(
    input: number,
    marker: number,
    value: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repmct(
    input: number,
    marker: number,
    value: number,
    rtcase: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repmd(
    input: number,
    marker: number,
    value: number,
    sigdig: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repmf(
    input: number,
    marker: number,
    value: number,
    sigdig: number,
    format: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repmi(
    input: number,
    marker: number,
    value: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repml(
    input: number,
    marker: number,
    value: number,
    rtcase: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_repmot(
    input: number,
    marker: number,
    value: number,
    rtcase: number,
    lenout: number,
    text: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_nextwd(
    input: number,
    nexlen: number,
    reslen: number,
    next: number,
    rest: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_nthwd(
    input: number,
    nth: number,
    worlen: number,
    word: number,
    loc: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lparse(
    list: number,
    delim: number,
    nmax: number,
    itemln: number,
    n: number,
    items: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lparsm(
    list: number,
    delims: number,
    nmax: number,
    itemln: number,
    n: number,
    items: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4dec(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4num(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4sgn(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4uns(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lxqstr(
    input: number,
    qchar: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_cmprss(
    delim: number,
    n: number,
    inputPtr: number,
    lenout: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_eqstr(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_iswhsp(
    inputPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lastnb(
    inputPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lcase(
    inputPtr: number,
    lenout: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ucase(
    inputPtr: number,
    lenout: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_matchi(
    inputPtr: number,
    templPtr: number,
    wstr: number,
    wchr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_matchw(
    inputPtr: number,
    templPtr: number,
    wstr: number,
    wchr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_bschoc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    orderPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bschoi(
    key: number,
    n: number,
    valuesPtr: number,
    orderPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bsrchc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bsrchd(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bsrchi(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrchc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrchd(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrchi(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_isordv(
    n: number,
    values: number,
    out: number,
    err: number,
    cap: number,
  ): number;
  _tspice_orderc(
    n: number,
    width: number,
    values: number,
    out: number,
    err: number,
    cap: number,
  ): number;
  _tspice_orderd(
    n: number,
    values: number,
    out: number,
    err: number,
    cap: number,
  ): number;
  _tspice_orderi(
    n: number,
    values: number,
    out: number,
    err: number,
    cap: number,
  ): number;
  _tspice_reordc(
    n: number,
    order: number,
    width: number,
    values: number,
    err: number,
    cap: number,
  ): number;
  _tspice_reordd(
    n: number,
    order: number,
    values: number,
    err: number,
    cap: number,
  ): number;
  _tspice_reordi(
    n: number,
    order: number,
    values: number,
    err: number,
    cap: number,
  ): number;
  _tspice_reordl(
    n: number,
    order: number,
    values: number,
    err: number,
    cap: number,
  ): number;
  _tspice_shellc(
    n: number,
    width: number,
    values: number,
    err: number,
    cap: number,
  ): number;
  _tspice_shelld(n: number, values: number, err: number, cap: number): number;
  _tspice_shelli(n: number, values: number, err: number, cap: number): number;
  _tspice_lstlec(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstled(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstlei(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstltc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstltd(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstlti(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_vnorm(
    v3Ptr: number,
    outNormPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vhat(
    v3Ptr: number,
    outVhat3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_vadd(
    a3Ptr: number,
    b3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsub(
    a3Ptr: number,
    b3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vminus(
    v3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vscl(
    s: number,
    v3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_rotate(
    angle: number,
    axis: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rotmat(
    m3x3Ptr: number,
    angle: number,
    axis: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_axisar(
    axis3Ptr: number,
    angle: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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
  _tspice_new_int_cell(
    size: number,
    outCellPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_new_double_cell(
    size: number,
    outCellPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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
  _tspice_free_window(
    window: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ssize(
    size: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scard(
    card: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_card(
    cell: number,
    outCardPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_size(
    cell: number,
    outSizePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_valid(
    size: number,
    n: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_insrti(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_insrtd(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lparss(
    list: number,
    delims: number,
    set: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_appndc(
    itemPtr: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_appndd(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_appndi(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_elemc(
    itemPtr: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_elemd(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_elemi(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_diff(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_inter(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sdiff(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_union(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_set(
    a: number,
    opPtr: number,
    b: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_removc(
    itemPtr: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_removd(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_removi(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ordc(
    itemPtr: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ordd(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ordi(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_copy(
    source: number,
    destination: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_insrtc(
    itemPtr: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_wncomd(
    left: number,
    right: number,
    windowPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wncond(
    left: number,
    right: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wndifd(
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnelmd(
    point: number,
    windowPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnexpd(
    left: number,
    right: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnextd(
    side: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnfild(
    small: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnfltd(
    small: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnincd(
    left: number,
    right: number,
    windowPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnintd(
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnreld(
    aPtr: number,
    opPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnsumd(
    windowPtr: number,
    measPtr: number,
    avgPtr: number,
    stddevPtr: number,
    shortestPtr: number,
    longestPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnunid(
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_wninsd(
    left: number,
    right: number,
    window: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wncard(
    window: number,
    outCardPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnfetd(
    window: number,
    index: number,
    outLeftPtr: number,
    outRightPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnvald(
    size: number,
    n: number,
    window: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // --- kernel pool ---
  _tspice_badkpv(
    caller: number,
    name: number,
    comp: number,
    size: number,
    divby: number,
    type: number,
    bad: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_bodvcd(
    body: number,
    item: number,
    maxn: number,
    dim: number,
    values: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_bodvrd(
    body: number,
    item: number,
    maxn: number,
    dim: number,
    values: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_clpool(err: number, errMaxBytes: number): number;
  _tspice_dvpool(name: number, err: number, errMaxBytes: number): number;
  _tspice_ldpool(path: number, err: number, errMaxBytes: number): number;
  _tspice_lmpool(
    rows: number,
    stride: number,
    count: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_stpool(
    item: number,
    nth: number,
    contin: number,
    lenout: number,
    text: number,
    size: number,
    found: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_szpool(
    name: number,
    n: number,
    found: number,
    err: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_pdpool(
    namePtr: number,
    n: number,
    valuesPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pipool(
    namePtr: number,
    n: number,
    valuesPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_cvpool(
    agentPtr: number,
    outUpdatePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_expool(
    namePtr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // --- time ---
  _tspice_str2et(
    utcPtr: number,
    outEtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_deltet(
    epoch: number,
    eptypePtr: number,
    outDeltaPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_unitim(
    epoch: number,
    insysPtr: number,
    outsysPtr: number,
    outEpochPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_etcal(
    et: number,
    callen: number,
    out: number,
    err: number,
    cap: number,
  ): number;
  _tspice_utc2et(text: number, out: number, err: number, cap: number): number;
  _tspice_tparch(text: number, err: number, cap: number): number;
  _tspice_tsetyr(year: number, err: number, cap: number): number;
  _tspice_et2lst(
    et: number,
    body: number,
    lon: number,
    type: number,
    timlen: number,
    ampmlen: number,
    hms: number,
    time: number,
    ampm: number,
    err: number,
    cap: number,
  ): number;
  _tspice_tparse(
    timstrPtr: number,
    outEtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_tpictr(
    samplePtr: number,
    picturInPtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_timdef_get(
    itemPtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_timdef_set(
    itemPtr: number,
    valuePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scencd(
    sc: number,
    sclkchPtr: number,
    outSclkdpPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scdecd(
    sc: number,
    sclkdp: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sct2e(
    sc: number,
    sclkdp: number,
    outEtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sce2c(
    sc: number,
    et: number,
    outSclkdpPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // --- ids/names/frames ---
  _tspice_bodn2c(
    namePtr: number,
    outCodePtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bodc2n(
    code: number,
    outNamePtr: number,
    outNameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_srfc2s(
    code: number,
    bodyId: number,
    srflen: number,
    textPtr: number,
    flagPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_srfcss(
    code: number,
    bodyPtr: number,
    srflen: number,
    textPtr: number,
    flagPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_srfs2c(
    surfacePtr: number,
    bodyPtr: number,
    codePtr: number,
    flagPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_srfscc(
    surfacePtr: number,
    bodyId: number,
    codePtr: number,
    flagPtr: number,
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

  _tspice_bods2c(
    namePtr: number,
    outCodePtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_boddef(
    namePtr: number,
    code: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_bodfnd(
    body: number,
    itemPtr: number,
    outResultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_sce2t(
    sc: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scfmt(
    sc: number,
    ticks: number,
    clklen: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scpart(
    sc: number,
    room: number,
    countPtr: number,
    startPtr: number,
    stopPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sctiks(
    sc: number,
    textPtr: number,
    outPtr: number,
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

  _tspice_ckupf(handle: number, errPtr: number, errMaxBytes: number): number;

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
  _tspice_pxform(
    fromPtr: number,
    toPtr: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_frame(
    xPtr: number,
    outXPtr: number,
    outYPtr: number,
    outZPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_twovec(
    axdefPtr: number,
    indexa: number,
    plndefPtr: number,
    indexp: number,
    outRotationPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_twovxf(
    axdefPtr: number,
    indexa: number,
    plndefPtr: number,
    indexp: number,
    outXformPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_eul2xf(
    eulangPtr: number,
    axisa: number,
    axisb: number,
    axisc: number,
    outXformPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xf2eul(
    xformPtr: number,
    axisa: number,
    axisb: number,
    axisc: number,
    outEulangPtr: number,
    outUniquePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xf2rav(
    xformPtr: number,
    outRotPtr: number,
    outAvPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rav2xf(
    rotPtr: number,
    avPtr: number,
    outXformPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_invstm(
    matPtr: number,
    outInvmatPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xpose6(
    m1Ptr: number,
    outMoutPtr: number,
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

  // Geometry classic
  _tspice_illumg(
    methodPtr: number,
    targetPtr: number,
    ilusrcPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    obsrvrPtr: number,
    spoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    outPhasePtr: number,
    outIncdncPtr: number,
    outEmissnPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_illumf(
    methodPtr: number,
    targetPtr: number,
    ilusrcPtr: number,
    et: number,
    fixrefPtr: number,
    abcorrPtr: number,
    obsrvrPtr: number,
    spoint3Ptr: number,
    outTrgepcPtr: number,
    outSrfvec3Ptr: number,
    outPhasePtr: number,
    outIncdncPtr: number,
    outEmissnPtr: number,
    outVisiblPtr: number,
    outLitPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Plane helpers
  _tspice_nvc2pl(
    normal3Ptr: number,
    konst: number,
    outPlane4Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pl2nvc(
    plane4Ptr: number,
    outNormal3Ptr: number,
    outKonstPtr: number,
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
  _tspice_vlcom(
    a: number,
    v1Ptr: number,
    b: number,
    v2Ptr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vlcom3(
    a: number,
    v1Ptr: number,
    b: number,
    v2Ptr: number,
    c: number,
    v3Ptr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vperp(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vproj(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vrel(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vrotv(
    vPtr: number,
    axisPtr: number,
    theta: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rotvec(
    vPtr: number,
    angle: number,
    axis: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vtmv(
    v1Ptr: number,
    matrixPtr: number,
    v2Ptr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_azlrec(
    range: number,
    az: number,
    el: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recazl(
    rectPtr: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pgrrec(
    bodyPtr: number,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recpgr(
    bodyPtr: number,
    rectPtr: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_radrec(
    range: number,
    ra: number,
    dec: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_recrad(
    rectPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_srfrec(
    body: number,
    lon: number,
    lat: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_brcktd(
    value: number,
    end1: number,
    end2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_brckti(
    value: number,
    end1: number,
    end2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_convrt(
    value: number,
    inUnitPtr: number,
    outUnitPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sumad(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sumai(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_maxd(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_maxi(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mind(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mini(
    valuesPtr: number,
    count: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ducrss(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvcrss(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvdot(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvhat(
    statePtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvnorm(
    statePtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dvsep(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_chbder(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    nderiv: number,
    workspacePtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_chbigr(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    outPtr: number,
    secondaryPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_chbint(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    outPtr: number,
    secondaryPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_chbval(
    cpPtr: number,
    ncoeff: number,
    x2sPtr: number,
    x: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_polyds(
    coeffsPtr: number,
    ncoeff: number,
    nderiv: number,
    t: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rquad(
    a: number,
    b: number,
    c: number,
    root1Ptr: number,
    root2Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_hrmesp(
    count: number,
    first: number,
    step: number,
    yvalsPtr: number,
    x: number,
    outPtr: number,
    derivativePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_hrmint(
    count: number,
    xvalsPtr: number,
    yvalsPtr: number,
    x: number,
    workPtr: number,
    outPtr: number,
    derivativePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lgresp(
    count: number,
    first: number,
    step: number,
    yvalsPtr: number,
    x: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lgrind(
    count: number,
    xvalsPtr: number,
    yvalsPtr: number,
    workPtr: number,
    x: number,
    outPtr: number,
    derivativePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lgrint(
    count: number,
    xvalsPtr: number,
    yvalsPtr: number,
    x: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_qderiv(
    count: number,
    f0Ptr: number,
    f2Ptr: number,
    delta: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_clearc(
    ndim: number,
    arrlen: number,
    bytesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cleard(
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cleari(
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_filld(
    value: number,
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_filli(
    value: number,
    ndim: number,
    valuesPtr: number,
    length: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_moved(
    sourcePtr: number,
    sourceLength: number,
    ndim: number,
    destinationPtr: number,
    destinationLength: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_dazldr(
    x: number,
    y: number,
    z: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dcyldr(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dgeodr(
    x: number,
    y: number,
    z: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dlatdr(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dpgrdr(
    bodyPtr: number,
    x: number,
    y: number,
    z: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdazl(
    range: number,
    az: number,
    el: number,
    azccw: number,
    elplsz: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdcyl(
    radius: number,
    lon: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdgeo(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdlat(
    radius: number,
    lon: number,
    lat: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdpgr(
    bodyPtr: number,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_drdsph(
    radius: number,
    colat: number,
    lon: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_dsphdr(
    x: number,
    y: number,
    z: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_det(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_diags2(
    symmatPtr: number,
    diagPtr: number,
    rotatePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ident(outPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_invert(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_invort(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrot(
    mPtr: number,
    ntol: number,
    dtol: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mequ(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxm(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxmt(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_trace(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xpose(
    mPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_mequg(
    m1Ptr: number,
    nr: number,
    nc: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxmg(
    m1Ptr: number,
    m2Ptr: number,
    nc1: number,
    nr1r2: number,
    nc2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mtxvg(
    m1Ptr: number,
    v2Ptr: number,
    nc1: number,
    nr1r2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxmg(
    m1Ptr: number,
    m2Ptr: number,
    nr1: number,
    nc1r2: number,
    nc2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxmtg(
    m1Ptr: number,
    m2Ptr: number,
    nr1: number,
    nc1c2: number,
    nr2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_mxvg(
    m1Ptr: number,
    v2Ptr: number,
    nr1: number,
    nc1r2: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vtmvg(
    v1Ptr: number,
    matrixPtr: number,
    v2Ptr: number,
    nrow: number,
    ncol: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_xposeg(
    matrixPtr: number,
    nrow: number,
    ncol: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vaddg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vdistg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vdotg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vequg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vhatg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vlcomg(
    a: number,
    v1Ptr: number,
    b: number,
    v2Ptr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vminug(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vnormg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vprojg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vrelg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsclg(
    s: number,
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsepg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsubg(
    aPtr: number,
    bPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vzerog(
    vPtr: number,
    ndim: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_unormg(
    vPtr: number,
    ndim: number,
    outPtr: number,
    normPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cpos(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_cposr(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ncpos(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ncposr(
    textPtr: number,
    charsPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_pos(
    textPtr: number,
    substrPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_posr(
    textPtr: number,
    substrPtr: number,
    start: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_esrchc(
    valuePtr: number,
    count: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_nextwd(
    input: number,
    nexlen: number,
    reslen: number,
    next: number,
    rest: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_nthwd(
    input: number,
    nth: number,
    worlen: number,
    word: number,
    loc: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lparse(
    list: number,
    delim: number,
    nmax: number,
    itemln: number,
    n: number,
    items: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lparsm(
    list: number,
    delims: number,
    nmax: number,
    itemln: number,
    n: number,
    items: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4dec(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4num(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4sgn(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lx4uns(
    input: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_lxqstr(
    input: number,
    qchar: number,
    first: number,
    last: number,
    nchar: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_cmprss(
    delim: number,
    n: number,
    inputPtr: number,
    lenout: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_eqstr(
    aPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_iswhsp(
    inputPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lastnb(
    inputPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lcase(
    inputPtr: number,
    lenout: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ucase(
    inputPtr: number,
    lenout: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_matchi(
    inputPtr: number,
    templPtr: number,
    wstr: number,
    wchr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_matchw(
    inputPtr: number,
    templPtr: number,
    wstr: number,
    wchr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_bschoc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    orderPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bschoi(
    key: number,
    n: number,
    valuesPtr: number,
    orderPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bsrchc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bsrchd(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_bsrchi(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrchc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrchd(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_isrchi(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_lstlec(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstled(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstlei(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstltc(
    keyPtr: number,
    n: number,
    width: number,
    rowsPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstltd(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lstlti(
    key: number,
    n: number,
    valuesPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_vnorm(
    v3Ptr: number,
    outNormPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vhat(
    v3Ptr: number,
    outVhat3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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

  _tspice_vadd(
    a3Ptr: number,
    b3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vsub(
    a3Ptr: number,
    b3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vminus(
    v3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_vscl(
    s: number,
    v3Ptr: number,
    out3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_rotate(
    angle: number,
    axis: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_rotmat(
    m3x3Ptr: number,
    angle: number,
    axis: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_axisar(
    axis3Ptr: number,
    angle: number,
    outM3x3Ptr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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
  _tspice_new_int_cell(
    size: number,
    outCellPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_new_double_cell(
    size: number,
    outCellPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
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
  _tspice_free_window(
    window: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_ssize(
    size: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_scard(
    card: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_card(
    cell: number,
    outCardPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_size(
    cell: number,
    outSizePtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_valid(
    size: number,
    n: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_insrti(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_insrtd(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_appndc(
    itemPtr: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_appndd(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_appndi(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_elemc(
    itemPtr: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_elemd(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_elemi(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_diff(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_inter(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sdiff(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_union(
    a: number,
    b: number,
    result: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_set(
    a: number,
    opPtr: number,
    b: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_removc(
    itemPtr: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_removd(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_removi(
    item: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ordc(
    itemPtr: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ordd(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ordi(
    item: number,
    cell: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_copy(
    source: number,
    destination: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_lparss(
    list: number,
    delims: number,
    set: number,
    err: number,
    errMaxBytes: number,
  ): number;
  _tspice_insrtc(
    itemPtr: number,
    cell: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

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

  _tspice_wncomd(
    left: number,
    right: number,
    windowPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wncond(
    left: number,
    right: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wndifd(
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnelmd(
    point: number,
    windowPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnexpd(
    left: number,
    right: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnextd(
    side: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnfild(
    small: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnfltd(
    small: number,
    windowPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnincd(
    left: number,
    right: number,
    windowPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnintd(
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnreld(
    aPtr: number,
    opPtr: number,
    bPtr: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnsumd(
    windowPtr: number,
    measPtr: number,
    avgPtr: number,
    stddevPtr: number,
    shortestPtr: number,
    longestPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnunid(
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_wninsd(
    left: number,
    right: number,
    window: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wncard(
    window: number,
    outCardPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnfetd(
    window: number,
    index: number,
    outLeftPtr: number,
    outRightPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_wnvald(
    size: number,
    n: number,
    window: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  FS: {
    create(path: string, mode: number): unknown;
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string, options: { encoding: "binary" }): Uint8Array;
    unlink(path: string): void;
  };
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
  "_tspice_kplfrm",
  "_tspice_ktotal",
  "_tspice_kdata",

  // File I/O
  "_tspice_exists",
  "_tspice_getfat",
  "_tspice_dafac",
  "_tspice_dafdc",
  "_tspice_dafec",
  "_tspice_dafrs",
  "_tspice_dafps",
  "_tspice_dafus",
  "_tspice_dafgsr",
  "_tspice_dafrfr",
  "_tspice_dafrda",
  "_tspice_dafgda",
  "_tspice_dafbbs",
  "_tspice_dafcs",
  "_tspice_daffpa",
  "_tspice_dafgh",
  "_tspice_dafgn",
  "_tspice_dafgs",
  "_tspice_dafhsf",
  "_tspice_dafopw",
  "_tspice_dafopr",
  "_tspice_dafcls",
  "_tspice_dafbfs",
  "_tspice_daffna",
  "_tspice_dasac",
  "_tspice_dasdc",
  "_tspice_dasec",
  "_tspice_dasadc",
  "_tspice_dasadd",
  "_tspice_dasadi",
  "_tspice_dasrdc",
  "_tspice_dasrdd",
  "_tspice_dasrdi",
  "_tspice_dasudc",
  "_tspice_dasudd",
  "_tspice_dasudi",
  "_tspice_dasonw",
  "_tspice_dasops",
  "_tspice_dasopw",
  "_tspice_dashfn",
  "_tspice_dashfs",
  "_tspice_daslla",
  "_tspice_dasllc",
  "_tspice_dasrfr",
  "_tspice_daswbr",
  "_tspice_dasopr",
  "_tspice_dascls",
  "_tspice_dlaopn",
  "_tspice_dlabbs",
  "_tspice_dlabns",
  "_tspice_dlaens",
  "_tspice_dlafps",
  "_tspice_dlabfs",
  "_tspice_dlafns",
  "_tspice_dlacls",

  // Kernel pool
  "_tspice_badkpv",
  "_tspice_bodvcd",
  "_tspice_bodvrd",
  "_tspice_clpool",
  "_tspice_dvpool",
  "_tspice_ldpool",
  "_tspice_lmpool",
  "_tspice_stpool",
  "_tspice_szpool",
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
  "_tspice_etcal",
  "_tspice_utc2et",
  "_tspice_tparch",
  "_tspice_tsetyr",
  "_tspice_et2lst",
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
  "_tspice_srfc2s",
  "_tspice_srfcss",
  "_tspice_srfs2c",
  "_tspice_srfscc",
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
  "_tspice_sce2t",
  "_tspice_scfmt",
  "_tspice_scpart",
  "_tspice_sctiks",
  "_tspice_sce2s",
  "_tspice_ckgp",
  "_tspice_ckgpav",
  "_tspice_cklpf",
  "_tspice_ckupf",
  "_tspice_ckobj",
  "_tspice_ckcov",
  "_tspice_bltfrm",
  "_tspice_pxfrm2",
  "_tspice_tipbod",
  "_tspice_tisbod",
  "_tspice_tkfram",
  "_tspice_xfmsta",
  "_tspice_pxform",
  "_tspice_frame",
  "_tspice_twovec",
  "_tspice_twovxf",
  "_tspice_eul2xf",
  "_tspice_xf2eul",
  "_tspice_xf2rav",
  "_tspice_rav2xf",
  "_tspice_invstm",
  "_tspice_xpose6",
  "_tspice_sxform",
  "_tspice_spkezr",
  "_tspice_spkpos",
  "_tspice_spkez",
  "_tspice_spkezp",
  "_tspice_spkgeo",
  "_tspice_spkgps",
  "_tspice_illumg",
  "_tspice_illumf",
  "_tspice_nvc2pl",
  "_tspice_pl2nvc",
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
  "_tspice_gfsstp",
  "_tspice_gfstep",
  "_tspice_gfstol",
  "_tspice_gfrefn",
  "_tspice_gfrepi",
  "_tspice_gfrepf",
  "_tspice_gfsep",
  "_tspice_gfdist",
  "_tspice_vlcom",
  "_tspice_vlcom3",
  "_tspice_vperp",
  "_tspice_vproj",
  "_tspice_vrel",
  "_tspice_vrotv",
  "_tspice_rotvec",
  "_tspice_vtmv",
  "_tspice_azlrec",
  "_tspice_recazl",
  "_tspice_pgrrec",
  "_tspice_recpgr",
  "_tspice_radrec",
  "_tspice_recrad",
  "_tspice_srfrec",
  "_tspice_brcktd",
  "_tspice_brckti",
  "_tspice_convrt",
  "_tspice_sumad",
  "_tspice_sumai",
  "_tspice_maxd",
  "_tspice_maxi",
  "_tspice_mind",
  "_tspice_mini",
  "_tspice_ducrss",
  "_tspice_dvcrss",
  "_tspice_dvdot",
  "_tspice_dvhat",
  "_tspice_dvnorm",
  "_tspice_dvsep",
  "_tspice_chbder",
  "_tspice_chbigr",
  "_tspice_chbint",
  "_tspice_chbval",
  "_tspice_polyds",
  "_tspice_rquad",
  "_tspice_hrmesp",
  "_tspice_hrmint",
  "_tspice_lgresp",
  "_tspice_lgrind",
  "_tspice_lgrint",
  "_tspice_qderiv",
  "_tspice_clearc",
  "_tspice_cleard",
  "_tspice_cleari",
  "_tspice_filld",
  "_tspice_filli",
  "_tspice_moved",
  "_tspice_eul2m",
  "_tspice_m2eul",
  "_tspice_m2q",
  "_tspice_q2m",
  "_tspice_qxq",
  "_tspice_qdq2av",
  "_tspice_raxisa",
  "_tspice_dazldr",
  "_tspice_dcyldr",
  "_tspice_dgeodr",
  "_tspice_dlatdr",
  "_tspice_dpgrdr",
  "_tspice_drdazl",
  "_tspice_drdcyl",
  "_tspice_drdgeo",
  "_tspice_drdlat",
  "_tspice_drdpgr",
  "_tspice_drdsph",
  "_tspice_dsphdr",
  "_tspice_det",
  "_tspice_diags2",
  "_tspice_ident",
  "_tspice_invert",
  "_tspice_invort",
  "_tspice_isrot",
  "_tspice_mequ",
  "_tspice_mtxm",
  "_tspice_mxmt",
  "_tspice_trace",
  "_tspice_xpose",
  "_tspice_mequg",
  "_tspice_mtxmg",
  "_tspice_mtxvg",
  "_tspice_mxmg",
  "_tspice_mxmtg",
  "_tspice_mxvg",
  "_tspice_vtmvg",
  "_tspice_xposeg",
  "_tspice_vaddg",
  "_tspice_vdistg",
  "_tspice_vdotg",
  "_tspice_vequg",
  "_tspice_vhatg",
  "_tspice_vlcomg",
  "_tspice_vminug",
  "_tspice_vnormg",
  "_tspice_vprojg",
  "_tspice_vrelg",
  "_tspice_vsclg",
  "_tspice_vsepg",
  "_tspice_vsubg",
  "_tspice_vzerog",
  "_tspice_unormg",
  "_tspice_cpos",
  "_tspice_cposr",
  "_tspice_ncpos",
  "_tspice_ncposr",
  "_tspice_pos",
  "_tspice_posr",
  "_tspice_esrchc",
  "_tspice_dp2hx",
  "_tspice_hx2dp",
  "_tspice_prsdp",
  "_tspice_prsint",
  "_tspice_repmc",
  "_tspice_repmct",
  "_tspice_repmd",
  "_tspice_repmf",
  "_tspice_repmi",
  "_tspice_repml",
  "_tspice_repmot",
  "_tspice_nextwd",
  "_tspice_nthwd",
  "_tspice_lparse",
  "_tspice_lparsm",
  "_tspice_lx4dec",
  "_tspice_lx4num",
  "_tspice_lx4sgn",
  "_tspice_lx4uns",
  "_tspice_lxqstr",
  "_tspice_cmprss",
  "_tspice_eqstr",
  "_tspice_iswhsp",
  "_tspice_lastnb",
  "_tspice_lcase",
  "_tspice_ucase",
  "_tspice_matchi",
  "_tspice_matchw",
  "_tspice_bschoc",
  "_tspice_bschoi",
  "_tspice_bsrchc",
  "_tspice_bsrchd",
  "_tspice_bsrchi",
  "_tspice_isrchc",
  "_tspice_isrchd",
  "_tspice_isrchi",
  "_tspice_isordv",
  "_tspice_orderc",
  "_tspice_orderd",
  "_tspice_orderi",
  "_tspice_reordc",
  "_tspice_reordd",
  "_tspice_reordi",
  "_tspice_reordl",
  "_tspice_shellc",
  "_tspice_shelld",
  "_tspice_shelli",
  "_tspice_lstlec",
  "_tspice_lstled",
  "_tspice_lstlei",
  "_tspice_lstltc",
  "_tspice_lstltd",
  "_tspice_lstlti",
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
  "_tspice_ekfind",
  "_tspice_ekgc",
  "_tspice_ekgd",
  "_tspice_ekgi",
  "_tspice_ekifld",
  "_tspice_ekacli",
  "_tspice_ekacld",
  "_tspice_ekaclc",
  "_tspice_ekffld",

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
  "_tspice_appndc",
  "_tspice_appndd",
  "_tspice_appndi",
  "_tspice_elemc",
  "_tspice_elemd",
  "_tspice_elemi",
  "_tspice_diff",
  "_tspice_inter",
  "_tspice_sdiff",
  "_tspice_union",
  "_tspice_set",
  "_tspice_removc",
  "_tspice_removd",
  "_tspice_removi",
  "_tspice_ordc",
  "_tspice_ordd",
  "_tspice_ordi",
  "_tspice_copy",
  "_tspice_lparss",
  "_tspice_insrtc",
  "_tspice_cell_geti",
  "_tspice_cell_getd",
  "_tspice_cell_getc",
  "_tspice_wncomd",
  "_tspice_wncond",
  "_tspice_wndifd",
  "_tspice_wnelmd",
  "_tspice_wnexpd",
  "_tspice_wnextd",
  "_tspice_wnfild",
  "_tspice_wnfltd",
  "_tspice_wnincd",
  "_tspice_wnintd",
  "_tspice_wnreld",
  "_tspice_wnsumd",
  "_tspice_wnunid",
  "_tspice_wninsd",
  "_tspice_wncard",
  "_tspice_wnfetd",
  "_tspice_wnvald",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Assert that an object looks like the expected tspice Emscripten module export surface. */
export function assertEmscriptenModule(
  m: unknown,
): asserts m is EmscriptenModule {
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

  if (!isRecord(m.FS)) {
    invalid.push("FS");
  } else {
    // We rely on this for file I/O (see createWasmFs + file-io domain).
    if (typeof m.FS.mkdirTree !== "function") {
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
