import {
  spiceClients,
  type Spice,
  type SpiceAsync,
  type SpiceConicElements,
  type SpiceEquinoctialElements,
  type SpiceExtendedConicElements,
} from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Check synchronous/asynchronous raw constants without browser library types. */
export function constantTypes(sync: Spice, async: SpiceAsync): void {
  const scalar: number = sync.raw.pi();
  const julianDate: number = sync.raw.j2000();
  const promisedScalar: Promise<number> = async.raw.rpd();
  const promisedJulianDate: Promise<number> = async.raw.b1950();
  void [scalar, julianDate, promisedScalar, promisedJulianDate];
}

/** Check scalar raw API types without browser library declarations. */
export function scalarConstantTypes(sync: Spice, async: SpiceAsync): void {
  const secondsPerYear: number = sync.raw.jyear();
  const minimumInteger: number = sync.raw.intmin();
  const promisedLimit: Promise<number> = async.raw.dpmax();
  const promisedDate: Promise<number> = async.raw.b1900();
  void [secondsPerYear, minimumInteger, promisedLimit, promisedDate];
}

/** Check public coordinate conversion types without browser declarations. */
export function cylindricalTypes(sync: Spice, async: SpiceAsync): void {
  const rect: [number, number, number] = sync.raw.cylrec(3, 0.5, -2);
  const cyl: { radius: number; lon: number; z: number } = sync.raw.reccyl(rect);
  const lat: Promise<{ radius: number; lon: number; lat: number }> =
    async.raw.cyllat(3, 0.5, -2);
  const sph: Promise<{ radius: number; colat: number; lon: number }> =
    async.raw.latsph(3, 0.5, -0.2);
  void [cyl, lat, sph];
}

/** Verify basic vector APIs accept readonly inputs without requiring DOM types. */
export function vectorBasicsTypes(sync: Spice, async: SpiceAsync): void {
  const input = [1, -2, 3] as const;
  const copy: [number, number, number] = sync.raw.vequ(input);
  const unpacked: { x: number; y: number; z: number } = sync.raw.vupack(input);
  const zero: boolean = sync.raw.vzero(input);
  const norm: Promise<{ unit: [number, number, number]; norm: number }> =
    async.raw.unorm(input);
  const separation: Promise<number> = async.raw.vsep(input, input);
  void [copy, unpacked, zero, norm, separation];
}

/** Verify vector combinations accept readonly inputs and preserve sync/async results without DOM types. */
export function vectorCombinationTypes(sync: Spice, async: SpiceAsync): void {
  const input = [1, -2, 3] as const;
  const matrix = sync.raw.rotate(0, 3);
  const linear: [number, number, number] = sync.raw.vlcom(2, input, -3, input);
  const triple: Promise<[number, number, number]> = async.raw.vlcom3(
    1,
    input,
    2,
    input,
    3,
    input,
  );
  const perpendicular: [number, number, number] = sync.raw.vperp(input, input);
  const projection: Promise<[number, number, number]> = async.raw.vproj(
    input,
    input,
  );
  const difference: number = sync.raw.vrel(input, input);
  const active: [number, number, number] = sync.raw.vrotv(input, input, 0.5);
  const coordinate: Promise<[number, number, number]> = async.raw.rotvec(
    input,
    0.5,
    -1,
  );
  const product: Promise<number> = async.raw.vtmv(input, matrix, input);
  void [
    linear,
    triple,
    perpendicular,
    projection,
    difference,
    active,
    coordinate,
    product,
  ];
}

/** Verify coordinate conventions preserve readonly input and sync/async output types without DOM types. */
export function coordinateConventionTypes(
  sync: Spice,
  async: SpiceAsync,
): void {
  const rect = [1, -2, 3] as const;
  const azimuth: [number, number, number] = sync.raw.azlrec(
    5,
    0.2,
    -0.1,
    true,
    false,
  );
  const angles: Promise<{ range: number; az: number; el: number }> =
    async.raw.recazl(rect, false, true);
  const planet: [number, number, number] = sync.raw.pgrrec(
    "EARTH",
    0.2,
    0.3,
    2,
    10,
    0.1,
  );
  const geographic: Promise<{ lon: number; lat: number; alt: number }> =
    async.raw.recpgr("399", rect, 10, 0.1);
  const equatorial: Promise<[number, number, number]> = async.raw.radrec(
    -4,
    0.5,
    0.1,
  );
  const rightAscension: { range: number; ra: number; dec: number } =
    sync.raw.recrad(rect);
  const surface: Promise<[number, number, number]> = async.raw.srfrec(
    399,
    -1,
    0.5,
  );
  void [
    azimuth,
    angles,
    planet,
    geographic,
    equatorial,
    rightAscension,
    surface,
  ];
}

/** Verify scalar operations accept readonly arrays and preserve sync/async results without DOM types. */
export function scalarMathTypes(sync: Spice, async: SpiceAsync): void {
  const values = [1, -2, 3] as const;
  const doubleBracket: number = sync.raw.brcktd(3.5, 8, -4);
  const intBracket: Promise<number> = async.raw.brckti(3, 8, -4);
  const conversion: Promise<number> = async.raw.convrt(3, "km", "meters");
  const doubleSum: number = sync.raw.sumad(values);
  const intSum: Promise<number> = async.raw.sumai(values);
  const doubleMaximum: number = sync.raw.maxd(values);
  const intMaximum: Promise<number> = async.raw.maxi(values);
  const doubleMinimum: Promise<number> = async.raw.mind(values);
  const intMinimum: number = sync.raw.mini(values);
  void [
    doubleBracket,
    intBracket,
    conversion,
    doubleSum,
    intSum,
    doubleMaximum,
    intMaximum,
    doubleMinimum,
    intMinimum,
  ];
}

/** Verify state derivatives accept readonly six-component states and preserve sync/async results without DOM types. */
export function stateDerivativeTypes(sync: Spice, async: SpiceAsync): void {
  const a = [1, -2, 3, -4, 5, -6] as const;
  const b = [7, 11, -13, 17, -19, 23] as const;
  const unitCross: [number, number, number, number, number, number] =
    sync.raw.ducrss(a, b);
  const cross: Promise<[number, number, number, number, number, number]> =
    async.raw.dvcrss(a, b);
  const dot: number = sync.raw.dvdot(a, b);
  const unit: Promise<[number, number, number, number, number, number]> =
    async.raw.dvhat(a);
  const norm: number = sync.raw.dvnorm(a);
  const separation: Promise<number> = async.raw.dvsep(a, b);
  void [unitCross, cross, dot, unit, norm, separation];
}

