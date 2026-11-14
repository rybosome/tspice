import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
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

function finite(value: number, name: string): void {
  if (!Number.isFinite(value))
    throw new TypeError(name + " must be a finite number");
}

/** Create the raw string API backed by the native CSPICE addon. */
export function createStringsApi(native: NativeAddon): StringsApi {
  return {
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
