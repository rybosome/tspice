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
