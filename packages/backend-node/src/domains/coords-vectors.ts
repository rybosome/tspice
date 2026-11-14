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

function assertPolynomialNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyPolynomialCoefficients(
  value: unknown,
  label: string,
  allowEmpty: boolean,
): number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 2147483647 ||
    (!allowEmpty && length === 0)
  )
    throw new RangeError(`${label} has an unsupported coefficient count`);
  // Coefficient getters must not be re-read during native/WASM marshaling.
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry: unknown = value[i];
    assertPolynomialNumber(entry, `${label}[${i}]`);
    result.push(entry);
  }
  return result;
}

function copyPolynomialTransform(
  value: unknown,
  label: string,
): [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`${label} must be a length-2 array`);
  const midpoint: unknown = value[0];
  const scale: unknown = value[1];
  assertPolynomialNumber(midpoint, `${label}[0]`);
  assertPolynomialNumber(scale, `${label}[1]`);
  return [midpoint, scale];
}

function polynomialDerivativeCount(nderiv: number, chebyshev: boolean): number {
  assertSpiceInt32(nderiv, "nderiv");
  if (
    (chebyshev && (nderiv < 0 || nderiv > 715827881)) ||
    (!chebyshev && nderiv > 2147483646)
  )
    throw new RangeError("nderiv exceeds the supported derivative order");
  return nderiv < 0 ? 0 : nderiv + 1;
}

function polynomialOutputNumber(value: unknown, label: string): number {
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
  return value;
}

function polynomialOutputArray(
  value: unknown,
  length: number,
  label: string,
): number[] {
  if (!Array.isArray(value) || value.length !== length)
    throw new TypeError(`${label} must be an array of length ${length}`);
  const result: number[] = [];
  for (let i = 0; i < length; i++)
    result.push(polynomialOutputNumber(value[i], `${label}[${i}]`));
  return result;
}

function polynomialOutputPair(value: unknown, label: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`${label} must be a length-2 array`);
  return [
    polynomialOutputNumber(value[0], `${label}[0]`),
    polynomialOutputNumber(value[1], `${label}[1]`),
  ];
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    chbder: (cp, x2s, x, nderiv) => {
      const outputCount = polynomialDerivativeCount(nderiv, true);
      const cpCopy = copyPolynomialCoefficients(cp, "chbder(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbder(x2s)");
      assertPolynomialNumber(x, "chbder(x)");
      const out: unknown = native.chbder(cpCopy, transform, x, nderiv);
      return polynomialOutputArray(out, outputCount, "chbder result");
    },
    chbigr: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbigr(cp)", true);
      const transform = copyPolynomialTransform(x2s, "chbigr(x2s)");
      assertPolynomialNumber(x, "chbigr(x)");
      const out: unknown = native.chbigr(cpCopy, transform, x);
      invariant(isPlainObject(out), "Expected chbigr() to return an object");
      return {
        p: polynomialOutputNumber(out.p, "chbigr().p"),
        itgrlp: polynomialOutputNumber(out.itgrlp, "chbigr().itgrlp"),
      };
    },
    chbint: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbint(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbint(x2s)");
      assertPolynomialNumber(x, "chbint(x)");
      const out: unknown = native.chbint(cpCopy, transform, x);
      invariant(isPlainObject(out), "Expected chbint() to return an object");
      return {
        p: polynomialOutputNumber(out.p, "chbint().p"),
        dpdx: polynomialOutputNumber(out.dpdx, "chbint().dpdx"),
      };
    },
    chbval: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbval(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbval(x2s)");
      assertPolynomialNumber(x, "chbval(x)");
      const out: unknown = native.chbval(cpCopy, transform, x);
      return polynomialOutputNumber(out, "chbval result");
    },
    polyds: (coeffs, nderiv, t) => {
      const outputCount = polynomialDerivativeCount(nderiv, false);
      const coeffsCopy = copyPolynomialCoefficients(
        coeffs,
        "polyds(coeffs)",
        true,
      );
      assertPolynomialNumber(t, "polyds(t)");
      const out: unknown = native.polyds(coeffsCopy, nderiv, t);
      return polynomialOutputArray(out, outputCount, "polyds result");
    },
    rquad: (a, b, c) => {
      assertPolynomialNumber(a, "rquad(a)");
      assertPolynomialNumber(b, "rquad(b)");
      assertPolynomialNumber(c, "rquad(c)");
      const out: unknown = native.rquad(a, b, c);
      invariant(isPlainObject(out), "Expected rquad() to return an object");
      return {
        root1: polynomialOutputPair(out.root1, "rquad().root1"),
        root2: polynomialOutputPair(out.root2, "rquad().root2"),
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
