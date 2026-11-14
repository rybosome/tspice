import type {
  CoordsVectorsApi,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import {
  assertMat3ArrayLike9,
  assertSpiceInt32,
  brandMat3RowMajor,
  brandMat3RowMajorResult,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jacobianBody(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw new TypeError("Expected a UTF-8 representable NUL-free body name");
  return value;
}

function jacobianFlag(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new TypeError("Expected a boolean direction flag");
  return value;
}

function assertFixedMatrixScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyFixedMatrix2(value: unknown): [number, number, number, number] {
  const label = "diags2(symmat)";
  if (!Array.isArray(value) || value.length !== 4)
    throw new TypeError(`${label} must contain exactly four finite numbers`);
  // The exact entries validated here are also the ones passed to the backend.
  const entry = (i: number): number => {
    const component: unknown = value[i];
    assertFixedMatrixScalar(component, `${label}[${i}]`);
    return component;
  };
  return [entry(0), entry(1), entry(2), entry(3)];
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
    assertFixedMatrixScalar(component, `${label}[${i}]`);
    copy.push(component);
  }
  return copy;
}

function fixedMatrixOutputNumber(value: unknown, label: string): number {
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function fixedMatrix2Output(
  value: unknown,
  label: string,
): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4)
    throw new TypeError(`${label} must contain exactly four numbers`);
  return [
    fixedMatrixOutputNumber(value[0], label),
    fixedMatrixOutputNumber(value[1], label),
    fixedMatrixOutputNumber(value[2], label),
    fixedMatrixOutputNumber(value[3], label),
  ];
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    dazldr: (x, y, z, azccw, elplsz) => {
      assertFixedMatrixScalar(x, "dazldr(x)");
      assertFixedMatrixScalar(y, "dazldr(y)");
      assertFixedMatrixScalar(z, "dazldr(z)");
      return brandMat3RowMajorResult(
        native.dazldr(x, y, z, jacobianFlag(azccw), jacobianFlag(elplsz)),
        { label: "dazldr result" },
      );
    },
    dcyldr: (x, y, z) => {
      assertFixedMatrixScalar(x, "dcyldr(x)");
      assertFixedMatrixScalar(y, "dcyldr(y)");
      assertFixedMatrixScalar(z, "dcyldr(z)");
      return brandMat3RowMajorResult(native.dcyldr(x, y, z), {
        label: "dcyldr result",
      });
    },
    dgeodr: (x, y, z, re, f) => {
      assertFixedMatrixScalar(x, "dgeodr(x)");
      assertFixedMatrixScalar(y, "dgeodr(y)");
      assertFixedMatrixScalar(z, "dgeodr(z)");
      assertFixedMatrixScalar(re, "dgeodr(re)");
      assertFixedMatrixScalar(f, "dgeodr(f)");
      return brandMat3RowMajorResult(native.dgeodr(x, y, z, re, f), {
        label: "dgeodr result",
      });
    },
    dlatdr: (x, y, z) => {
      assertFixedMatrixScalar(x, "dlatdr(x)");
      assertFixedMatrixScalar(y, "dlatdr(y)");
      assertFixedMatrixScalar(z, "dlatdr(z)");
      return brandMat3RowMajorResult(native.dlatdr(x, y, z), {
        label: "dlatdr result",
      });
    },
    dpgrdr: (body, x, y, z, re, f) => {
      assertFixedMatrixScalar(x, "dpgrdr(x)");
      assertFixedMatrixScalar(y, "dpgrdr(y)");
      assertFixedMatrixScalar(z, "dpgrdr(z)");
      assertFixedMatrixScalar(re, "dpgrdr(re)");
      assertFixedMatrixScalar(f, "dpgrdr(f)");
      return brandMat3RowMajorResult(
        native.dpgrdr(jacobianBody(body), x, y, z, re, f),
        { label: "dpgrdr result" },
      );
    },
    drdazl: (range, az, el, azccw, elplsz) => {
      assertFixedMatrixScalar(range, "drdazl(range)");
      assertFixedMatrixScalar(az, "drdazl(az)");
      assertFixedMatrixScalar(el, "drdazl(el)");
      return brandMat3RowMajorResult(
        native.drdazl(range, az, el, jacobianFlag(azccw), jacobianFlag(elplsz)),
        { label: "drdazl result" },
      );
    },
    drdcyl: (radius, lon, z) => {
      assertFixedMatrixScalar(radius, "drdcyl(radius)");
      assertFixedMatrixScalar(lon, "drdcyl(lon)");
      assertFixedMatrixScalar(z, "drdcyl(z)");
      return brandMat3RowMajorResult(native.drdcyl(radius, lon, z), {
        label: "drdcyl result",
      });
    },
    drdgeo: (lon, lat, alt, re, f) => {
      assertFixedMatrixScalar(lon, "drdgeo(lon)");
      assertFixedMatrixScalar(lat, "drdgeo(lat)");
      assertFixedMatrixScalar(alt, "drdgeo(alt)");
      assertFixedMatrixScalar(re, "drdgeo(re)");
      assertFixedMatrixScalar(f, "drdgeo(f)");
      return brandMat3RowMajorResult(native.drdgeo(lon, lat, alt, re, f), {
        label: "drdgeo result",
      });
    },
    drdlat: (radius, lon, lat) => {
      assertFixedMatrixScalar(radius, "drdlat(radius)");
      assertFixedMatrixScalar(lon, "drdlat(lon)");
      assertFixedMatrixScalar(lat, "drdlat(lat)");
      return brandMat3RowMajorResult(native.drdlat(radius, lon, lat), {
        label: "drdlat result",
      });
    },
    drdpgr: (body, lon, lat, alt, re, f) => {
      assertFixedMatrixScalar(lon, "drdpgr(lon)");
      assertFixedMatrixScalar(lat, "drdpgr(lat)");
      assertFixedMatrixScalar(alt, "drdpgr(alt)");
      assertFixedMatrixScalar(re, "drdpgr(re)");
      assertFixedMatrixScalar(f, "drdpgr(f)");
      return brandMat3RowMajorResult(
        native.drdpgr(jacobianBody(body), lon, lat, alt, re, f),
        { label: "drdpgr result" },
      );
    },
    drdsph: (radius, colat, lon) => {
      assertFixedMatrixScalar(radius, "drdsph(radius)");
      assertFixedMatrixScalar(colat, "drdsph(colat)");
      assertFixedMatrixScalar(lon, "drdsph(lon)");
      return brandMat3RowMajorResult(native.drdsph(radius, colat, lon), {
        label: "drdsph result",
      });
    },
    dsphdr: (x, y, z) => {
      assertFixedMatrixScalar(x, "dsphdr(x)");
      assertFixedMatrixScalar(y, "dsphdr(y)");
      assertFixedMatrixScalar(z, "dsphdr(z)");
      return brandMat3RowMajorResult(native.dsphdr(x, y, z), {
        label: "dsphdr result",
      });
    },
    det: (m) => {
      const mCopy = copyMatrixInput(m, "det(m)");
      const out = native.det(mCopy);
      return fixedMatrixOutputNumber(out, "det result");
    },
    diags2: (symmat) => {
      const symmatCopy = copyFixedMatrix2(symmat);
      const out = native.diags2(symmatCopy);
      if (!isPlainObject(out))
        throw new TypeError("diags2 result must be an object");
      return {
        diag: fixedMatrix2Output(out.diag, "diags2 result.diag"),
        rotate: fixedMatrix2Output(out.rotate, "diags2 result.rotate"),
      };
    },
    ident: () => {
      const out = native.ident();
      return brandMat3RowMajorResult(out, { label: "ident result" });
    },
    invert: (m) => {
      const mCopy = copyMatrixInput(m, "invert(m)");
      const out = native.invert(mCopy);
      return brandMat3RowMajorResult(out, { label: "invert result" });
    },
    invort: (m) => {
      const mCopy = copyMatrixInput(m, "invort(m)");
      const out = native.invort(mCopy);
      return brandMat3RowMajorResult(out, { label: "invort result" });
    },
    isrot: (m, ntol, dtol) => {
      const mCopy = copyMatrixInput(m, "isrot(m)");
      assertFixedMatrixScalar(ntol, "isrot(ntol)");
      assertFixedMatrixScalar(dtol, "isrot(dtol)");
      const out = native.isrot(mCopy, ntol, dtol);
      if (typeof out !== "boolean")
        throw new TypeError("isrot result must be a boolean");
      return out;
    },
    mequ: (m) => {
      const mCopy = copyMatrixInput(m, "mequ(m)");
      const out = native.mequ(mCopy);
      return brandMat3RowMajorResult(out, { label: "mequ result" });
    },
    mtxm: (a, b) => {
      const aCopy = copyMatrixInput(a, "mtxm(a)");
      const bCopy = copyMatrixInput(b, "mtxm(b)");
      const out = native.mtxm(aCopy, bCopy);
      return brandMat3RowMajorResult(out, { label: "mtxm result" });
    },
    mxmt: (a, b) => {
      const aCopy = copyMatrixInput(a, "mxmt(a)");
      const bCopy = copyMatrixInput(b, "mxmt(b)");
      const out = native.mxmt(aCopy, bCopy);
      return brandMat3RowMajorResult(out, { label: "mxmt result" });
    },
    trace: (m) => {
      const mCopy = copyMatrixInput(m, "trace(m)");
      const out = native.trace(mCopy);
      return fixedMatrixOutputNumber(out, "trace result");
    },
    xpose: (m) => {
      const mCopy = copyMatrixInput(m, "xpose(m)");
      const out = native.xpose(mCopy);
      return brandMat3RowMajorResult(out, { label: "xpose result" });
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
