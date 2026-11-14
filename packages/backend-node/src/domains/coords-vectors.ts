import type {
  CoordsVectorsApi,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceStorageFits,
  copySpiceStorage,
  spiceStorageLength,
  assertMat3ArrayLike9,
  assertSpiceInt32,
  brandMat3RowMajor,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function storageResult(
  value: unknown,
  expectedLength: number,
  kind: "byte" | "int" | "double",
  label: string,
): number[] {
  if (!Array.isArray(value) || value.length !== expectedLength)
    throw new TypeError(
      `${label} must be an array of length ${expectedLength}`,
    );
  return copySpiceStorage(value, expectedLength, kind, label);
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    clearc: (ndim, arrlen, bytes) => {
      assertSpiceInt32(ndim, "clearc(ndim)");
      assertSpiceInt32(arrlen, "clearc(arrlen)");
      const bytesLength = spiceStorageLength(bytes, "clearc(bytes)");
      // CSPICE handles widths below two before accessing the buffer.
      if (arrlen >= 2)
        assertSpiceStorageFits(ndim, bytesLength, "clearc()", arrlen);
      const bytesCopy = copySpiceStorage(
        bytes,
        bytesLength,
        "byte",
        "clearc(bytes)",
      );
      const out: unknown = native.clearc(ndim, arrlen, bytesCopy);
      return storageResult(out, bytesCopy.length, "byte", "clearc result");
    },
    cleard: (ndim, values) => {
      assertSpiceInt32(ndim, "cleard(ndim)");
      const valuesLength = spiceStorageLength(values, "cleard(values)");
      assertSpiceStorageFits(ndim, valuesLength, "cleard(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "double",
        "cleard(values)",
      );
      const out: unknown = native.cleard(ndim, valuesCopy);
      return storageResult(out, valuesCopy.length, "double", "cleard result");
    },
    cleari: (ndim, values) => {
      assertSpiceInt32(ndim, "cleari(ndim)");
      const valuesLength = spiceStorageLength(values, "cleari(values)");
      assertSpiceStorageFits(ndim, valuesLength, "cleari(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "int",
        "cleari(values)",
      );
      const out: unknown = native.cleari(ndim, valuesCopy);
      return storageResult(out, valuesCopy.length, "int", "cleari result");
    },
    filld: (value, ndim, values) => {
      if (typeof value !== "number")
        throw new TypeError("filld(value) must be a number");
      assertSpiceInt32(ndim, "filld(ndim)");
      const valuesLength = spiceStorageLength(values, "filld(values)");
      assertSpiceStorageFits(ndim, valuesLength, "filld(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "double",
        "filld(values)",
      );
      const out: unknown = native.filld(value, ndim, valuesCopy);
      return storageResult(out, valuesCopy.length, "double", "filld result");
    },
    filli: (value, ndim, values) => {
      assertSpiceInt32(value, "filli(value)");
      assertSpiceInt32(ndim, "filli(ndim)");
      const valuesLength = spiceStorageLength(values, "filli(values)");
      assertSpiceStorageFits(ndim, valuesLength, "filli(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "int",
        "filli(values)",
      );
      const out: unknown = native.filli(value, ndim, valuesCopy);
      return storageResult(out, valuesCopy.length, "int", "filli result");
    },
    moved: (source, ndim, destination) => {
      assertSpiceInt32(ndim, "moved(ndim)", { min: 0 });
      const sourceLength = spiceStorageLength(source, "moved(source)");
      const destinationLength = spiceStorageLength(
        destination,
        "moved(destination)",
      );
      assertSpiceStorageFits(ndim, sourceLength, "moved(source)");
      assertSpiceStorageFits(ndim, destinationLength, "moved(destination)");
      const sourceCopy = copySpiceStorage(
        source,
        sourceLength,
        "double",
        "moved(source)",
      );
      const destinationCopy = copySpiceStorage(
        destination,
        destinationLength,
        "double",
        "moved(destination)",
      );
      const out: unknown = native.moved(sourceCopy, ndim, destinationCopy);
      return storageResult(
        out,
        destinationCopy.length,
        "double",
        "moved result",
      );
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
