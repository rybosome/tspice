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

function assertGeneralVectorScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function assertGeneralVector(
  value: unknown,
  label: string,
  maxDimension: number,
): asserts value is readonly number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  if (value.length > maxDimension)
    throw new RangeError(`${label} exceeds maximum dimension ${maxDimension}`);
  for (let i = 0; i < value.length; i++)
    assertGeneralVectorScalar(value[i], `${label}[${i}]`);
}

function assertGeneralVectorDimensions(
  a: readonly number[],
  b: readonly number[],
  label: string,
): void {
  if (a.length !== b.length)
    throw new RangeError(`${label} vectors must have equal lengths`);
}

function generalVectorOutputNumber(value: unknown, label: string): number {
  // Do not reject IEEE-754 outputs produced by defined finite CSPICE inputs.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function generalVectorOutput(
  value: unknown,
  dimension: number,
  label: string,
): number[] {
  if (!Array.isArray(value) || value.length !== dimension)
    throw new TypeError(`${label} must be an array of length ${dimension}`);
  const result: number[] = [];
  for (let i = 0; i < dimension; i++)
    result.push(generalVectorOutputNumber(value[i], `${label}[${i}]`));
  return result;
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    vaddg: (a, b) => {
      assertGeneralVector(a, "vaddg(a)", 2147483647);
      assertGeneralVector(b, "vaddg(b)", 2147483647);
      assertGeneralVectorDimensions(a, b, "vaddg()");
      const out: unknown = native.vaddg(a, b);
      return generalVectorOutput(out, a.length, "vaddg result");
    },
    vdistg: (a, b) => {
      assertGeneralVector(a, "vdistg(a)", 2147483647);
      assertGeneralVector(b, "vdistg(b)", 2147483647);
      assertGeneralVectorDimensions(a, b, "vdistg()");
      const out: unknown = native.vdistg(a, b);
      return generalVectorOutputNumber(out, "vdistg result");
    },
    vdotg: (a, b) => {
      assertGeneralVector(a, "vdotg(a)", 2147483647);
      assertGeneralVector(b, "vdotg(b)", 2147483647);
      assertGeneralVectorDimensions(a, b, "vdotg()");
      const out: unknown = native.vdotg(a, b);
      return generalVectorOutputNumber(out, "vdotg result");
    },
    vequg: (v) => {
      assertGeneralVector(v, "vequg(v)", 2147483647);
      const out: unknown = native.vequg(v);
      return generalVectorOutput(out, v.length, "vequg result");
    },
    vhatg: (v) => {
      assertGeneralVector(v, "vhatg(v)", 2147483647);
      const out: unknown = native.vhatg(v);
      return generalVectorOutput(out, v.length, "vhatg result");
    },
    vlcomg: (a, v1, b, v2) => {
      assertGeneralVectorScalar(a, "vlcomg(a)");
      assertGeneralVector(v1, "vlcomg(v1)", 2147483647);
      assertGeneralVectorScalar(b, "vlcomg(b)");
      assertGeneralVector(v2, "vlcomg(v2)", 2147483647);
      assertGeneralVectorDimensions(v1, v2, "vlcomg()");
      const out: unknown = native.vlcomg(a, v1, b, v2);
      return generalVectorOutput(out, v1.length, "vlcomg result");
    },
    vminug: (v) => {
      assertGeneralVector(v, "vminug(v)", 2147483647);
      const out: unknown = native.vminug(v);
      return generalVectorOutput(out, v.length, "vminug result");
    },
    vnormg: (v) => {
      assertGeneralVector(v, "vnormg(v)", 2147483647);
      const out: unknown = native.vnormg(v);
      return generalVectorOutputNumber(out, "vnormg result");
    },
    vprojg: (a, b) => {
      assertGeneralVector(a, "vprojg(a)", 2147483646);
      assertGeneralVector(b, "vprojg(b)", 2147483646);
      assertGeneralVectorDimensions(a, b, "vprojg()");
      const out: unknown = native.vprojg(a, b);
      return generalVectorOutput(out, a.length, "vprojg result");
    },
    vrelg: (a, b) => {
      assertGeneralVector(a, "vrelg(a)", 2147483647);
      assertGeneralVector(b, "vrelg(b)", 2147483647);
      assertGeneralVectorDimensions(a, b, "vrelg()");
      const out: unknown = native.vrelg(a, b);
      return generalVectorOutputNumber(out, "vrelg result");
    },
    vsclg: (s, v) => {
      assertGeneralVectorScalar(s, "vsclg(s)");
      assertGeneralVector(v, "vsclg(v)", 2147483647);
      const out: unknown = native.vsclg(s, v);
      return generalVectorOutput(out, v.length, "vsclg result");
    },
    vsepg: (a, b) => {
      assertGeneralVector(a, "vsepg(a)", 2147483647);
      assertGeneralVector(b, "vsepg(b)", 2147483647);
      assertGeneralVectorDimensions(a, b, "vsepg()");
      const out: unknown = native.vsepg(a, b);
      return generalVectorOutputNumber(out, "vsepg result");
    },
    vsubg: (a, b) => {
      assertGeneralVector(a, "vsubg(a)", 2147483647);
      assertGeneralVector(b, "vsubg(b)", 2147483647);
      assertGeneralVectorDimensions(a, b, "vsubg()");
      const out: unknown = native.vsubg(a, b);
      return generalVectorOutput(out, a.length, "vsubg result");
    },
    vzerog: (v) => {
      assertGeneralVector(v, "vzerog(v)", 2147483647);
      const out: unknown = native.vzerog(v);
      invariant(
        typeof out === "boolean",
        "Expected vzerog() to return a boolean",
      );
      return out;
    },
    unormg: (v) => {
      assertGeneralVector(v, "unormg(v)", 2147483646);
      const out: unknown = native.unormg(v);
      invariant(isPlainObject(out), "Expected unormg() to return an object");
      return {
        unit: generalVectorOutput(out.unit, v.length, "unormg().unit"),
        norm: generalVectorOutputNumber(out.norm, "unormg().norm"),
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