/** Check readonly polynomial inputs and every result field without DOM types. */
export async function polynomialConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const coefficients = Object.freeze([1, 2, 3]);
  const transform = Object.freeze([0, 2] as const);
  const derivatives: number[] = spice.raw.chbder(coefficients, transform, 1, 4);
  const integral: { p: number; itgrlp: number } = spice.raw.chbigr(
    coefficients,
    transform,
    1,
  );
  const derivative: { p: number; dpdx: number } = spice.raw.chbint(
    coefficients,
    transform,
    1,
  );
  const value: number = spice.raw.chbval(coefficients, transform, 1);
  const ordinary: number[] = spice.raw.polyds(coefficients, 4, 1);
  const roots: { root1: [number, number]; root2: [number, number] } =
    spice.raw.rquad(1, 2, 3);
  const asyncDerivatives: number[] = await asyncSpice.raw.chbder(
    coefficients,
    transform,
    1,
    4,
  );
  const asyncIntegral: { p: number; itgrlp: number } =
    await asyncSpice.raw.chbigr(coefficients, transform, 1);
  const asyncDerivative: { p: number; dpdx: number } =
    await asyncSpice.raw.chbint(coefficients, transform, 1);
  const asyncValue: number = await asyncSpice.raw.chbval(
    coefficients,
    transform,
    1,
  );
  const asyncOrdinary: number[] = await asyncSpice.raw.polyds(
    coefficients,
    4,
    1,
  );
  const asyncRoots: { root1: [number, number]; root2: [number, number] } =
    await asyncSpice.raw.rquad(1, 2, 3);
  void [
    derivatives,
    integral,
    derivative,
    value,
    ordinary,
    roots,
    asyncDerivatives,
    asyncIntegral,
    asyncDerivative,
    asyncValue,
    asyncOrdinary,
    asyncRoots,
  ];
}

/** Check readonly interpolation inputs and result fields without DOM types. */
export async function interpolationConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const x = Object.freeze([0, 1, 2]);
  const y = Object.freeze([0, 1, 4]);
  const pairs = Object.freeze([0, 0, 1, 2, 4, 4]);
  const equallySpacedHermite: { f: number; df: number } = spice.raw.hrmesp(
    0,
    1,
    pairs,
    0.5,
  );
  const hermite: { f: number; df: number } = spice.raw.hrmint(x, pairs, 0.5);
  const equallySpacedLagrange: number = spice.raw.lgresp(0, 1, y, 0.5);
  const derivative: { p: number; dp: number } = spice.raw.lgrind(x, y, 0.5);
  const lagrange: number = spice.raw.lgrint(x, y, 0.5);
  const midpoint: number[] = spice.raw.qderiv(x, y, 0.5);
  const asyncEquallySpacedHermite: { f: number; df: number } =
    await asyncSpice.raw.hrmesp(0, 1, pairs, 0.5);
  const asyncHermite: { f: number; df: number } = await asyncSpice.raw.hrmint(
    x,
    pairs,
    0.5,
  );
  const asyncEquallySpacedLagrange: number = await asyncSpice.raw.lgresp(
    0,
    1,
    y,
    0.5,
  );
  const asyncDerivative: { p: number; dp: number } =
    await asyncSpice.raw.lgrind(x, y, 0.5);
  const asyncLagrange: number = await asyncSpice.raw.lgrint(x, y, 0.5);
  const asyncMidpoint: number[] = await asyncSpice.raw.qderiv(x, y, 0.5);
  void [
    equallySpacedHermite,
    hermite,
    equallySpacedLagrange,
    derivative,
    lagrange,
    midpoint,
    asyncEquallySpacedHermite,
    asyncHermite,
    asyncEquallySpacedLagrange,
    asyncDerivative,
    asyncLagrange,
    asyncMidpoint,
  ];
}

/** Exercise owned array-storage results on the sync and async public surfaces without DOM types. */
export async function arrayStorageConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const input = Object.freeze([0, 17, 251]);
  const sync: number[][] = [
    spice.raw.clearc(1, 2, input),
    spice.raw.cleard(1, input),
    spice.raw.cleari(2, input),
    spice.raw.filld(-0.5, 2, input),
    spice.raw.filli(-7, 1, input),
    spice.raw.moved(input, 2, input),
  ];
  const asyncResults: number[][] = await Promise.all([
    asyncSpice.raw.clearc(1, 2, input),
    asyncSpice.raw.cleard(1, input),
    asyncSpice.raw.cleari(2, input),
    asyncSpice.raw.filld(-0.5, 2, input),
    asyncSpice.raw.filli(-7, 1, input),
    asyncSpice.raw.moved(input, 2, input),
  ]);
  void [sync, asyncResults];
}

/** Verify fixed-matrix APIs preserve readonly layouts and sync/async results without DOM types. */
export function fixedMatrixTypes(sync: Spice, async: SpiceAsync): void {
  const m = sync.raw.ident();
  const det: number = sync.raw.det(m);
  const trace: Promise<number> = async.raw.trace(m);
  const rotation: boolean = sync.raw.isrot(m, 0, 0);
  const inverse: typeof m = sync.raw.invert(m);
  const scaledTranspose: Promise<typeof m> = async.raw.invort(m);
  const copy: typeof m = sync.raw.mequ(m);
  const leftTranspose: typeof m = sync.raw.mtxm(m, m);
  const rightTranspose: Promise<typeof m> = async.raw.mxmt(m, m);
  const transpose: typeof m = sync.raw.xpose(m);
  const input2 = [27, 5, 5, 3] as const;
  const eigensystem: {
    diag: [number, number, number, number];
    rotate: [number, number, number, number];
  } = sync.raw.diags2(input2);
  const asyncEigensystem: Promise<typeof eigensystem> =
    async.raw.diags2(input2);
  void [
    det,
    trace,
    rotation,
    inverse,
    scaledTranspose,
    copy,
    leftTranspose,
    rightTranspose,
    transpose,
    eigensystem,
    asyncEigensystem,
  ];
}

