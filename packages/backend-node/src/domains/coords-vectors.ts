import type {
  CoordsVectorsApi,
  SpiceVector3,
  SpiceStateVector,
} from "@rybosome/tspice-backend-contract";
import {
  assertMat3ArrayLike9,
  assertSpiceInt32,
  brandMat3RowMajor,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertCoordinateNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function copyCoordinateVector(value: unknown): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(
      "reccyl(rect) must contain exactly three finite numbers",
    );
  // Validate the exact values passed to the backend, even for accessor arrays.
  const component = (i: number): number => {
    const entry: unknown = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError(`reccyl(rect[${i}]) must be a finite number`);
    return entry;
  };
  return [component(0), component(1), component(2)];
}

function coordinateOutputNumber(value: unknown, label: string): number {
  // Finite inputs can overflow a CSPICE norm. Preserve its numerical result.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function assertBasicScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyBasicVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  // The exact entries validated here are also the ones passed to the backend.
  const entry = (i: number): number => {
    const component: unknown = value[i];
    assertBasicScalar(component, `${label}[${i}]`);
    return component;
  };
  return [entry(0), entry(1), entry(2)];
}

function basicOutputNumber(value: unknown, label: string): number {
  // Preserve CSPICE's IEEE-754 overflow/NaN behavior for extreme finite inputs.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function basicOutputVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must have length three`);
  return [
    basicOutputNumber(value[0], label),
    basicOutputNumber(value[1], label),
    basicOutputNumber(value[2], label),
  ];
}

function assertCombinationScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyCombinationVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  // The exact entries validated here are also the ones passed to the backend.
  const entry = (i: number): number => {
    const component: unknown = value[i];
    assertCombinationScalar(component, `${label}[${i}]`);
    return component;
  };
  return [entry(0), entry(1), entry(2)];
}

function copyMatrixInput(value: unknown, label: string): number[] {
  // As with the structural Mat3 contract, accept numeric TypedArrays as well
  // as ordinary arrays. Read by index only; a caller iterator is not trusted.
  if (
    !(
      Array.isArray(value) ||
      value instanceof Float64Array ||
      value instanceof Float32Array ||
      value instanceof Int8Array ||
      value instanceof Uint8Array ||
      value instanceof Uint8ClampedArray ||
      value instanceof Int16Array ||
      value instanceof Uint16Array ||
      value instanceof Int32Array ||
      value instanceof Uint32Array
    ) ||
    value.length !== 9
  ) {
    throw new TypeError(`${label} must contain exactly nine finite numbers`);
  }
  const copy: number[] = [];
  for (let i = 0; i < 9; i++) {
    const component: unknown = value[i];
    assertCombinationScalar(component, `${label}[${i}]`);
    copy.push(component);
  }
  return copy;
}

function combinationOutputNumber(value: unknown, label: string): number {
  // Finite inputs can produce IEEE-754 nonfinite outputs in CSPICE.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function combinationOutputVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must have length three`);
  return [
    combinationOutputNumber(value[0], label),
    combinationOutputNumber(value[1], label),
    combinationOutputNumber(value[2], label),
  ];
}

function assertConventionScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyConventionVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  // Validate the exact values passed to the backend, even for accessor arrays.
  const component = (i: number): number => {
    const entry: unknown = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError(`${label}[${i}] must be a finite number`);
    return entry;
  };
  return [component(0), component(1), component(2)];
}

function assertConventionBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== "boolean")
    throw new TypeError(`${label} must be a boolean`);
}

function assertConventionBody(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.includes("\0"))
    throw new TypeError(`${label} must be a string without embedded NUL`);
}

function conventionOutputNumber(value: unknown, label: string): number {
  // Finite CSPICE inputs can produce nonfinite results; preserve these values.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function conventionOutputVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must have length three`);
  return [
    conventionOutputNumber(value[0], label),
    conventionOutputNumber(value[1], label),
    conventionOutputNumber(value[2], label),
  ];
}

function assertScalarMathDouble(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function assertScalarMathString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.includes("\0"))
    throw new TypeError(`${label} must be a string without embedded NUL`);
}

function copyScalarMathArray(
  value: unknown,
  label: string,
  integers: boolean,
  maxCount: number,
): number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const count = value.length;
  if (!Number.isSafeInteger(count) || count < 0 || count > maxCount)
    throw new RangeError(`${label} must contain at most ${maxCount} values`);
  const copy: number[] = [];
  for (let i = 0; i < count; i++) {
    const entry: unknown = value[i];
    assertScalarMathDouble(entry, `${label}[${i}]`);
    if (integers) assertSpiceInt32(entry, `${label}[${i}]`);
    copy.push(entry);
  }
  return copy;
}

