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

function assertInterpolationNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function interpolationCount(
  value: unknown,
  stride: number,
  maximum: number,
  label: string,
): number {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length % stride !== 0 ||
    length / stride > maximum
  )
    throw new RangeError(`${label} has an unsupported point count or layout`);
  return length / stride;
}

function copyInterpolationValues(
  value: readonly number[],
  length: number,
  label: string,
): number[] {
  // Read exactly the validated count. An input accessor can mutate another
  // array while inputs are being copied; a missing entry must fail validation.
  const copy: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry = value[i];
    assertInterpolationNumber(entry, `${label}[${i}]`);
    copy.push(entry);
  }
  return copy;
}

function interpolationOutputNumber(value: unknown, label: string): number {
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function interpolationOutputArray(
  value: unknown,
  length: number,
  label: string,
): number[] {
  if (!Array.isArray(value) || value.length !== length)
    throw new TypeError(`${label} must be an array of length ${length}`);
  const result: number[] = [];
  for (let i = 0; i < length; i++)
    result.push(interpolationOutputNumber(value[i], `${label}[${i}]`));
  return result;
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    hrmesp: (first, step, yvals, x) => {
      const count = interpolationCount(yvals, 2, 67108863, "hrmesp(yvals)");
      assertInterpolationNumber(first, "hrmesp(first)");
      assertInterpolationNumber(step, "hrmesp(step)");
      const yvalsCopy = copyInterpolationValues(
        yvals,
        2 * count,
        "hrmesp(yvals)",
      );
      assertInterpolationNumber(x, "hrmesp(x)");
      const out: unknown = native.hrmesp(first, step, yvalsCopy, x);
      invariant(isPlainObject(out), "Expected hrmesp() to return an object");
      return {
        f: interpolationOutputNumber(out.f, "hrmesp().f"),
        df: interpolationOutputNumber(out.df, "hrmesp().df"),
      };
    },
    hrmint: (xvals, yvals, x) => {
      const count = interpolationCount(xvals, 1, 357913941, "hrmint(xvals)");
      const otherCount = interpolationCount(
        yvals,
        2,
        357913941,
        "hrmint(yvals)",
      );
      if (otherCount !== count)
        throw new RangeError("hrmint() input array lengths do not match");
      const xvalsCopy = copyInterpolationValues(
        xvals,
        1 * count,
        "hrmint(xvals)",
      );
      const yvalsCopy = copyInterpolationValues(
        yvals,
        2 * count,
        "hrmint(yvals)",
      );
      assertInterpolationNumber(x, "hrmint(x)");
      const out: unknown = native.hrmint(xvalsCopy, yvalsCopy, x);
      invariant(isPlainObject(out), "Expected hrmint() to return an object");
      return {
        f: interpolationOutputNumber(out.f, "hrmint().f"),
        df: interpolationOutputNumber(out.df, "hrmint().df"),
      };
    },
    lgresp: (first, step, yvals, x) => {
      const count = interpolationCount(yvals, 1, 268435455, "lgresp(yvals)");
      assertInterpolationNumber(first, "lgresp(first)");
      assertInterpolationNumber(step, "lgresp(step)");
      const yvalsCopy = copyInterpolationValues(
        yvals,
        1 * count,
        "lgresp(yvals)",
      );
      assertInterpolationNumber(x, "lgresp(x)");
      const out: unknown = native.lgresp(first, step, yvalsCopy, x);
      return interpolationOutputNumber(out, "lgresp result");
    },
    lgrind: (xvals, yvals, x) => {
      const count = interpolationCount(xvals, 1, 715827882, "lgrind(xvals)");
      const otherCount = interpolationCount(
        yvals,
        1,
        715827882,
        "lgrind(yvals)",
      );
      if (otherCount !== count)
        throw new RangeError("lgrind() input array lengths do not match");
      const xvalsCopy = copyInterpolationValues(
        xvals,
        1 * count,
        "lgrind(xvals)",
      );
      const yvalsCopy = copyInterpolationValues(
        yvals,
        1 * count,
        "lgrind(yvals)",
      );
      assertInterpolationNumber(x, "lgrind(x)");
      const out: unknown = native.lgrind(xvalsCopy, yvalsCopy, x);
      invariant(isPlainObject(out), "Expected lgrind() to return an object");
      return {
        p: interpolationOutputNumber(out.p, "lgrind().p"),
        dp: interpolationOutputNumber(out.dp, "lgrind().dp"),
      };
    },
    lgrint: (xvals, yvals, x) => {
      const count = interpolationCount(xvals, 1, 268435455, "lgrint(xvals)");
      const otherCount = interpolationCount(
        yvals,
        1,
        268435455,
        "lgrint(yvals)",
      );
      if (otherCount !== count)
        throw new RangeError("lgrint() input array lengths do not match");
      const xvalsCopy = copyInterpolationValues(
        xvals,
        1 * count,
        "lgrint(xvals)",
      );
      const yvalsCopy = copyInterpolationValues(
        yvals,
        1 * count,
        "lgrint(yvals)",
      );
      assertInterpolationNumber(x, "lgrint(x)");
      const out: unknown = native.lgrint(xvalsCopy, yvalsCopy, x);
      return interpolationOutputNumber(out, "lgrint result");
    },
    qderiv: (f0, f2, delta) => {
      const count = interpolationCount(f0, 1, 2147483646, "qderiv(f0)");
      const otherCount = interpolationCount(f2, 1, 2147483646, "qderiv(f2)");
      if (otherCount !== count)
        throw new RangeError("qderiv() input array lengths do not match");
      if (count === 0)
        throw new RangeError("qderiv() requires nonempty arrays");
      const f0Copy = copyInterpolationValues(f0, 1 * count, "qderiv(f0)");
      const f2Copy = copyInterpolationValues(f2, 1 * count, "qderiv(f2)");
      assertInterpolationNumber(delta, "qderiv(delta)");
      const out: unknown = native.qderiv(f0Copy, f2Copy, delta);
      return interpolationOutputArray(out, count, "qderiv result");
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