/** Verify general-vector methods accept readonly arrays and preserve sync/async results without DOM types. */
export function generalVectorTypes(sync: Spice, async: SpiceAsync): void {
  const a = [1, -2, 3, -4, 5] as const;
  const b: readonly number[] = [2, 3, 4, 5, 6];
  const sum: number[] = sync.raw.vaddg(a, b);
  const distance: Promise<number> = async.raw.vdistg(a, b);
  const dot: number = sync.raw.vdotg(a, b);
  const copy: Promise<number[]> = async.raw.vequg(a);
  const normalized: number[] = sync.raw.vhatg(a);
  const combination: Promise<number[]> = async.raw.vlcomg(2, a, -3, b);
  const negative: number[] = sync.raw.vminug(a);
  const norm: Promise<number> = async.raw.vnormg(a);
  const projection: number[] = sync.raw.vprojg(a, b);
  const relative: Promise<number> = async.raw.vrelg(a, b);
  const scaled: number[] = sync.raw.vsclg(2, a);
  const separation: Promise<number> = async.raw.vsepg(a, b);
  const difference: number[] = sync.raw.vsubg(a, b);
  const zero: Promise<boolean> = async.raw.vzerog(a);
  const unitAndNorm: { unit: number[]; norm: number } = sync.raw.unormg(a);
  void [
    sum,
    distance,
    dot,
    copy,
    normalized,
    combination,
    negative,
    norm,
    projection,
    relative,
    scaled,
    separation,
    difference,
    zero,
    unitAndNorm,
  ];
}

function generalMatrices(
  raw: Awaited<ReturnType<typeof spiceClients.toSync>>["spice"]["raw"],
) {
  const matrix = [1, 2, 3, 4, 5, 6] as const,
    vector = [2, 1] as const;
  const copy: number[] = raw.mequg(matrix, 2, 3);
  const transposed = raw.xposeg(copy, 2, 3);
  const mv = raw.mtxvg(matrix, vector, 3, 2);
  const product = raw.mxmg(matrix, transposed, 2, 3, 2);
  return [
    raw.mxmtg(matrix, matrix, 2, 3, 2),
    raw.mtxmg(matrix, matrix, 3, 2, 3),
    raw.mxvg(product, vector, 2, 2),
    raw.vtmvg(vector, matrix, mv, 2, 3),
  ];
}
void generalMatrices;

async function frameAlgebra(spice: Spice, asyncSpice: SpiceAsync) {
  const x = [1, 0, 0] as const,
    y = [0, 1, 0] as const;
  const ax = [1, 0, 0, 0, 0.25, 0] as const,
    pl = [0, 1, 0, -0.25, 0, 0] as const;
  const triad = spice.raw.frame(x);
  const rot = spice.raw.twovec(triad.x, 1, y, 2);
  const dynamic = await asyncSpice.raw.twovxf(ax, 1, pl, 2);
  const recovered = spice.raw.xf2eul(dynamic, 3, 1, 3);
  const { av } = await asyncSpice.raw.xf2rav(dynamic);
  const state = spice.raw.rav2xf(rot, av);
  const inverse = await asyncSpice.raw.invstm(state);
  return [
    spice.raw.xpose6(inverse),
    spice.raw.eul2xf(recovered.eulang, 3, 1, 3),
    recovered.unique,
  ];
}
void frameAlgebra;

/** Check sync and async coordinate Jacobians against the branded matrix result without DOM types. */
export function coordinateJacobianTypes(sync: Spice, async: SpiceAsync): void {
  type Jacobian = ReturnType<Spice["raw"]["ident"]>;
  const dazldr: Jacobian = sync.raw.dazldr(3, 4, -2, true, false);
  const dcyldr: Promise<Jacobian> = async.raw.dcyldr(3, 4, -2);
  const dgeodr: Jacobian = sync.raw.dgeodr(3, 4, -2, 3, 0.125);
  const dlatdr: Promise<Jacobian> = async.raw.dlatdr(3, 4, -2);
  const dpgrdr: Jacobian = sync.raw.dpgrdr("Earth", 3, 4, -2, 3, 0.125);
  const drdazl: Promise<Jacobian> = async.raw.drdazl(5, 0.7, -0.4, true, false);
  const drdcyl: Jacobian = sync.raw.drdcyl(5, 0.7, -2);
  const drdgeo: Promise<Jacobian> = async.raw.drdgeo(0.7, -0.4, 2, 3, 0.125);
  const drdlat: Jacobian = sync.raw.drdlat(5, 0.7, -0.4);
  const drdpgr: Promise<Jacobian> = async.raw.drdpgr(
    "Earth",
    0.7,
    -0.4,
    2,
    3,
    0.125,
  );
  const drdsph: Jacobian = sync.raw.drdsph(5, 1.1, 0.7);
  const dsphdr: Promise<Jacobian> = async.raw.dsphdr(3, 4, -2);
  void [
    dazldr,
    dcyldr,
    dgeodr,
    dlatdr,
    dpgrdr,
    drdazl,
    drdcyl,
    drdgeo,
    drdlat,
    drdpgr,
    drdsph,
    dsphdr,
  ];
}

/** Check raw CSPICE string methods and byte-capacity overloads in a consumer without DOM types. */
export async function stringConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const compress: string = spice.raw.cmprss(" ", 1, " a  B ");
  const equal: boolean = spice.raw.eqstr("a b", "AB");
  const whitespace: boolean = spice.raw.iswhsp("\t");
  const last: number = spice.raw.lastnb("é ");
  const lower: string = spice.raw.lcase("ABC", 3);
  const upper: string = spice.raw.ucase("abc");
  const insensitive: boolean = spice.raw.matchi("ABC", "a*", "*", "?");
  const sensitive: boolean = spice.raw.matchw("ABC", "A?C", "*", "?");
  const asyncCompress: string = await asyncSpice.raw.cmprss(" ", 2, "a  b", 5);
  const asyncEqual: boolean = await asyncSpice.raw.eqstr("ab", "AB");
  const asyncWhitespace: boolean = await asyncSpice.raw.iswhsp("");
  const asyncLast: number = await asyncSpice.raw.lastnb("");
  const asyncLower: string = await asyncSpice.raw.lcase("ABC");
  const asyncUpper: string = await asyncSpice.raw.ucase("abc", 2);
  const asyncInsensitive: boolean = await asyncSpice.raw.matchi(
    "ABC",
    "a*",
    "*",
    "?",
  );
  const asyncSensitive: boolean = await asyncSpice.raw.matchw(
    "ABC",
    "A?C",
    "*",
    "?",
  );
  void [
    compress,
    equal,
    whitespace,
    last,
    lower,
    upper,
    insensitive,
    sensitive,
    asyncCompress,
    asyncEqual,
    asyncWhitespace,
    asyncLast,
    asyncLower,
    asyncUpper,
    asyncInsensitive,
    asyncSensitive,
  ];
}

