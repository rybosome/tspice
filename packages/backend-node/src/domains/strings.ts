import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
  snapshotSearchRows,
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

function finite(value: number, name: string): void {
  if (!Number.isFinite(value))
    throw new TypeError(name + " must be a finite number");
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
    dp2hx: (value, lenout) => {
      finite(value, "dp2hx value");
      const bound = 255;
      const capacity = spiceStringOutputCapacity(bound, 2, lenout);
      const result = native.dp2hx(value, capacity);
      if (
        !Number.isInteger(result.hxssiz) ||
        result.hxssiz < 1 ||
        result.hxssiz > 255
      )
        throw new TypeError("Invalid dp2hx size");
      return {
        hxstr: stringResult(result.hxstr, capacity),
        hxssiz: result.hxssiz,
      };
    },
    hx2dp: (input, lenout) => {
      spiceStringByteLength(input, "hx2dp input");
      const bound = 192;
      const capacity = spiceStringOutputCapacity(bound, 2, lenout);
      const result = native.hx2dp(input, capacity);
      const errmsg = stringResult(result.errmsg, capacity);
      if (result.error === true) return { error: true, errmsg };
      if (
        result.error !== false ||
        typeof result.number !== "number" ||
        errmsg !== ""
      )
        throw new TypeError("Invalid hx2dp result");
      return { error: false, number: result.number, errmsg };
    },
    prsdp: (input) => {
      spiceStringByteLength(input, "prsdp input");
      const result = native.prsdp(input);
      if (typeof result !== "number")
        throw new TypeError("Invalid prsdp result");
      return result;
    },
    prsint: (input) => {
      spiceStringByteLength(input, "prsint input");
      const result = native.prsint(input);
      assertSpiceInt32(result, "prsint result");
      return result;
    },
    repmc: (input, marker, value, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repmc input");
      spiceStringByteLength(marker, "repmc marker");
      const valueBytes = spiceStringByteLength(value, "repmc value");
      const bound = inputBytes + Math.max(1, valueBytes);
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      const result = native.repmc(input, marker, value, capacity);
      return stringResult(result, capacity);
    },
    repmct: (input, marker, value, rtcase, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repmct input");
      spiceStringByteLength(marker, "repmct marker");
      assertSpiceInt32(value, "repmct value");
      spiceAsciiChar(rtcase, "repmct rtcase");
      const bound = inputBytes + 145;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      const result = native.repmct(input, marker, value, rtcase, capacity);
      return stringResult(result, capacity);
    },
    repmd: (input, marker, value, sigdig, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repmd input");
      spiceStringByteLength(marker, "repmd marker");
      finite(value, "repmd value");
      assertSpiceInt32(sigdig, "repmd sigdig");
      const bound = inputBytes + 23;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      const result = native.repmd(input, marker, value, sigdig, capacity);
      return stringResult(result, capacity);
    },
    repmf: (input, marker, value, sigdig, format, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repmf input");
      spiceStringByteLength(marker, "repmf marker");
      finite(value, "repmf value");
      assertSpiceInt32(sigdig, "repmf sigdig");
      spiceAsciiChar(format, "repmf format");
      const bound = inputBytes + 56;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      const result = native.repmf(
        input,
        marker,
        value,
        sigdig,
        format,
        capacity,
      );
      return stringResult(result, capacity);
    },
    repmi: (input, marker, value, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repmi input");
      spiceStringByteLength(marker, "repmi marker");
      assertSpiceInt32(value, "repmi value");
      const bound = inputBytes + 11;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      const result = native.repmi(input, marker, value, capacity);
      return stringResult(result, capacity);
    },
    repml: (input, marker, value, rtcase, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repml input");
      spiceStringByteLength(marker, "repml marker");
      if (typeof value !== "boolean")
        throw new TypeError("repml value must be a boolean");
      spiceAsciiChar(rtcase, "repml rtcase");
      const bound = inputBytes + 5;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 2, lenout);
      const result = native.repml(input, marker, value, rtcase, capacity);
      return stringResult(result, capacity);
    },
    repmot: (input, marker, value, rtcase, lenout) => {
      const inputBytes = spiceStringByteLength(input, "repmot input");
      spiceStringByteLength(marker, "repmot marker");
      assertSpiceInt32(value, "repmot value");
      spiceAsciiChar(rtcase, "repmot rtcase");
      const bound = inputBytes + 147;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      const result = native.repmot(input, marker, value, rtcase, capacity);
      return stringResult(result, capacity);
    },
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
