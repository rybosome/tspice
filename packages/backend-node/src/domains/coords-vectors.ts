import type {
  CoordsVectorsApi,
  SpiceVector3,
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

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
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