/** Check UTF-8 search positions and readonly search arrays for sync and async callers. */
export async function searchConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const values: readonly string[] = ["Earth", "Moon"];
  const indices: number[] = [
    spice.raw.cpos("Earth", "r", 0),
    spice.raw.cposr("Earth", "t", 4),
    spice.raw.ncpos("Earth", "a", 0),
    spice.raw.ncposr("Earth", "h", 4),
    spice.raw.pos("Earth", "ar", 0),
    spice.raw.posr("Earth", "th", 4),
    spice.raw.esrchc("moon", values),
    await asyncSpice.raw.cpos("Earth", "r", 0),
    await asyncSpice.raw.cposr("Earth", "t", 4),
    await asyncSpice.raw.ncpos("Earth", "a", 0),
    await asyncSpice.raw.ncposr("Earth", "h", 4),
    await asyncSpice.raw.pos("Earth", "ar", 0),
    await asyncSpice.raw.posr("Earth", "th", 4),
    await asyncSpice.raw.esrchc("moon", values),
  ];
  void indices;
}

/** Check the six readonly sorted-bound operations on both public facades without DOM types. */
export async function sortedBoundsConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const strings = Object.freeze(["", "A", "A "]);
  const numbers = Object.freeze([-1, 0, 1]);
  const sync: number[] = [
    spice.raw.lstlec("A", strings),
    spice.raw.lstltc("A", strings),
    spice.raw.lstled(0, numbers),
    spice.raw.lstltd(0, numbers),
    spice.raw.lstlei(0, numbers),
    spice.raw.lstlti(0, numbers),
  ];
  const asyncResults: number[] = await Promise.all([
    asyncSpice.raw.lstlec("A", strings),
    asyncSpice.raw.lstltc("A", strings),
    asyncSpice.raw.lstled(0, numbers),
    asyncSpice.raw.lstltd(0, numbers),
    asyncSpice.raw.lstlei(0, numbers),
    asyncSpice.raw.lstlti(0, numbers),
  ]);
  void [sync, asyncResults];
}

/** Check the readonly array-search signatures on the synchronous and transported facades. */
export async function arraySearchConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const strings = Object.freeze(["A", "B"]);
  const numbers = Object.freeze([1, 2]);
  const order = Object.freeze([0, 1]);
  const sync: number[] = [
    spice.raw.bschoc("B", strings, order),
    spice.raw.bschoi(2, numbers, order),
    spice.raw.bsrchc("B", strings),
    spice.raw.bsrchd(2, numbers),
    spice.raw.bsrchi(2, numbers),
    spice.raw.isrchc("B", strings),
    spice.raw.isrchd(2, numbers),
    spice.raw.isrchi(2, numbers),
  ];
  const asyncResults: number[] = await Promise.all([
    asyncSpice.raw.bschoc("B", strings, order),
    asyncSpice.raw.bschoi(2, numbers, order),
    asyncSpice.raw.bsrchc("B", strings),
    asyncSpice.raw.bsrchd(2, numbers),
    asyncSpice.raw.bsrchi(2, numbers),
    asyncSpice.raw.isrchc("B", strings),
    asyncSpice.raw.isrchd(2, numbers),
    asyncSpice.raw.isrchi(2, numbers),
  ]);
  void [sync, asyncResults];
}

/** Check the kernel pool’s owned values, found text, direct load and control methods on both facades. */
export async function kernelPoolConsumer(
  spice: Spice,
  client: SpiceAsync,
  lines: readonly string[],
): Promise<void> {
  spice.raw.lmpool(lines);
  spice.raw.ldpool({ path: "pool.tpc", bytes: new Uint8Array() });
  const bad: boolean = spice.raw.badkpv(
    "consumer",
    "BODY399_X",
    "=",
    1,
    1,
    "N",
  );
  const body = spice.raw.bodvcd(399, "X", 1);
  const named = await client.raw.bodvrd("earth", "X", 1);
  const text = await client.raw.stpool("TEXT", 0, "//", 16);
  const limit = spice.raw.szpool("MAXVAL");
  const size: number = text.found ? text.size : 0;
  const output: string = text.found ? text.nthstr : "";
  await client.raw.dvpool("BODY399_X");
  await client.raw.clpool();
  void [bad, body.dim, named.values, limit.found && limit.n, size, output];
}

/** Check all numeric string results through the public synchronous and asynchronous contracts. */
export async function stringNumberConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const { hxstr, hxssiz } = spice.raw.dp2hx(1.5);
  const parsed = await asyncSpice.raw.hx2dp(hxstr, 80);
  const message: string = parsed.errmsg;
  const value: number = parsed.error ? 0 : parsed.number;
  spice.raw.prsdp("PI");
  await asyncSpice.raw.prsint("1.5");
  spice.raw.repmc("#", "#", "x");
  spice.raw.repmct("#", "#", 2, "L");
  spice.raw.repmd("#", "#", 2, 4);
  await asyncSpice.raw.repmf("#", "#", 2, 4, "F");
  spice.raw.repmi("#", "#", -1);
  spice.raw.repml("#", "#", true, "C");
  spice.raw.repmot("#", "#", 3, "U");
  void [hxssiz, message, value];
}

