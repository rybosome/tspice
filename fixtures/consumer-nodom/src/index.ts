import { spiceClients, type Spice, type SpiceAsync } from "@rybosome/tspice";

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

import type { Spice, SpiceAsync } from "@rybosome/tspice";

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
