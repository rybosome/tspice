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

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
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