function assertSumaiPrefixes(values: readonly number[]): void {
  // Validation only: the returned sum must still come from actual sumai_c.
  // Each addition is exact here because the previous prefix and next input
  // are both signed32, so their sum fits exactly in a JavaScript number.
  let prefix = 0;
  for (const value of values) {
    prefix += value;
    if (prefix < -2147483648 || prefix > 2147483647)
      throw new RangeError(
        "sumai(values) prefix sums must fit signed 32-bit integers",
      );
  }
}

function copyStateDerivativeInput(
  value: unknown,
  label: string,
): SpiceStateVector {
  if (!Array.isArray(value) || value.length !== 6)
    throw new TypeError(`${label} must contain exactly six finite numbers`);
  // Validate the exact values passed to the backend, even for accessor arrays.
  const component = (i: number): number => {
    const entry: unknown = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError(`${label}[${i}] must be a finite number`);
    return entry;
  };
  return [
    component(0),
    component(1),
    component(2),
    component(3),
    component(4),
    component(5),
  ];
}

function stateDerivativeOutputNumber(value: unknown, label: string): number {
  // Preserve nonfinite numeric outputs produced by defined finite CSPICE inputs.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function stateDerivativeOutput(
  value: unknown,
  label: string,
): SpiceStateVector {
  if (!Array.isArray(value) || value.length !== 6)
    throw new TypeError(`${label} must be an array of length six`);
  return [
    stateDerivativeOutputNumber(value[0], `${label}[0]`),
    stateDerivativeOutputNumber(value[1], `${label}[1]`),
    stateDerivativeOutputNumber(value[2], `${label}[2]`),
    stateDerivativeOutputNumber(value[3], `${label}[3]`),
    stateDerivativeOutputNumber(value[4], `${label}[4]`),
    stateDerivativeOutputNumber(value[5], `${label}[5]`),
  ];
}

function assertPolynomialNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyPolynomialCoefficients(
  value: unknown,
  label: string,
  allowEmpty: boolean,
): number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 2147483647 ||
    (!allowEmpty && length === 0)
  )
    throw new RangeError(`${label} has an unsupported coefficient count`);
  // Coefficient getters must not be re-read during native/WASM marshaling.
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry: unknown = value[i];
    assertPolynomialNumber(entry, `${label}[${i}]`);
    result.push(entry);
  }
  return result;
}

function copyPolynomialTransform(
  value: unknown,
  label: string,
): [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`${label} must be a length-2 array`);
  const midpoint: unknown = value[0];
  const scale: unknown = value[1];
  assertPolynomialNumber(midpoint, `${label}[0]`);
  assertPolynomialNumber(scale, `${label}[1]`);
  return [midpoint, scale];
}

function polynomialDerivativeCount(nderiv: number, chebyshev: boolean): number {
  assertSpiceInt32(nderiv, "nderiv");
  if (
    (chebyshev && (nderiv < 0 || nderiv > 715827881)) ||
    (!chebyshev && nderiv > 2147483646)
  )
    throw new RangeError("nderiv exceeds the supported derivative order");
  return nderiv < 0 ? 0 : nderiv + 1;
}

