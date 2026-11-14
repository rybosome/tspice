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

function assertCoordinateNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function assertCoordinateVector(
  value: unknown,
): asserts value is Readonly<SpiceVector3> {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(
      "reccyl(rect) must contain exactly three finite numbers",
    );
  }
  for (let i = 0; i < 3; i++)
    assertCoordinateNumber(value[i], `reccyl(rect[${i}])`);
}

function coordinateOutputNumber(value: unknown, label: string): number {
  // Finite inputs can overflow a CSPICE norm. Preserve its numerical result.
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
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
      assertCoordinateVector(rect);
      const out = native.reccyl(rect);
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