/** Exercise caller-owned window handles, mutation, predicates and summary fields on both facades. */
export async function windowAlgebraConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  {
    const a = spice.kit.newWindow(4);
    const b = spice.kit.newWindow(4);
    const result = spice.kit.newWindow(8);
    try {
      spice.raw.wncomd(0, 1, a, result);
      spice.raw.wncond(0, 1, a);
      spice.raw.wndifd(a, b, result);
      const wnelmd: boolean = spice.raw.wnelmd(0, a);
      spice.raw.wnexpd(0, 1, a);
      spice.raw.wnextd("L", a);
      spice.raw.wnfild(0, a);
      spice.raw.wnfltd(0, a);
      const wnincd: boolean = spice.raw.wnincd(0, 1, a);
      spice.raw.wnintd(a, b, result);
      const wnreld: boolean = spice.raw.wnreld(a, "<=", b);
      const summary = spice.raw.wnsumd(a);
      spice.raw.wnunid(a, b, result);
      const measures: number[] = [
        summary.meas,
        summary.avg,
        summary.stddev,
        summary.shortest,
        summary.longest,
      ];
      void [wnincd, wnelmd, wnreld, measures];
    } finally {
      spice.kit.freeWindow(result);
      spice.kit.freeWindow(b);
      spice.kit.freeWindow(a);
    }
  }
  {
    const a = await asyncSpice.kit.newWindow(4);
    const b = await asyncSpice.kit.newWindow(4);
    const result = await asyncSpice.kit.newWindow(8);
    try {
      await asyncSpice.raw.wncomd(0, 1, a, result);
      await asyncSpice.raw.wncond(0, 1, a);
      await asyncSpice.raw.wndifd(a, b, result);
      const wnelmd: boolean = await asyncSpice.raw.wnelmd(0, a);
      await asyncSpice.raw.wnexpd(0, 1, a);
      await asyncSpice.raw.wnextd("L", a);
      await asyncSpice.raw.wnfild(0, a);
      await asyncSpice.raw.wnfltd(0, a);
      const wnincd: boolean = await asyncSpice.raw.wnincd(0, 1, a);
      await asyncSpice.raw.wnintd(a, b, result);
      const wnreld: boolean = await asyncSpice.raw.wnreld(a, "<=", b);
      const summary = await asyncSpice.raw.wnsumd(a);
      await asyncSpice.raw.wnunid(a, b, result);
      const measures: number[] = [
        summary.meas,
        summary.avg,
        summary.stddev,
        summary.shortest,
        summary.longest,
      ];
      void [wnincd, wnelmd, wnreld, measures];
    } finally {
      await asyncSpice.kit.freeWindow(result);
      await asyncSpice.kit.freeWindow(b);
      await asyncSpice.kit.freeWindow(a);
    }
  }
}

/** Exercise ordinary cell mutation, same-kind copies and membership on both public facades. */
export async function cellArrayConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  {
    const c = spice.kit.newCharCell(2, 8);
    const i = spice.kit.newIntCell(2);
    const d = spice.kit.newDoubleCell(2);
    try {
      spice.raw.appndc("x", c);
      spice.raw.copy(c, c);
      const hasC: boolean = spice.raw.elemc("x", c);
      spice.raw.appndi(-2, i);
      spice.raw.copy(i, i);
      const hasI: boolean = spice.raw.elemi(-2, i);
      spice.raw.appndd(0.5, d);
      spice.raw.copy(d, d);
      const hasD: boolean = spice.raw.elemd(0.5, d);
      void [hasC, hasI, hasD];
    } finally {
      spice.kit.freeCell(d);
      spice.kit.freeCell(i);
      spice.kit.freeCell(c);
    }
  }
  {
    const c = await asyncSpice.kit.newCharCell(2, 8);
    const i = await asyncSpice.kit.newIntCell(2);
    const d = await asyncSpice.kit.newDoubleCell(2);
    try {
      await asyncSpice.raw.appndc("x", c);
      await asyncSpice.raw.copy(c, c);
      const hasC: boolean = await asyncSpice.raw.elemc("x", c);
      await asyncSpice.raw.appndi(-2, i);
      await asyncSpice.raw.copy(i, i);
      const hasI: boolean = await asyncSpice.raw.elemi(-2, i);
      await asyncSpice.raw.appndd(0.5, d);
      await asyncSpice.raw.copy(d, d);
      const hasD: boolean = await asyncSpice.raw.elemd(0.5, d);
      void [hasC, hasI, hasD];
    } finally {
      await asyncSpice.kit.freeCell(d);
      await asyncSpice.kit.freeCell(i);
      await asyncSpice.kit.freeCell(c);
    }
  }
}

/** Static contract coverage through public sync/async clients in a DOM-free project. */
export async function setAlgebraConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  {
    const a = spice.kit.newIntCell(4);
    const b = spice.kit.newIntCell(4);
    const out = spice.kit.newIntCell(8);
    const d = spice.kit.newDoubleCell(4);
    const c = spice.kit.newCharCell(4, 12);
    try {
      spice.raw.diff(a, b, out);
      spice.raw.inter(a, b, out);
      spice.raw.sdiff(a, b, out);
      spice.raw.union(a, b, out);
      const related: boolean = spice.raw.set(a, "=", b);
      spice.raw.removc("x", c);
      spice.raw.removd(0.5, d);
      spice.raw.removi(2, a);
      const ordc: number = spice.raw.ordc("x", c);
      const ordd: number = spice.raw.ordd(0.5, d);
      const ordi: number = spice.raw.ordi(2, a);
      void [related, ordc, ordd, ordi];
    } finally {
      spice.kit.freeCell(c);
      spice.kit.freeCell(d);
      spice.kit.freeCell(out);
      spice.kit.freeCell(b);
      spice.kit.freeCell(a);
    }
  }
  {
    const a = await asyncSpice.kit.newIntCell(4);
    const b = await asyncSpice.kit.newIntCell(4);
    const out = await asyncSpice.kit.newIntCell(8);
    const d = await asyncSpice.kit.newDoubleCell(4);
    const c = await asyncSpice.kit.newCharCell(4, 12);
    try {
      await asyncSpice.raw.diff(a, b, out);
      await asyncSpice.raw.inter(a, b, out);
      await asyncSpice.raw.sdiff(a, b, out);
      await asyncSpice.raw.union(a, b, out);
      const related: boolean = await asyncSpice.raw.set(a, "=", b);
      await asyncSpice.raw.removc("x", c);
      await asyncSpice.raw.removd(0.5, d);
      await asyncSpice.raw.removi(2, a);
      const ordc: number = await asyncSpice.raw.ordc("x", c);
      const ordd: number = await asyncSpice.raw.ordd(0.5, d);
      const ordi: number = await asyncSpice.raw.ordi(2, a);
      void [related, ordc, ordd, ordi];
    } finally {
      await asyncSpice.kit.freeCell(c);
      await asyncSpice.kit.freeCell(d);
      await asyncSpice.kit.freeCell(out);
      await asyncSpice.kit.freeCell(b);
      await asyncSpice.kit.freeCell(a);
    }
  }
}

