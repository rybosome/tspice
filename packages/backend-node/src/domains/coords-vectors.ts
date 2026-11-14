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

function assertScalarMathArray(
  value: unknown,
  label: string,
  integers: boolean,
  maxCount: number,
): asserts value is readonly number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  if (value.length > maxCount)
    throw new RangeError(`${label} must contain at most ${maxCount} values`);
  for (let i = 0; i < value.length; i++) {
    if (integers) assertSpiceInt32(value[i], `${label}[${i}]`);
    else assertScalarMathDouble(value[i], `${label}[${i}]`);
  }
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

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
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
      assertScalarMathArray(values, "sumad(values)", false, 2147483647);
      const out: unknown = native.sumad(values);
      invariant(typeof out === "number", "Expected sumad() to return a number");
      return out;
    },
    sumai: (values) => {
      assertScalarMathArray(values, "sumai(values)", true, 2147483647);
      assertSumaiPrefixes(values);
      const out: unknown = native.sumai(values);
      invariant(typeof out === "number", "Expected sumai() to return a number");
      assertSpiceInt32(out, "sumai result");
      return out;
    },
    maxd: (values) => {
      assertScalarMathArray(values, "maxd(values)", false, 30);
      const out: unknown = native.maxd(values);
      invariant(typeof out === "number", "Expected maxd() to return a number");
      return out;
    },
    maxi: (values) => {
      assertScalarMathArray(values, "maxi(values)", true, 30);
      const out: unknown = native.maxi(values);
      invariant(typeof out === "number", "Expected maxi() to return a number");
      assertSpiceInt32(out, "maxi result");
      return out;
    },
    mind: (values) => {
      assertScalarMathArray(values, "mind(values)", false, 30);
      const out: unknown = native.mind(values);
      invariant(typeof out === "number", "Expected mind() to return a number");
      return out;
    },
    mini: (values) => {
      assertScalarMathArray(values, "mini(values)", true, 30);
      const out: unknown = native.mini(values);
      invariant(typeof out === "number", "Expected mini() to return a number");
      assertSpiceInt32(out, "mini result");
      return out;
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
