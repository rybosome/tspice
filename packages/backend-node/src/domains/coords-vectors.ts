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

function assertFixedMatrixScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function assertFixedMatrix2(
  value: unknown,
): asserts value is readonly [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4)
    throw new TypeError(
      "diags2(symmat) must contain exactly four finite numbers",
    );
  for (let i = 0; i < 4; i++)
    assertFixedMatrixScalar(value[i], `diags2(symmat)[${i}]`);
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
    det: (m) => {
      assertMat3ArrayLike9(m, { label: "det(m)" });
      const out = native.det(Array.from(m));
      return fixedMatrixOutputNumber(out, "det result");
    },
    diags2: (symmat) => {
      assertFixedMatrix2(symmat);
      const out = native.diags2(symmat);
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
      assertMat3ArrayLike9(m, { label: "invert(m)" });
      const out = native.invert(Array.from(m));
      return brandMat3RowMajorResult(out, { label: "invert result" });
    },
    invort: (m) => {
      assertMat3ArrayLike9(m, { label: "invort(m)" });
      const out = native.invort(Array.from(m));
      return brandMat3RowMajorResult(out, { label: "invort result" });
    },
    isrot: (m, ntol, dtol) => {
      assertMat3ArrayLike9(m, { label: "isrot(m)" });
      assertFixedMatrixScalar(ntol, "isrot(ntol)");
      assertFixedMatrixScalar(dtol, "isrot(dtol)");
      const out = native.isrot(Array.from(m), ntol, dtol);
      if (typeof out !== "boolean")
        throw new TypeError("isrot result must be a boolean");
      return out;
    },
    mequ: (m) => {
      assertMat3ArrayLike9(m, { label: "mequ(m)" });
      const out = native.mequ(Array.from(m));
      return brandMat3RowMajorResult(out, { label: "mequ result" });
    },
    mtxm: (a, b) => {
      assertMat3ArrayLike9(a, { label: "mtxm(a)" });
      assertMat3ArrayLike9(b, { label: "mtxm(b)" });
      const out = native.mtxm(Array.from(a), Array.from(b));
      return brandMat3RowMajorResult(out, { label: "mtxm result" });
    },
    mxmt: (a, b) => {
      assertMat3ArrayLike9(a, { label: "mxmt(a)" });
      assertMat3ArrayLike9(b, { label: "mxmt(b)" });
      const out = native.mxmt(Array.from(a), Array.from(b));
      return brandMat3RowMajorResult(out, { label: "mxmt result" });
    },
    trace: (m) => {
      assertMat3ArrayLike9(m, { label: "trace(m)" });
      const out = native.trace(Array.from(m));
      return fixedMatrixOutputNumber(out, "trace result");
    },
    xpose: (m) => {
      assertMat3ArrayLike9(m, { label: "xpose(m)" });
      const out = native.xpose(Array.from(m));
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
