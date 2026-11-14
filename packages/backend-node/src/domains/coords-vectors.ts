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

function assertConventionScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function assertConventionVector(
  value: unknown,
  label: string,
): asserts value is Readonly<SpiceVector3> {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  for (let i = 0; i < 3; i++)
    assertConventionScalar(value[i], `${label}[${i}]`);
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

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
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
      assertConventionVector(rect, "recazl(rect)");
      assertConventionBoolean(azccw, "recazl(azccw)");
      assertConventionBoolean(elplsz, "recazl(elplsz)");
      const out: unknown = native.recazl(rect, azccw, elplsz);
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
      assertConventionVector(rect, "recpgr(rect)");
      assertConventionScalar(re, "recpgr(re)");
      assertConventionScalar(f, "recpgr(f)");
      const out: unknown = native.recpgr(body, rect, re, f);
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
      assertConventionVector(rect, "recrad(rect)");
      const out: unknown = native.recrad(rect);
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
