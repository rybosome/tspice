import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
  snapshotSearchRows,
  spiceStringByteLength,
  spiceStringOutputCapacity,
} from "@rybosome/tspice-core";
import type { NativeAddon } from "../runtime/addon.js";

function stringResult(value: unknown, capacity: number): string {
  if (typeof value !== "string")
    throw new TypeError("Expected a native string result");
  spiceStringByteLength(value, "native result", capacity - 1);
  return value;
}

function booleanResult(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new TypeError("Expected a native boolean result");
  return value;
}

function searchIndex(value: unknown, limit: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < -1 ||
    value >= limit
  )
    throw new TypeError("Invalid native search index");
  return value;
}

/** Create the raw string API backed by the native CSPICE addon. */
export function createStringsApi(native: NativeAddon): StringsApi {
  return {
    cpos: (text, chars, start) => {
      const bytes = spiceStringByteLength(text, "cpos(text)");
      spiceStringByteLength(chars, "cpos(chars)");
      assertSpiceInt32(start, "cpos(start)");
      return searchIndex(native.cpos(text, chars, start), bytes);
    },
    cposr: (text, chars, start) => {
      const bytes = spiceStringByteLength(text, "cposr(text)");
      spiceStringByteLength(chars, "cposr(chars)");
      assertSpiceInt32(start, "cposr(start)");
      return searchIndex(native.cposr(text, chars, start), bytes);
    },
    ncpos: (text, chars, start) => {
      const bytes = spiceStringByteLength(text, "ncpos(text)");
      spiceStringByteLength(chars, "ncpos(chars)");
      assertSpiceInt32(start, "ncpos(start)");
      return searchIndex(native.ncpos(text, chars, start), bytes);
    },
    ncposr: (text, chars, start) => {
      const bytes = spiceStringByteLength(text, "ncposr(text)");
      spiceStringByteLength(chars, "ncposr(chars)");
      assertSpiceInt32(start, "ncposr(start)");
      return searchIndex(native.ncposr(text, chars, start), bytes);
    },
    pos: (text, substr, start) => {
      const bytes = spiceStringByteLength(text, "pos(text)");
      spiceStringByteLength(substr, "pos(substr)");
      assertSpiceInt32(start, "pos(start)");
      return searchIndex(native.pos(text, substr, start), bytes);
    },
    posr: (text, substr, start) => {
      const bytes = spiceStringByteLength(text, "posr(text)");
      spiceStringByteLength(substr, "posr(substr)");
      assertSpiceInt32(start, "posr(start)");
      return searchIndex(native.posr(text, substr, start), bytes);
    },
    esrchc: (value, values) => {
      spiceStringByteLength(value, "esrchc(value)");
      const { rows } = snapshotSearchRows(values);
      return searchIndex(native.esrchc(value, rows), rows.length);
    },
    cmprss: (delim, n, input, lenout) => {
      spiceAsciiChar(delim, "cmprss(delim)");
      assertSpiceInt32(n, "cmprss(n)");
      const inputBytes = spiceStringByteLength(input, "cmprss(input)");
      const capacity = spiceStringOutputCapacity(inputBytes, 1, lenout);
      return stringResult(native.cmprss(delim, n, input, capacity), capacity);
    },
    eqstr: (a, b) => {
      spiceStringByteLength(a, "eqstr(a)");
      spiceStringByteLength(b, "eqstr(b)");
      return booleanResult(native.eqstr(a, b));
    },
    iswhsp: (input) => {
      spiceStringByteLength(input, "iswhsp(input)");
      return booleanResult(native.iswhsp(input));
    },
    lastnb: (input) => {
      const inputBytes = spiceStringByteLength(input, "lastnb(input)");
      const index: unknown = native.lastnb(input);
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < -1 ||
        index >= inputBytes
      )
        throw new TypeError("Invalid native lastnb byte index");
      return index;
    },
    lcase: (input, lenout) => {
      const inputBytes = spiceStringByteLength(input, "lcase(input)");
      const capacity = spiceStringOutputCapacity(inputBytes, 2, lenout);
      return stringResult(native.lcase(input, capacity), capacity);
    },
    ucase: (input, lenout) => {
      const inputBytes = spiceStringByteLength(input, "ucase(input)");
      const capacity = spiceStringOutputCapacity(inputBytes, 2, lenout);
      return stringResult(native.ucase(input, capacity), capacity);
    },
    matchi: (input, templ, wstr, wchr) => {
      spiceStringByteLength(input, "matchi(input)");
      spiceStringByteLength(templ, "matchi(templ)");
      spiceAsciiChar(wstr, "matchi(wstr)");
      spiceAsciiChar(wchr, "matchi(wchr)");
      return booleanResult(native.matchi(input, templ, wstr, wchr));
    },
    matchw: (input, templ, wstr, wchr) => {
      spiceStringByteLength(input, "matchw(input)");
      spiceStringByteLength(templ, "matchw(templ)");
      spiceAsciiChar(wstr, "matchw(wstr)");
      spiceAsciiChar(wchr, "matchw(wchr)");
      return booleanResult(native.matchw(input, templ, wstr, wchr));
    },
  };
}
