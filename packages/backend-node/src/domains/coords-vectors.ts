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

function generalVectorDimension(
  value: unknown,
  label: string,
  maximum: number,
): number {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum)
    throw new RangeError(`${label} exceeds maximum dimension ${maximum}`);
  return length;
}

function copyGeneralVector(
  value: readonly number[],
  dimension: number,
  label: string,
): number[] {
  // Read exactly the captured dimension, once per component. Callers' arrays
  // may contain accessors, so marshal this checked copy rather than re-reading.
  const result: number[] = [];
  for (let i = 0; i < dimension; i++) {
    const component = value[i];
    assertGeneralVectorScalar(component, `${label}[${i}]`);
    result.push(component);
  }
  return result;
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
      const aLength = generalVectorDimension(a, "vaddg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vaddg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vaddg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vaddg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vaddg(b)");
      const out: unknown = native.vaddg(aCopy, bCopy);
      return generalVectorOutput(out, aCopy.length, "vaddg result");
    },
    vdistg: (a, b) => {
      const aLength = generalVectorDimension(a, "vdistg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vdistg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vdistg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vdistg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vdistg(b)");
      const out: unknown = native.vdistg(aCopy, bCopy);
      return generalVectorOutputNumber(out, "vdistg result");
    },
    vdotg: (a, b) => {
      const aLength = generalVectorDimension(a, "vdotg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vdotg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vdotg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vdotg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vdotg(b)");
      const out: unknown = native.vdotg(aCopy, bCopy);
      return generalVectorOutputNumber(out, "vdotg result");
    },
    vequg: (v) => {
      const vLength = generalVectorDimension(v, "vequg(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vequg(v)");
      const out: unknown = native.vequg(vCopy);
      return generalVectorOutput(out, vCopy.length, "vequg result");
    },
    vhatg: (v) => {
      const vLength = generalVectorDimension(v, "vhatg(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vhatg(v)");
      const out: unknown = native.vhatg(vCopy);
      return generalVectorOutput(out, vCopy.length, "vhatg result");
    },
    vlcomg: (a, v1, b, v2) => {
      const v1Length = generalVectorDimension(v1, "vlcomg(v1)", 2147483647);
      const v2Length = generalVectorDimension(v2, "vlcomg(v2)", 2147483647);
      if (v1Length !== v2Length)
        throw new RangeError("vlcomg() vectors must have equal lengths");
      assertGeneralVectorScalar(a, "vlcomg(a)");
      assertGeneralVectorScalar(b, "vlcomg(b)");
      const v1Copy = copyGeneralVector(v1, v1Length, "vlcomg(v1)");
      const v2Copy = copyGeneralVector(v2, v2Length, "vlcomg(v2)");
      const out: unknown = native.vlcomg(a, v1Copy, b, v2Copy);
      return generalVectorOutput(out, v1Copy.length, "vlcomg result");
    },
    vminug: (v) => {
      const vLength = generalVectorDimension(v, "vminug(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vminug(v)");
      const out: unknown = native.vminug(vCopy);
      return generalVectorOutput(out, vCopy.length, "vminug result");
    },
    vnormg: (v) => {
      const vLength = generalVectorDimension(v, "vnormg(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vnormg(v)");
      const out: unknown = native.vnormg(vCopy);
      return generalVectorOutputNumber(out, "vnormg result");
    },
    vprojg: (a, b) => {
      const aLength = generalVectorDimension(a, "vprojg(a)", 2147483646);
      const bLength = generalVectorDimension(b, "vprojg(b)", 2147483646);
      if (aLength !== bLength)
        throw new RangeError("vprojg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vprojg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vprojg(b)");
      const out: unknown = native.vprojg(aCopy, bCopy);
      return generalVectorOutput(out, aCopy.length, "vprojg result");
    },
    vrelg: (a, b) => {
      const aLength = generalVectorDimension(a, "vrelg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vrelg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vrelg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vrelg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vrelg(b)");
      const out: unknown = native.vrelg(aCopy, bCopy);
      return generalVectorOutputNumber(out, "vrelg result");
    },
    vsclg: (s, v) => {
      const vLength = generalVectorDimension(v, "vsclg(v)", 2147483647);
      assertGeneralVectorScalar(s, "vsclg(s)");
      const vCopy = copyGeneralVector(v, vLength, "vsclg(v)");
      const out: unknown = native.vsclg(s, vCopy);
      return generalVectorOutput(out, vCopy.length, "vsclg result");
    },
    vsepg: (a, b) => {
      const aLength = generalVectorDimension(a, "vsepg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vsepg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vsepg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vsepg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vsepg(b)");
      const out: unknown = native.vsepg(aCopy, bCopy);
      return generalVectorOutputNumber(out, "vsepg result");
    },
    vsubg: (a, b) => {
      const aLength = generalVectorDimension(a, "vsubg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vsubg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vsubg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vsubg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vsubg(b)");
      const out: unknown = native.vsubg(aCopy, bCopy);
      return generalVectorOutput(out, aCopy.length, "vsubg result");
    },
    vzerog: (v) => {
      const vLength = generalVectorDimension(v, "vzerog(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vzerog(v)");
      const out: unknown = native.vzerog(vCopy);
      invariant(
        typeof out === "boolean",
        "Expected vzerog() to return a boolean",
      );
      return out;
    },
    unormg: (v) => {
      const vLength = generalVectorDimension(v, "unormg(v)", 2147483646);
      const vCopy = copyGeneralVector(v, vLength, "unormg(v)");
      const out: unknown = native.unormg(vCopy);
      invariant(isPlainObject(out), "Expected unormg() to return an object");
      return {
        unit: generalVectorOutput(out.unit, vCopy.length, "unormg().unit"),
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
