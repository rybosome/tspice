import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
  spiceStringByteLength,
  spiceStringOutputCapacity,
  spiceTokenTable,
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

function assertTokenRecord(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Expected a native token result");
}

function scanResult(
  value: unknown,
  first: number,
  inputBytes: number,
  emptyLast: number,
): { last: number; nchar: number } {
  assertTokenRecord(value);
  const { last, nchar } = value;
  const miss = inputBytes === 0 ? emptyLast : first - 1;
  if (
    typeof last !== "number" ||
    !Number.isInteger(last) ||
    typeof nchar !== "number" ||
    !Number.isInteger(nchar) ||
    (nchar === 0
      ? last !== miss
      : nchar < 0 ||
        first < 0 ||
        last < first ||
        last >= inputBytes ||
        // LX4DEC and LX4NUM can report one fewer byte than the inclusive
        // span for signed mantissas beginning with a decimal point.
        nchar > last - first + 1)
  )
    throw new TypeError("Invalid native byte span");
  return { last, nchar };
}

function listResult(
  value: unknown,
  count: number,
  width: number,
): { n: number; items: string[] } {
  assertTokenRecord(value);
  const { n, items } = value;
  if (
    typeof n !== "number" ||
    !Number.isInteger(n) ||
    n < 0 ||
    n > Math.max(0, count) ||
    !Array.isArray(items) ||
    items.length !== n
  )
    throw new TypeError("Invalid native token count");
  return {
    n,
    items: Array.from(items, (item: unknown) => stringResult(item, width)),
  };
}

/** Create the raw string API backed by the native CSPICE addon. */
export function createStringsApi(native: NativeAddon): StringsApi {
  return {
    nextwd: (input, nexlen, reslen) => {
      const inputBytes = spiceStringByteLength(
        input,
        "nextwd(input)",
        2147483645,
      );
      const nextCap = spiceStringOutputCapacity(inputBytes, 2, nexlen);
      const restCap = spiceStringOutputCapacity(inputBytes, 2, reslen);
      const result: unknown = native.nextwd(input, nextCap, restCap);
      assertTokenRecord(result);
      return {
        next: stringResult(result.next, nextCap),
        rest: stringResult(result.rest, restCap),
      };
    },
    nthwd: (input, nth, worlen) => {
      const inputBytes = spiceStringByteLength(
        input,
        "nthwd(input)",
        2147483645,
      );
      assertSpiceInt32(nth, "nth");
      const wordCap = spiceStringOutputCapacity(inputBytes, 2, worlen);
      const result: unknown = native.nthwd(input, nth, wordCap);
      assertTokenRecord(result);
      const loc = result.loc;
      if (
        typeof loc !== "number" ||
        !Number.isInteger(loc) ||
        loc < -1 ||
        loc >= inputBytes
      )
        throw new TypeError("Invalid native word byte index");
      return { word: stringResult(result.word, wordCap), loc };
    },
    lparse: (list, delim, nmax, itemln) => {
      const inputBytes = spiceStringByteLength(
        list,
        "lparse(list)",
        2147483645,
      );
      spiceStringByteLength(delim, "lparse(delim)");
      const table = spiceTokenTable(inputBytes, nmax, itemln);
      return listResult(
        native.lparse(list, delim, table.count, table.width),
        table.count,
        table.width,
      );
    },
    lparsm: (list, delims, nmax, itemln) => {
      const inputBytes = spiceStringByteLength(
        list,
        "lparsm(list)",
        2147483645,
      );
      spiceStringByteLength(delims, "lparsm(delims)");
      const table = spiceTokenTable(inputBytes, nmax, itemln);
      return listResult(
        native.lparsm(list, delims, table.count, table.width),
        table.count,
        table.width,
      );
    },
    lx4dec: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4dec(input)",
        2147483645,
      );
      assertSpiceInt32(first, "first");
      return scanResult(native.lx4dec(input, first), first, inputBytes, -1);
    },
    lx4num: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4num(input)",
        2147483645,
      );
      assertSpiceInt32(first, "first");
      return scanResult(native.lx4num(input, first), first, inputBytes, -1);
    },
    lx4sgn: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4sgn(input)",
        2147483645,
      );
      assertSpiceInt32(first, "first");
      return scanResult(native.lx4sgn(input, first), first, inputBytes, -1);
    },
    lx4uns: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4uns(input)",
        2147483645,
      );
      assertSpiceInt32(first, "first");
      return scanResult(
        native.lx4uns(input, first),
        first,
        inputBytes,
        first - 1,
      );
    },
    lxqstr: (input, qchar, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lxqstr(input)",
        2147483645,
      );
      spiceAsciiChar(qchar, "qchar");
      assertSpiceInt32(first, "first");
      return scanResult(
        native.lxqstr(input, qchar, first),
        first,
        inputBytes,
        first - 1,
      );
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