/** Ordering returns owned indices or typed values on both the sync and transported raw API. */
export async function orderConsumer(
  spice: Spice,
  remote: SpiceAsync,
): Promise<void> {
  const rows = ["b", "a"] as const,
    ints = [2, 1] as const;
  const order: number[] = spice.raw.orderc(rows);
  const valid: boolean = spice.raw.isordv(order);
  const texts: string[] = spice.raw.reordc(order, rows);
  const logicals: boolean[] = spice.raw.reordl(order, [true, false] as const);
  const integers: number[] = spice.raw.reordi(spice.raw.orderi(ints), ints);
  const doubles: number[] = await remote.raw.reordd(
    await remote.raw.orderd(ints),
    ints,
  );
  const sortedTexts: string[] = await remote.raw.shellc(rows);
  const sortedIntegers: number[] = spice.raw.shelli(ints);
  const sortedDoubles: number[] = spice.raw.shelld(ints);
  void [
    valid,
    texts,
    logicals,
    integers,
    doubles,
    sortedTexts,
    sortedIntegers,
    sortedDoubles,
  ];
}

/** Token results retain byte offsets in both local and transported public declarations. */
export async function tokenConsumer(
  spice: Spice,
  remote: SpiceAsync,
): Promise<void> {
  const next: { next: string; rest: string } = spice.raw.nextwd(" alpha beta");
  const nth: { word: string; loc: number } = await remote.raw.nthwd(
    "α beta",
    1,
    4,
  );
  const single: { n: number; items: string[] } = spice.raw.lparse(
    "a,b",
    ",",
    4,
  );
  const multiple: { n: number; items: string[] } = await remote.raw.lparsm(
    "a;b c",
    "; ",
    4,
    3,
  );
  const spans: { last: number; nchar: number }[] = [
    spice.raw.lx4dec(".25", 0),
    await remote.raw.lx4num("1E+3", 0),
    spice.raw.lx4sgn("-3", 0),
    await remote.raw.lx4uns("27", 0),
    spice.raw.lxqstr("'q'", "'", 0),
  ];
  void [next, nth, single, multiple, spans];
}

async function charSetParser(spice: Spice, worker: SpiceAsync): Promise<void> {
  const output = spice.kit.newCharCell(4, 16);
  try {
    spice.raw.lparss("blue,red,blue", ",", output);
  } finally {
    spice.kit.freeCell(output);
  }
  const remote = await worker.kit.newCharCell(4, 16);
  try {
    await worker.raw.lparss("blue,red,blue", ",", remote);
  } finally {
    await worker.kit.freeCell(remote);
  }
}
void charSetParser;

async function surfaceTranslations() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const text: string = spice.raw.srfc2s(-3, 399).surface;
    const flag: boolean = spice.raw.srfcss(-3, "EARTH").isName;
    const result = spice.raw.srfscc(text, 399);
    if (result.found) spice.raw.srfs2c(String(result.code), "EARTH");
    return flag;
  } finally {
    await dispose();
  }
}
void surfaceTranslations;

/** Check raw clock tick, string and owned partition outputs on both public facades without DOM types. */
export async function clockDetailConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const ticks: number = spice.raw.sce2t(-123, 0);
  const text: string = spice.raw.scfmt(-123, ticks);
  const rawTicks: number = spice.raw.sctiks(-123, text);
  const partitions: { pstart: number[]; pstop: number[] } =
    spice.raw.scpart(-123);
  const asyncTicks: number = await asyncSpice.raw.sce2t(-123, 0);
  const asyncText: string = await asyncSpice.raw.scfmt(-123, asyncTicks, 37);
  const asyncRawTicks: number = await asyncSpice.raw.sctiks(-123, asyncText);
  const asyncPartitions: { pstart: number[]; pstop: number[] } =
    await asyncSpice.raw.scpart(-123);
  void [rawTicks, partitions, asyncRawTicks, asyncPartitions];
}

/** Compile the six raw frame signatures and their owned fixed-length results without DOM declarations. */
export async function typecheckFrameMetadata() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" }),
    { raw, kit } = spice;
  const ids = kit.newIntCell(145);
  try {
    raw.bltfrm(1, ids);
    const rotations = [
      raw.pxfrm2("J2000", "B1950", 0, 1),
      raw.tipbod("J2000", 399, 0),
    ];
    const fixed = raw.tkfram(1800201);
    if (fixed.found) rotations.push(fixed.rot);
    const state = [1, 2, 3, 4, 5, 6] as const;
    return [
      rotations,
      raw.tisbod("J2000", 399, 0),
      raw.xfmsta(state, "RECTANGULAR", "CYLINDRICAL", " "),
    ];
  } finally {
    kit.freeCell(ids);
    await dispose();
  }
}

import type { SpiceSync } from "@rybosome/tspice";

function localClock(spice: SpiceSync, utc: string): string {
  spice.raw.tparch("YES");
  spice.raw.tsetyr(1969);
  const epoch = spice.raw.utc2et(utc);
  const calendar: string = spice.raw.etcal(epoch, 181);
  const { hr, mn, sc, time, ampm } = spice.raw.et2lst(
    epoch,
    10,
    0,
    "PLANETOCENTRIC",
  );
  return `${calendar} ${hr} ${mn} ${sc} ${time} ${ampm}`;
}
void localClock;

