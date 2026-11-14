import type {
  CoordsVectorsApi,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import {
  orderDoubles,
  orderIntegers,
  orderLogicals,
  orderPermutation,
  orderRows,
  readOrderRows,
  sortedNumericInputs,
  sortedCharacterInputs,
  sortedBoundResult,
  assertMat3ArrayLike9,
  assertSpiceInt32,
  brandMat3RowMajor,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Create a {@link CoordsVectorsApi} implementation backed by the native Node addon. */
export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    isordv(order) {
      const input = orderIntegers(order);
      const result = native.isordv(input);
      invariant(typeof result === "boolean", "Invalid order predicate result");
      return result;
    },
    orderc(values) {
      const { bytes: input, width, count } = orderRows(values, true);
      const result = native.orderc(width, input);
      invariant(
        result instanceof Int32Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    orderd(values) {
      const input = orderDoubles(values);
      const count = input.length;
      const result = native.orderd(input);
      invariant(
        result instanceof Int32Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    orderi(values) {
      const input = orderIntegers(values);
      const count = input.length;
      const result = native.orderi(input);
      invariant(
        result instanceof Int32Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    reordc(order, values) {
      const { bytes: input, width, count } = orderRows(values, false);
      const indices = orderPermutation(order, count);
      const result = native.reordc(indices, width, input);
      return readOrderRows(result, width, count);
    },
    reordd(order, values) {
      const input = orderDoubles(values);
      const count = input.length;
      const indices = orderPermutation(order, count);
      const result = native.reordd(indices, input);
      invariant(
        result instanceof Float64Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    reordi(order, values) {
      const input = orderIntegers(values);
      const count = input.length;
      const indices = orderPermutation(order, count);
      const result = native.reordi(indices, input);
      invariant(
        result instanceof Int32Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    reordl(order, values) {
      const input = orderLogicals(values);
      const count = input.length;
      const indices = orderPermutation(order, count);
      const result = native.reordl(indices, input);
      invariant(
        result instanceof Int32Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result, (v) => Boolean(v));
    },
    shellc(values) {
      const { bytes: input, width, count } = orderRows(values, false);
      const result = native.shellc(width, input);
      return readOrderRows(result, width, count);
    },
    shelld(values) {
      const input = orderDoubles(values);
      const count = input.length;
      const result = native.shelld(input);
      invariant(
        result instanceof Float64Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    shelli(values) {
      const input = orderIntegers(values);
      const count = input.length;
      const result = native.shelli(input);
      invariant(
        result instanceof Int32Array && result.length === count,
        "Invalid native output array",
      );
      return Array.from(result);
    },
    lstlec: (key, values) => {
      const input = sortedCharacterInputs(key, values);
      return sortedBoundResult(
        native.lstlec(key, input.rows),
        input.rows.length,
      );
    },
    lstled: (key, values) => {
      const input = sortedNumericInputs(key, values, "double");
      return sortedBoundResult(
        native.lstled(input.key, input.values),
        input.values.length,
      );
    },
    lstlei: (key, values) => {
      const input = sortedNumericInputs(key, values, "int");
      return sortedBoundResult(
        native.lstlei(input.key, input.values),
        input.values.length,
      );
    },
    lstltc: (key, values) => {
      const input = sortedCharacterInputs(key, values);
      return sortedBoundResult(
        native.lstltc(key, input.rows),
        input.rows.length,
      );
    },
    lstltd: (key, values) => {
      const input = sortedNumericInputs(key, values, "double");
      return sortedBoundResult(
        native.lstltd(input.key, input.values),
        input.values.length,
      );
    },
    lstlti: (key, values) => {
      const input = sortedNumericInputs(key, values, "int");
      return sortedBoundResult(
        native.lstlti(input.key, input.values),
        input.values.length,
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