function polynomialOutputNumber(value: unknown, label: string): number {
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function polynomialOutputArray(
  value: unknown,
  length: number,
  label: string,
): number[] {
  if (!Array.isArray(value) || value.length !== length)
    throw new TypeError(`${label} must be an array of length ${length}`);
  const result: number[] = [];
  for (let i = 0; i < length; i++)
    result.push(polynomialOutputNumber(value[i], `${label}[${i}]`));
  return result;
}

function polynomialOutputPair(value: unknown, label: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`${label} must be a length-2 array`);
  return [
    polynomialOutputNumber(value[0], `${label}[0]`),
    polynomialOutputNumber(value[1], `${label}[1]`),
  ];
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    pi: () => {
      const out = native.pi();
      invariant(
        Number.isFinite(out),
        "Expected pi() to return a finite number",
      );
      return out;
    },
    twopi: () => {
      const out = native.twopi();
      invariant(
        Number.isFinite(out),
        "Expected twopi() to return a finite number",
      );
      return out;
    },
    halfpi: () => {
      const out = native.halfpi();
      invariant(
        Number.isFinite(out),
        "Expected halfpi() to return a finite number",
      );
      return out;
    },
    dpr: () => {
      const out = native.dpr();
      invariant(
        Number.isFinite(out),
        "Expected dpr() to return a finite number",
      );
      return out;
    },
    rpd: () => {
      const out = native.rpd();
      invariant(
        Number.isFinite(out),
        "Expected rpd() to return a finite number",
      );
      return out;
    },
    clight: () => {
      const out = native.clight();
      invariant(
        Number.isFinite(out),
        "Expected clight() to return a finite number",
      );
      return out;
    },
    dpmax: () => {
      const out = native.dpmax();
      invariant(
        Number.isFinite(out),
        "Expected dpmax() to return a finite number",
      );
      return out;
    },
    dpmin: () => {
      const out = native.dpmin();
      invariant(
        Number.isFinite(out),
        "Expected dpmin() to return a finite number",
      );
      return out;
    },
    intmax: () => {
      const out = native.intmax();
      assertSpiceInt32(out, "intmax() result");
      return out;
    },
    intmin: () => {
      const out = native.intmin();
      assertSpiceInt32(out, "intmin() result");
      return out;
    },
    cyllat: (radius, lon, z) => {
      assertCoordinateNumber(radius, "cyllat(radius)");
      assertCoordinateNumber(lon, "cyllat(lon)");
      assertCoordinateNumber(z, "cyllat(z)");
      const out = native.cyllat(radius, lon, z);
      if (!isPlainObject(out))
        throw new TypeError("cyllat result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "cyllat result.radius"),
        lon: coordinateOutputNumber(out.lon, "cyllat result.lon"),
        lat: coordinateOutputNumber(out.lat, "cyllat result.lat"),
      };
    },
    cylrec: (radius, lon, z) => {
      assertCoordinateNumber(radius, "cylrec(radius)");
      assertCoordinateNumber(lon, "cylrec(lon)");
      assertCoordinateNumber(z, "cylrec(z)");
      const out = native.cylrec(radius, lon, z);
      if (!Array.isArray(out) || out.length !== 3)
        throw new TypeError("cylrec result must have length 3");
      return [
        coordinateOutputNumber(out[0], "cylrec result[0]"),
        coordinateOutputNumber(out[1], "cylrec result[1]"),
        coordinateOutputNumber(out[2], "cylrec result[2]"),
      ];
    },
    cylsph: (radius, lon, z) => {
      assertCoordinateNumber(radius, "cylsph(radius)");
      assertCoordinateNumber(lon, "cylsph(lon)");
      assertCoordinateNumber(z, "cylsph(z)");
      const out = native.cylsph(radius, lon, z);
      if (!isPlainObject(out))
        throw new TypeError("cylsph result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "cylsph result.radius"),
        colat: coordinateOutputNumber(out.colat, "cylsph result.colat"),
        lon: coordinateOutputNumber(out.lon, "cylsph result.lon"),
      };
    },
    latcyl: (radius, lon, lat) => {
      assertCoordinateNumber(radius, "latcyl(radius)");
      assertCoordinateNumber(lon, "latcyl(lon)");
      assertCoordinateNumber(lat, "latcyl(lat)");
      const out = native.latcyl(radius, lon, lat);
      if (!isPlainObject(out))
        throw new TypeError("latcyl result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "latcyl result.radius"),
        lon: coordinateOutputNumber(out.lon, "latcyl result.lon"),
        z: coordinateOutputNumber(out.z, "latcyl result.z"),
      };
    },
    latsph: (radius, lon, lat) => {
      assertCoordinateNumber(radius, "latsph(radius)");
      assertCoordinateNumber(lon, "latsph(lon)");
      assertCoordinateNumber(lat, "latsph(lat)");
      const out = native.latsph(radius, lon, lat);
      if (!isPlainObject(out))
        throw new TypeError("latsph result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "latsph result.radius"),
        colat: coordinateOutputNumber(out.colat, "latsph result.colat"),
        lon: coordinateOutputNumber(out.lon, "latsph result.lon"),
      };
    },
    reccyl: (rect) => {
      const rectCopy = copyCoordinateVector(rect);
      const out = native.reccyl(rectCopy);
      if (!isPlainObject(out))
        throw new TypeError("reccyl result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "reccyl result.radius"),
        lon: coordinateOutputNumber(out.lon, "reccyl result.lon"),
        z: coordinateOutputNumber(out.z, "reccyl result.z"),
      };
    },
    sphcyl: (radius, colat, lon) => {
      assertCoordinateNumber(radius, "sphcyl(radius)");
      assertCoordinateNumber(colat, "sphcyl(colat)");
      assertCoordinateNumber(lon, "sphcyl(lon)");
      const out = native.sphcyl(radius, colat, lon);
      if (!isPlainObject(out))
        throw new TypeError("sphcyl result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "sphcyl result.radius"),
        lon: coordinateOutputNumber(out.lon, "sphcyl result.lon"),
        z: coordinateOutputNumber(out.z, "sphcyl result.z"),
      };
    },
    sphlat: (radius, colat, lon) => {
      assertCoordinateNumber(radius, "sphlat(radius)");
      assertCoordinateNumber(colat, "sphlat(colat)");
      assertCoordinateNumber(lon, "sphlat(lon)");
      const out = native.sphlat(radius, colat, lon);
      if (!isPlainObject(out))
        throw new TypeError("sphlat result must be an object");
      return {
        radius: coordinateOutputNumber(out.radius, "sphlat result.radius"),
        lon: coordinateOutputNumber(out.lon, "sphlat result.lon"),
        lat: coordinateOutputNumber(out.lat, "sphlat result.lat"),
      };
    },
    vdist: (a, b) => {
      const aCopy = copyBasicVector(a, "vdist(a)");
      const bCopy = copyBasicVector(b, "vdist(b)");
      const out = native.vdist(aCopy, bCopy);
      return basicOutputNumber(out, "vdist result");
    },
    vequ: (v) => {
      const vCopy = copyBasicVector(v, "vequ(v)");
      const out = native.vequ(vCopy);
      return basicOutputVector(out, "vequ result");
    },
    vpack: (x, y, z) => {
      assertBasicScalar(x, "vpack(x)");
      assertBasicScalar(y, "vpack(y)");
      assertBasicScalar(z, "vpack(z)");
      const out = native.vpack(x, y, z);
      return basicOutputVector(out, "vpack result");
    },
    vupack: (v) => {
      const vCopy = copyBasicVector(v, "vupack(v)");
      const out = native.vupack(vCopy);
      if (!isPlainObject(out))
        throw new TypeError("vupack result must be an object");
      return {
        x: basicOutputNumber(out.x, "vupack result.x"),
        y: basicOutputNumber(out.y, "vupack result.y"),
        z: basicOutputNumber(out.z, "vupack result.z"),
      };
    },
    vzero: (v) => {
      const vCopy = copyBasicVector(v, "vzero(v)");
      const out = native.vzero(vCopy);
      if (typeof out !== "boolean")
        throw new TypeError("vzero result must be a boolean");
      return out;
    },
    unorm: (v) => {
      const vCopy = copyBasicVector(v, "unorm(v)");
      const out = native.unorm(vCopy);
      if (!isPlainObject(out))
        throw new TypeError("unorm result must be an object");
      return {
        unit: basicOutputVector(out.unit, "unorm result.unit"),
        norm: basicOutputNumber(out.norm, "unorm result.norm"),
      };
    },
    ucrss: (a, b) => {
      const aCopy = copyBasicVector(a, "ucrss(a)");
      const bCopy = copyBasicVector(b, "ucrss(b)");
      const out = native.ucrss(aCopy, bCopy);
      return basicOutputVector(out, "ucrss result");
    },
    vsep: (a, b) => {
      const aCopy = copyBasicVector(a, "vsep(a)");
      const bCopy = copyBasicVector(b, "vsep(b)");
      const out = native.vsep(aCopy, bCopy);
      return basicOutputNumber(out, "vsep result");
    },
    vlcom: (a, v1, b, v2) => {
      assertCombinationScalar(a, "vlcom(a)");
      const v1Copy = copyCombinationVector(v1, "vlcom(v1)");
      assertCombinationScalar(b, "vlcom(b)");
      const v2Copy = copyCombinationVector(v2, "vlcom(v2)");
      const out = native.vlcom(a, v1Copy, b, v2Copy);
      return combinationOutputVector(out, "vlcom result");
    },
    vlcom3: (a, v1, b, v2, c, v3) => {
      assertCombinationScalar(a, "vlcom3(a)");
      const v1Copy = copyCombinationVector(v1, "vlcom3(v1)");
      assertCombinationScalar(b, "vlcom3(b)");
      const v2Copy = copyCombinationVector(v2, "vlcom3(v2)");
      assertCombinationScalar(c, "vlcom3(c)");
      const v3Copy = copyCombinationVector(v3, "vlcom3(v3)");
      const out = native.vlcom3(a, v1Copy, b, v2Copy, c, v3Copy);
      return combinationOutputVector(out, "vlcom3 result");
    },
    vperp: (a, b) => {
      const aCopy = copyCombinationVector(a, "vperp(a)");
      const bCopy = copyCombinationVector(b, "vperp(b)");
      const out = native.vperp(aCopy, bCopy);
      return combinationOutputVector(out, "vperp result");
    },
    vproj: (a, b) => {
      const aCopy = copyCombinationVector(a, "vproj(a)");
      const bCopy = copyCombinationVector(b, "vproj(b)");
      const out = native.vproj(aCopy, bCopy);
      return combinationOutputVector(out, "vproj result");
    },
    vrel: (a, b) => {
      const aCopy = copyCombinationVector(a, "vrel(a)");
      const bCopy = copyCombinationVector(b, "vrel(b)");
      const out = native.vrel(aCopy, bCopy);
      return combinationOutputNumber(out, "vrel result");
    },
    vrotv: (v, axis, theta) => {
      const vCopy = copyCombinationVector(v, "vrotv(v)");
      const axisCopy = copyCombinationVector(axis, "vrotv(axis)");
      assertCombinationScalar(theta, "vrotv(theta)");
      const out = native.vrotv(vCopy, axisCopy, theta);
      return combinationOutputVector(out, "vrotv result");
    },
    rotvec: (v, angle, axis) => {
      const vCopy = copyCombinationVector(v, "rotvec(v)");
      assertCombinationScalar(angle, "rotvec(angle)");
      assertSpiceInt32(axis, "rotvec(axis)");
      const out = native.rotvec(vCopy, angle, axis);
      return combinationOutputVector(out, "rotvec result");
    },
    vtmv: (v1, matrix, v2) => {
      const v1Copy = copyCombinationVector(v1, "vtmv(v1)");
      const matrixCopy = copyMatrixInput(matrix, "vtmv(matrix)");
      const v2Copy = copyCombinationVector(v2, "vtmv(v2)");
      const out = native.vtmv(v1Copy, matrixCopy, v2Copy);
      return combinationOutputNumber(out, "vtmv result");
    },
    azlrec: (range, az, el, azccw, elplsz) => {
      assertConventionScalar(range, "azlrec(range)");
      assertConventionScalar(az, "azlrec(az)");
      assertConventionScalar(el, "azlrec(el)");
      assertConventionBoolean(azccw, "azlrec(azccw)");
      assertConventionBoolean(elplsz, "azlrec(elplsz)");
      const out: unknown = native.azlrec(range, az, el, azccw, elplsz);
      return conventionOutputVector(out, "azlrec result");
    },
    recazl: (rect, azccw, elplsz) => {
      const rectCopy = copyConventionVector(rect, "recazl(rect)");
      assertConventionBoolean(azccw, "recazl(azccw)");
      assertConventionBoolean(elplsz, "recazl(elplsz)");
      const out: unknown = native.recazl(rectCopy, azccw, elplsz);
      invariant(isPlainObject(out), "Expected recazl() to return an object");
      return {
        range: conventionOutputNumber(out.range, "recazl().range"),
        az: conventionOutputNumber(out.az, "recazl().az"),
        el: conventionOutputNumber(out.el, "recazl().el"),
      };
    },
    pgrrec: (body, lon, lat, alt, re, f) => {
      assertConventionBody(body, "pgrrec(body)");
      assertConventionScalar(lon, "pgrrec(lon)");
      assertConventionScalar(lat, "pgrrec(lat)");
      assertConventionScalar(alt, "pgrrec(alt)");
      assertConventionScalar(re, "pgrrec(re)");
      assertConventionScalar(f, "pgrrec(f)");
      const out: unknown = native.pgrrec(body, lon, lat, alt, re, f);
      return conventionOutputVector(out, "pgrrec result");
    },
    recpgr: (body, rect, re, f) => {
      assertConventionBody(body, "recpgr(body)");
      const rectCopy = copyConventionVector(rect, "recpgr(rect)");
      assertConventionScalar(re, "recpgr(re)");
      assertConventionScalar(f, "recpgr(f)");
      const out: unknown = native.recpgr(body, rectCopy, re, f);
      invariant(isPlainObject(out), "Expected recpgr() to return an object");
      return {
        lon: conventionOutputNumber(out.lon, "recpgr().lon"),
        lat: conventionOutputNumber(out.lat, "recpgr().lat"),
        alt: conventionOutputNumber(out.alt, "recpgr().alt"),
      };
    },
    radrec: (range, ra, dec) => {
      assertConventionScalar(range, "radrec(range)");
      assertConventionScalar(ra, "radrec(ra)");
      assertConventionScalar(dec, "radrec(dec)");
      const out: unknown = native.radrec(range, ra, dec);
      return conventionOutputVector(out, "radrec result");
    },
    recrad: (rect) => {
      const rectCopy = copyConventionVector(rect, "recrad(rect)");
      const out: unknown = native.recrad(rectCopy);
      invariant(isPlainObject(out), "Expected recrad() to return an object");
      return {
        range: conventionOutputNumber(out.range, "recrad().range"),
        ra: conventionOutputNumber(out.ra, "recrad().ra"),
        dec: conventionOutputNumber(out.dec, "recrad().dec"),
      };
    },
    srfrec: (body, lon, lat) => {
      assertSpiceInt32(body, "srfrec(body)");
      assertConventionScalar(lon, "srfrec(lon)");
      assertConventionScalar(lat, "srfrec(lat)");
      const out: unknown = native.srfrec(body, lon, lat);
      return conventionOutputVector(out, "srfrec result");
    },
    brcktd: (value, end1, end2) => {
      assertScalarMathDouble(value, "brcktd(value)");
      assertScalarMathDouble(end1, "brcktd(end1)");
      assertScalarMathDouble(end2, "brcktd(end2)");
      const out: unknown = native.brcktd(value, end1, end2);
      invariant(
        typeof out === "number",
        "Expected brcktd() to return a number",
      );
      return out;
    },
    brckti: (value, end1, end2) => {
      assertSpiceInt32(value, "brckti(value)");
      assertSpiceInt32(end1, "brckti(end1)");
      assertSpiceInt32(end2, "brckti(end2)");
      const out: unknown = native.brckti(value, end1, end2);
      invariant(
        typeof out === "number",
        "Expected brckti() to return a number",
      );
      assertSpiceInt32(out, "brckti result");
      return out;
    },
    convrt: (value, inUnit, outUnit) => {
      assertScalarMathDouble(value, "convrt(value)");
      assertScalarMathString(inUnit, "convrt(inUnit)");
      assertScalarMathString(outUnit, "convrt(outUnit)");
      const out: unknown = native.convrt(value, inUnit, outUnit);
      invariant(
        typeof out === "number",
        "Expected convrt() to return a number",
      );
      return out;
    },
    sumad: (values) => {
      const valuesCopy = copyScalarMathArray(
        values,
        "sumad(values)",
        false,
        2147483647,
      );
      const out: unknown = native.sumad(valuesCopy);
      invariant(typeof out === "number", "Expected sumad() to return a number");
      return out;
    },
    sumai: (values) => {
      const valuesCopy = copyScalarMathArray(
        values,
        "sumai(values)",
        true,
        2147483647,
      );
      assertSumaiPrefixes(valuesCopy);
      const out: unknown = native.sumai(valuesCopy);
      invariant(typeof out === "number", "Expected sumai() to return a number");
      assertSpiceInt32(out, "sumai result");
      return out;
    },
    maxd: (values) => {
      const valuesCopy = copyScalarMathArray(values, "maxd(values)", false, 30);
      const out: unknown = native.maxd(valuesCopy);
      invariant(typeof out === "number", "Expected maxd() to return a number");
      return out;
    },
    maxi: (values) => {
      const valuesCopy = copyScalarMathArray(values, "maxi(values)", true, 30);
      const out: unknown = native.maxi(valuesCopy);
      invariant(typeof out === "number", "Expected maxi() to return a number");
      assertSpiceInt32(out, "maxi result");
      return out;
    },
    mind: (values) => {
      const valuesCopy = copyScalarMathArray(values, "mind(values)", false, 30);
      const out: unknown = native.mind(valuesCopy);
      invariant(typeof out === "number", "Expected mind() to return a number");
      return out;
    },
    mini: (values) => {
      const valuesCopy = copyScalarMathArray(values, "mini(values)", true, 30);
      const out: unknown = native.mini(valuesCopy);
      invariant(typeof out === "number", "Expected mini() to return a number");
      assertSpiceInt32(out, "mini result");
      return out;
    },
    ducrss: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "ducrss(a)");
      const bCopy = copyStateDerivativeInput(b, "ducrss(b)");
      const out: unknown = native.ducrss(aCopy, bCopy);
      return stateDerivativeOutput(out, "ducrss result");
    },
    dvcrss: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "dvcrss(a)");
      const bCopy = copyStateDerivativeInput(b, "dvcrss(b)");
      const out: unknown = native.dvcrss(aCopy, bCopy);
      return stateDerivativeOutput(out, "dvcrss result");
    },
    dvdot: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "dvdot(a)");
      const bCopy = copyStateDerivativeInput(b, "dvdot(b)");
      const out: unknown = native.dvdot(aCopy, bCopy);
      return stateDerivativeOutputNumber(out, "dvdot result");
    },
    dvhat: (state) => {
      const stateCopy = copyStateDerivativeInput(state, "dvhat(state)");
      const out: unknown = native.dvhat(stateCopy);
      return stateDerivativeOutput(out, "dvhat result");
    },
    dvnorm: (state) => {
      const stateCopy = copyStateDerivativeInput(state, "dvnorm(state)");
      const out: unknown = native.dvnorm(stateCopy);
      return stateDerivativeOutputNumber(out, "dvnorm result");
    },
    dvsep: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "dvsep(a)");
      const bCopy = copyStateDerivativeInput(b, "dvsep(b)");
      const out: unknown = native.dvsep(aCopy, bCopy);
      return stateDerivativeOutputNumber(out, "dvsep result");
    },
    chbder: (cp, x2s, x, nderiv) => {
      const outputCount = polynomialDerivativeCount(nderiv, true);
      const cpCopy = copyPolynomialCoefficients(cp, "chbder(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbder(x2s)");
      assertPolynomialNumber(x, "chbder(x)");
      const out: unknown = native.chbder(cpCopy, transform, x, nderiv);
      return polynomialOutputArray(out, outputCount, "chbder result");
    },
    chbigr: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbigr(cp)", true);
      const transform = copyPolynomialTransform(x2s, "chbigr(x2s)");
      assertPolynomialNumber(x, "chbigr(x)");
      const out: unknown = native.chbigr(cpCopy, transform, x);
      invariant(isPlainObject(out), "Expected chbigr() to return an object");
      return {
        p: polynomialOutputNumber(out.p, "chbigr().p"),
        itgrlp: polynomialOutputNumber(out.itgrlp, "chbigr().itgrlp"),
      };
    },
    chbint: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbint(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbint(x2s)");
      assertPolynomialNumber(x, "chbint(x)");
      const out: unknown = native.chbint(cpCopy, transform, x);
      invariant(isPlainObject(out), "Expected chbint() to return an object");
      return {
        p: polynomialOutputNumber(out.p, "chbint().p"),
        dpdx: polynomialOutputNumber(out.dpdx, "chbint().dpdx"),
      };
    },
    chbval: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbval(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbval(x2s)");
      assertPolynomialNumber(x, "chbval(x)");
      const out: unknown = native.chbval(cpCopy, transform, x);
      return polynomialOutputNumber(out, "chbval result");
    },
    polyds: (coeffs, nderiv, t) => {
      const outputCount = polynomialDerivativeCount(nderiv, false);
      const coeffsCopy = copyPolynomialCoefficients(
        coeffs,
        "polyds(coeffs)",
        true,
      );
      assertPolynomialNumber(t, "polyds(t)");
      const out: unknown = native.polyds(coeffsCopy, nderiv, t);
      return polynomialOutputArray(out, outputCount, "polyds result");
    },
    rquad: (a, b, c) => {
      assertPolynomialNumber(a, "rquad(a)");
      assertPolynomialNumber(b, "rquad(b)");
      assertPolynomialNumber(c, "rquad(c)");
      const out: unknown = native.rquad(a, b, c);
      invariant(isPlainObject(out), "Expected rquad() to return an object");
      return {
        root1: polynomialOutputPair(out.root1, "rquad().root1"),
        root2: polynomialOutputPair(out.root2, "rquad().root2"),
      };
    },
    reclat: (rect) => {
      const out = native.reclat(rect);
      invariant(
        out && typeof out === "object",
        "Expected reclat() to return an object",
      );
      invariant(
        typeof out.radius === "number",
        "Expected reclat().radius to be a number",
      );
      invariant(
        typeof out.lon === "number",
        "Expected reclat().lon to be a number",
      );
      invariant(
        typeof out.lat === "number",
        "Expected reclat().lat to be a number",
      );
      return { radius: out.radius, lon: out.lon, lat: out.lat };
    },

    latrec: (radius, lon, lat) => {
      const out = native.latrec(radius, lon, lat);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected latrec() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    recsph: (rect) => {
      const out = native.recsph(rect);
      invariant(
        out && typeof out === "object",
        "Expected recsph() to return an object",
      );
      invariant(
        typeof out.radius === "number",
        "Expected recsph().radius to be a number",
      );
      invariant(
        typeof out.colat === "number",
        "Expected recsph().colat to be a number",
      );
      invariant(
        typeof out.lon === "number",
        "Expected recsph().lon to be a number",
      );
      return { radius: out.radius, colat: out.colat, lon: out.lon };
    },

    sphrec: (radius, colat, lon) => {
      const out = native.sphrec(radius, colat, lon);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected sphrec() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    vnorm: (v) => {
      const out = native.vnorm(v);
      invariant(typeof out === "number", "Expected vnorm() to return a number");
      return out;
    },

    vhat: (v) => {
      const out = native.vhat(v);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected vhat() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    vdot: (a, b) => {
      const out = native.vdot(a, b);
      invariant(typeof out === "number", "Expected vdot() to return a number");
      return out;
    },

    vcrss: (a, b) => {
      const out = native.vcrss(a, b);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected vcrss() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    mxv: (m, v) => {
      assertMat3ArrayLike9(m, { label: "mxv().m" });
      const out = native.mxv(m, v);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected mxv() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    mtxv: (m, v) => {
      assertMat3ArrayLike9(m, { label: "mtxv().m" });
      const out = native.mtxv(m, v);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected mtxv() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    vadd: (a, b) => {
      const out = native.vadd(a, b);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected vadd() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    vsub: (a, b) => {
      const out = native.vsub(a, b);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected vsub() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    vminus: (v) => {
      const out = native.vminus(v);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected vminus() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    vscl: (s, v) => {
      const out = native.vscl(s, v);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected vscl() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    mxm: (a, b) => {
      assertMat3ArrayLike9(a, { label: "mxm().a" });
      assertMat3ArrayLike9(b, { label: "mxm().b" });
      const out = native.mxm(a, b);
      invariant(
        Array.isArray(out) && out.length === 9,
        "Expected mxm() to return a length-9 array",
      );
      return brandMat3RowMajor(out, { label: "mxm()" });
    },

    rotate: (angle, axis) => {
      assertSpiceInt32(axis, "rotate(axis)");
      const out = native.rotate(angle, axis);
      invariant(
        Array.isArray(out) && out.length === 9,
        "Expected rotate() to return a length-9 array",
      );
      return brandMat3RowMajor(out, { label: "rotate()" });
    },

    rotmat: (m, angle, axis) => {
      assertSpiceInt32(axis, "rotmat(axis)");
      assertMat3ArrayLike9(m, { label: "rotmat().m" });
      const out = native.rotmat(m, angle, axis);
      invariant(
        Array.isArray(out) && out.length === 9,
        "Expected rotmat() to return a length-9 array",
      );
      return brandMat3RowMajor(out, { label: "rotmat()" });
    },

    axisar: (axis, angle) => {
      const out = native.axisar(axis, angle);
      invariant(
        Array.isArray(out) && out.length === 9,
        "Expected axisar() to return a length-9 array",
      );
      return brandMat3RowMajor(out, { label: "axisar()" });
    },

    georec: (lon, lat, alt, re, f) => {
      const out = native.georec(lon, lat, alt, re, f);
      invariant(
        Array.isArray(out) && out.length === 3,
        "Expected georec() to return a length-3 array",
      );
      return out as SpiceVector3;
    },

    recgeo: (rect, re, f) => {
      const out = native.recgeo(rect, re, f) as unknown;
      invariant(isPlainObject(out), "Expected recgeo() to return an object");

      const lon = out.lon;
      const lat = out.lat;
      const alt = out.alt;
      invariant(
        typeof lon === "number",
        "Expected recgeo().lon to be a number",
      );
      invariant(
        typeof lat === "number",
        "Expected recgeo().lat to be a number",
      );
      invariant(
        typeof alt === "number",
        "Expected recgeo().alt to be a number",
      );

      return { lon, lat, alt };
    },
  };
}