function inspectDaf(spice: SpiceSync, path: string): Uint8Array | undefined {
  const handle = spice.raw.dafopw(path);
  try {
    const bytes = spice.raw.dafps(1, 1, [1] as const, [-3] as const);
    const components = spice.raw.dafus(bytes, 1, 1);
    const record = spice.raw.dafrfr(handle);
    const summary = spice.raw.dafgsr(handle, record.fward, 1, 128);
    const physical: Uint8Array = spice.raw.dafrda(handle, 1, 1);
    const numeric: number[] = spice.raw.dafgda(
      handle,
      record.free,
      record.free,
    );
    if (summary.found) {
      const data: Uint8Array = summary.data;
      void data;
    }
    void [components.dc, components.ic, physical, numeric];
    spice.raw.dafbbs(handle);
    spice.raw.dafcs(handle);
    if (!spice.raw.daffpa(handle)) return undefined;
    const current = spice.raw.dafgh();
    const name: string = spice.raw.dafgn(current);
    const { nd, ni } = spice.raw.dafhsf(current);
    void [name, nd, ni];
    const summaryBytes = spice.raw.dafgs(current);
    spice.raw.dafrs(current, summaryBytes);
    spice.raw.dafac(handle, ["  first", ""] as const);
    const page: { n: number; lines: string[]; done: boolean } = spice.raw.dafec(
      handle,
      2,
    );
    if (page.done) spice.raw.dafdc(handle);
    return summaryBytes;
  } finally {
    spice.raw.dafcls(handle);
  }
}
void inspectDaf;

/** Check DAS metadata, string widths, virtual outputs and opaque token signatures without DOM types. */
export async function typecheckDasLifecycle() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" }),
    { raw, kit } = spice;
  const output = { kind: "virtual-output", path: "c04.das" } as const;
  try {
    const h = raw.dasonw(output, "Test", "name", 0);
    let name: string;
    try {
      name = raw.dashfn(h, 32);
      raw.daswbr(h);
    } finally {
      raw.dasllc(h);
    }
    const w = raw.dasopw(output);
    try {
      const { lastla } = raw.dashfs(w);
      const [character, double, integer] = lastla;
      void [character, double, integer];
    } finally {
      raw.dascls(w);
    }
    const scratch = raw.dasops();
    try {
      raw.dasac(scratch, [" two  words", ""]);
      const { n, lines, done } = raw.dasec(scratch, 2, 30);
      const page: [number, string[], boolean] = [n, lines, done];
      void page;
      raw.dasdc(scratch);

      return {
        name,
        bytes: kit.readVirtualOutput(output),
        addresses: raw.daslla(scratch),
        record: raw.dasrfr(scratch, 9, 61),
      };
    } finally {
      raw.dascls(scratch);
    }
  } finally {
    await dispose();
  }
}

/** Exercise owned binary row and numeric DAS data shapes without DOM types. */
export async function typecheckDasData() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = raw.dasops();
    try {
      const bytes = new Uint8Array([0, 255]);
      const words = [2, -1] as const;
      raw.dasadc(h, 2, 0, 1, 2, bytes);
      raw.dasadd(h, 2, words);
      raw.dasadi(h, 2, words);
      raw.dasudc(h, 1, 2, 0, 1, 2, bytes);
      raw.dasudd(h, 1, 2, words);
      raw.dasudi(h, 1, 2, words);
      const chars: Uint8Array = raw.dasrdc(h, 1, 2, 0, 1, 2, bytes);
      return {
        chars,
        doubles: raw.dasrdd(h, 1, 2),
        integers: raw.dasrdi(h, 1, 2),
      };
    } finally {
      raw.dascls(h);
    }
  } finally {
    await dispose();
  }
}

/** Build and walk a DLA segment using the normal facade without DOM declarations. */
export async function typecheckDlaSegments() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const handle = raw.dlaopn("segments.dla", "DLA", "generic data", 0);
    try {
      raw.dlabns(handle);
      raw.dasadi(handle, 2, [10, 20]);
      raw.dlaens(handle);
      const tail = raw.dlabbs(handle);
      return tail.found ? raw.dlafps(handle, tail.descr) : tail;
    } finally {
      raw.dascls(handle);
    }
  } finally {
    await dispose();
  }
}

/** Author and reopen a binary PCK through typed owned file, set and window handles. */
export function binaryPckConsumer(
  spice: Spice,
  coefficients: readonly number[],
): void {
  const file = { kind: "virtual-output", path: "orientation.bpc" } as const;
  const writer = spice.raw.pckopn(file, "ORIENTATION", 0);
  spice.raw.pckw02(
    writer,
    3000,
    "J2000",
    0,
    10,
    "ONE",
    10,
    1,
    1,
    coefficients,
    0,
  );
  spice.raw.pckcls(writer);
  const ids = spice.kit.newIntCell(4),
    coverage = spice.kit.newWindow(4);
  try {
    spice.raw.pckfrm(file, ids);
    spice.raw.pckcov(file, 3000, coverage);
    const loaded = spice.raw.pcklof(file);
    spice.raw.pckuof(loaded);
  } finally {
    spice.kit.freeCell(ids);
    spice.kit.freeWindow(coverage);
  }
}

/** Compile the binary CK writer contract with readonly samples and an owned virtual output. */
export function ckWriterConsumer(
  spice: Spice,
  ticks: readonly number[],
  quats: readonly number[],
  av: readonly number[],
): void {
  const file = { kind: "virtual-output", path: "attitude.bc" } as const;
  const w = spice.raw.ckopn(file, "EXAMPLE", 0);
  spice.raw.ckw01(w, 1, 2, -123000, "J2000", true, "ONE", ticks, quats, av);
  spice.raw.ckw02(
    w,
    1,
    2,
    -123000,
    "J2000",
    "TWO",
    [1],
    [2],
    [1, 0, 0, 0],
    [0, 0, 0.1],
    [0.5],
  );
  spice.raw.ckw03(
    w,
    1,
    2,
    -123000,
    "J2000",
    true,
    "THREE",
    ticks,
    quats,
    av,
    [1],
  );
  spice.raw.ckw05(
    w,
    1,
    1,
    1,
    2,
    -123000,
    "J2000",
    true,
    "FIVE",
    ticks,
    quats,
    0.5,
    [1],
  );
  spice.raw.ckcls(w);
}

/** Typecheck the owned scratch writer, inferred schema and zero-based record operations without DOM types. */
export async function typecheckEkRecords() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = raw.ekops();
    try {
      const s: number = raw.ekbseg(
        h,
        "RECORDS",
        ["ID"] as const,
        ["DATATYPE=INTEGER"] as const,
      );
      const row: number = raw.ekappr(h, s);
      raw.ekinsr(h, s, row);
      raw.ekdelr(h, s, row);
      raw.ekdelr(h, s, row);
      return s;
    } finally {
      raw.ekcls(h);
    }
  } finally {
    await dispose();
  }
}

