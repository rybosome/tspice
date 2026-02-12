import { beforeAll, describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

let backend: Awaited<ReturnType<typeof createWasmBackend>>;

beforeAll(async () => {
  backend = await createWasmBackend();
}, 20_000);

describe("SPICE errors (wasm backend)", () => {
  it("throws a rich error containing a stable short code", () => {
    let err: unknown;
    try {
      // With no kernels loaded, this should reliably fail with NOLOADEDFILES.
      backend.spkezr("EARTH", 0, "J2000", "NONE", "SUN");
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(Error);
    const e = err as Error & {
      spiceShort?: string;
      spiceLong?: string;
      spiceTrace?: string;
    };

    expect(e.message).toContain("NOLOADEDFILES");
    expect(e.spiceShort).toContain("NOLOADEDFILES");
    expect(typeof e.spiceLong).toBe("string");
    expect(typeof e.spiceTrace).toBe("string");
  });

  it("preserves Found-style {found:false} behavior", () => {
    expect(backend.bodn2c("NOT_A_BODY")).toEqual({ found: false });
  });

  it("rejects invalid getmsg(which) selectors at the boundary", () => {
    expect(() => backend.getmsg("NOPE" as never)).toThrow(/getmsg\(which\)/i);
    expect(() => backend.getmsg("NOPE" as never)).toThrow(/SHORT|LONG|EXPLAIN/);
  });
});

describe("wasm lowlevel bindings", () => {
  type Module = {
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPU8: Uint8Array;
    UTF8ToString(ptr: number, maxBytes?: number): string;
    lengthBytesUTF8(s: string): number;
    stringToUTF8(s: string, ptr: number, maxBytes: number): void;

    _tspice_setmsg(messagePtr: number, errPtr: number, errMaxBytes: number): number;
    _tspice_sigerr(shortPtr: number, errPtr: number, errMaxBytes: number): number;
    _tspice_chkin(namePtr: number, errPtr: number, errMaxBytes: number): number;
    _tspice_reset(errPtr: number, errMaxBytes: number): number;
    _tspice_get_last_error_short(outPtr: number, outMaxBytes: number): number;
    _tspice_get_last_error_long(outPtr: number, outMaxBytes: number): number;
    _tspice_get_last_error_trace(outPtr: number, outMaxBytes: number): number;

    _tspice_ccifrm(
      frameClass: number,
      classId: number,
      outFrcodePtr: number,
      outFrnamePtr: number,
      outFrnameMaxBytes: number,
      outCenterPtr: number,
      outFoundPtr: number,
      errPtr: number,
      errMaxBytes: number,
    ): number;
  };

  let module: Module;
  const ERR_MAX_BYTES = 1841;

  const allocCString = (s: string) => {
    const maxBytes = module.lengthBytesUTF8(s) + 1;
    const ptr = module._malloc(maxBytes);
    module.stringToUTF8(s, ptr, maxBytes);
    return { ptr, maxBytes };
  };

  const readOut = (fn: (outPtr: number, outMaxBytes: number) => number) => {
    const outPtr = module._malloc(ERR_MAX_BYTES);
    try {
      module.HEAPU8[outPtr] = 0;
      fn(outPtr, ERR_MAX_BYTES);
      return module.UTF8ToString(outPtr, ERR_MAX_BYTES).trim();
    } finally {
      module._free(outPtr);
    }
  };

  beforeAll(async () => {
    const { default: createEmscriptenModule } = (await import(
      "../emscripten/tspice_backend_wasm.node.js"
    )) as {
      default: (opts: Record<string, unknown>) => Promise<unknown>;
    };

    const wasmUrl = new URL("../emscripten/tspice_backend_wasm.wasm", import.meta.url);
    const wasmBytes = await readFile(fileURLToPath(wasmUrl));
    const wasmBinary = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength,
    );

    module = (await createEmscriptenModule({
      locateFile(path: string, prefix: string) {
        if (path === "tspice_backend_wasm.wasm") {
          return wasmUrl.href;
        }
        return `${prefix}${path}`;
      },
      wasmBinary,
    })) as Module;
  }, 20_000);

  it("clears last-error short/long/trace after reset", () => {
    const errPtr = module._malloc(ERR_MAX_BYTES);
    try {
      module.HEAPU8[errPtr] = 0;
      expect(module._tspice_reset(errPtr, ERR_MAX_BYTES)).toBe(0);

      const { ptr: aPtr } = allocCString("A");
      const { ptr: bPtr } = allocCString("B");
      const { ptr: msgPtr } = allocCString("something went wrong");
      const { ptr: shortPtr } = allocCString("SPICE(FAKE)");
      try {
        expect(module._tspice_chkin(aPtr, errPtr, ERR_MAX_BYTES)).toBe(0);
        expect(module._tspice_chkin(bPtr, errPtr, ERR_MAX_BYTES)).toBe(0);
        expect(module._tspice_setmsg(msgPtr, errPtr, ERR_MAX_BYTES)).toBe(0);

        // Signaling an error sets the structured buffers and resets CSPICE status.
        expect(module._tspice_sigerr(shortPtr, errPtr, ERR_MAX_BYTES)).toBe(1);

        expect(readOut(module._tspice_get_last_error_short)).toContain("SPICE(FAKE)");
        expect(readOut(module._tspice_get_last_error_long)).toContain("something went wrong");
        expect(readOut(module._tspice_get_last_error_trace)).toContain("A");

        expect(module._tspice_reset(errPtr, ERR_MAX_BYTES)).toBe(0);

        expect(readOut(module._tspice_get_last_error_short)).toBe("");
        expect(readOut(module._tspice_get_last_error_long)).toBe("");
        expect(readOut(module._tspice_get_last_error_trace)).toBe("");
      } finally {
        module._free(aPtr);
        module._free(bPtr);
        module._free(msgPtr);
        module._free(shortPtr);
      }
    } finally {
      module._free(errPtr);
    }
  });

  it("ccifrm rejects undersized outFrname buffers", () => {
    const errPtr = module._malloc(ERR_MAX_BYTES);
    const outNameMaxBytes = 32;
    const outNamePtr = module._malloc(outNameMaxBytes);

    try {
      // Clear state so a previous SPICE failure doesn't affect this test.
      module.HEAPU8[errPtr] = 0;
      expect(module._tspice_reset(errPtr, ERR_MAX_BYTES)).toBe(0);

      // Fill with a non-NUL value to verify the preflight write is safe.
      module.HEAPU8[outNamePtr] = 65;

      const result = module._tspice_ccifrm(
        1,
        1,
        0,
        outNamePtr,
        outNameMaxBytes,
        0,
        0,
        errPtr,
        ERR_MAX_BYTES,
      );

      expect(result).toBe(1);
      expect(module.HEAPU8[outNamePtr]).toBe(0);

      const msg = module.UTF8ToString(errPtr, ERR_MAX_BYTES);
      expect(msg).toContain("outFrnameMaxBytes must be >= TSPICE_FRNAME_MAX_BYTES (33)");
    } finally {
      module._free(outNamePtr);
      module._free(errPtr);
    }
  });

});