/** Exercise ownership, typed entries and null cardinality through the public surface. */
export async function typecheckEkRecordEntries() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const handle = raw.ekops();
    try {
      const s = raw.ekbseg(
        handle,
        "SIGNALS",
        ["NAME", "VALUE", "ID"],
        [
          "DATATYPE=CHARACTER*(9)",
          "DATATYPE=DOUBLE PRECISION",
          "DATATYPE=INTEGER",
        ],
      );
      const r = raw.ekappr(handle, s);
      raw.ekacec(handle, s, r, "NAME", ["A"] as const, false);
      raw.ekaced(handle, s, r, "VALUE", [0.5], false);
      raw.ekacei(handle, s, r, "ID", [3], false);
      raw.ekucec(handle, s, r, "NAME", ["B"], false);
      raw.ekuced(handle, s, r, "VALUE", [-1.25], false);
      raw.ekucei(handle, s, r, "ID", [5], false);
      const name: string[] = raw.ekrcec(handle, s, r, "NAME", 10).values;
      const d: number[] = raw.ekrced(handle, s, r, "VALUE").values;
      const i: number[] = raw.ekrcei(handle, s, r, "ID").values;
      return { name, d, i };
    } finally {
      raw.ekcls(handle);
    }
  } finally {
    await dispose();
  }
}

function readCkRecords(
  spice: SpiceSync,
  path: string,
  inst: number,
  et: number,
) {
  const h = spice.raw.dafopr(path);
  try {
    spice.raw.dafbfs(h);
    if (!spice.raw.daffna(h)) return;
    const d = spice.raw.dafgs(h);
    const type = spice.raw.dafus(d, 2, 6).ic[2];
    if (type === 2) {
      spice.raw.cknr02(h, d);
      const rate: number = spice.raw.ckgr02(h, d, 1).rate;
      void rate;
    }
    if (type === 3) {
      spice.raw.cknr03(h, d);
      const av: [number, number, number] | null = spice.raw.ckgr03(h, d, 1).av;
      void av;
    }
    spice.raw.ckmeta(inst, "SCLK");
    const r = spice.raw.ckfrot(inst, et),
      x = spice.raw.ckfxfm(inst, et);
    if (r.found && x.found) return [r.rotate[8], x.xform[35], r.ref, x.ref];
  } finally {
    spice.raw.dafcls(h);
  }
}
void readCkRecords;

/** Complete EK query and physical metadata through the typed public facade. */
export async function typecheckEkMetadata(path: string) {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = raw.eklef(path);
    try {
      const summary = raw.ekssum(h, 0),
        table = summary.tabnam;
      const n = raw.ekccnt(table),
        { column, attdsc } = raw.ekcii(table, 0);
      const query = "SELECT " + column + " FROM " + table;
      const select = raw.ekpsel(query),
        found = raw.ekfind(query);
      return {
        n,
        summary,
        attdsc,
        select,
        count: found.ok && found.nmrows ? raw.eknelt(0, 0) : 0,
      };
    } finally {
      raw.ekuef(h);
    }
  } finally {
    await dispose();
  }
}

async function textCommandConsumer() {
  const client = await spiceClients.toSync({ backend: "wasm" });
  try {
    const { line, eof } = client.spice.raw.rdtext(
      { path: "words.txt", bytes: new Uint8Array([65, 10]) },
      8,
    );
    const saved: void = client.spice.raw.putcml(["program", line]);
    return { line, eof, saved };
  } finally {
    await client.dispose();
  }
}
void textCommandConsumer;

async function observeTrace() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    raw.setmsg("value @ # !");
    raw.errch("@", "text");
    raw.errint("#", -2);
    raw.errdp("!", 0.5);
    raw.chkin("frame");
    try {
      const status: boolean = raw.return();
      const depth: number = raw.trcdep();
      const name: string = raw.trcnam(0, 8);
      const trace: string = raw.qcktrc();
      return { status, depth, name, trace };
    } finally {
      raw.chkout("frame");
    }
  } finally {
    await dispose();
  }
}
void observeTrace;

async function observeErrorPolicy() {
  const sync = await spiceClients.toSync({ backend: "wasm" });
  const asyncClient = await spiceClients.toAsync({ backend: "wasm" });
  try {
    const device: string = sync.spice.raw.errdev("GET", 8);
    sync.spice.raw.errdev("SET", "NULL");
    sync.spice.raw.trcoff();
    const read: Promise<string> = asyncClient.spice.raw.errprt("GET");
    const set: Promise<void> = asyncClient.spice.raw.errdev("SET", device);
    await set;
    return await read;
  } finally {
    await sync.dispose();
    await asyncClient.dispose();
  }
}
void observeErrorPolicy;

/** Exercise the public, named element tuples and propagated states on both facades. */
export async function orbitalElementsConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const conic: Readonly<SpiceConicElements> = [1, 0, 0, 0, 0, 0, 0, 1];
  const eq: Readonly<SpiceEquinoctialElements> = [1, 0, 0, 0, 0, 0, 0, 1, 0];
  const state = spice.raw.conics(conic, 0);
  const eqState = spice.raw.eqncpv(0, 0, eq, 0, 0);
  const elements: SpiceConicElements = spice.raw.oscelt(state, 0, 1);
  const extended: SpiceExtendedConicElements = spice.raw.oscltx(eqState, 0, 1);
  const propagated = spice.raw.prop2b(1, state, 0.1);
  const asyncState = await asyncSpice.raw.conics(elements, 0);
  const asyncEq = await asyncSpice.raw.eqncpv(0, 0, eq, 0, 0);
  const asyncConic: SpiceConicElements = await asyncSpice.raw.oscelt(
    asyncEq,
    0,
    1,
  );
  const asyncExtended: SpiceExtendedConicElements = await asyncSpice.raw.oscltx(
    asyncState,
    0,
    1,
  );
  const asyncPropagated = await asyncSpice.raw.prop2b(1, asyncState, 0.1);
  void [extended, propagated, asyncConic, asyncExtended, asyncPropagated];
}
