import { createBackend, createSpice } from "@rybosome/tspice";
import { describe, expect, it } from "vitest";

type Assert<T extends true> = T;
type AssertFalse<T extends false> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type Backend = Awaited<ReturnType<typeof createBackend>>;
type Spice = Awaited<ReturnType<typeof createSpice>>;

// --- createBackend() contract ---

type BackendKind = Parameters<typeof createBackend>[0]["backend"];
type _CreateBackendKindIsSupported = Assert<BackendKind extends "node" | "wasm" ? true : false>;
type _CreateBackendKindDoesNotIncludeFake = AssertFalse<"fake" extends BackendKind ? true : false>;

// WASM-only helpers are intentionally not part of the public `SpiceBackend` type.
type _BackendHasNoLoadKernel = AssertFalse<HasKey<Backend, "loadKernel">>;
type _BackendHasNoWriteFile = AssertFalse<HasKey<Backend, "writeFile">>;

// Spot-check some return types to catch accidental type regressions.
type SubpntResult = ReturnType<Backend["subpnt"]>;
type _SubpntHasFields = Assert<
  HasKey<SubpntResult, "spoint"> extends true
    ? HasKey<SubpntResult, "trgepc"> extends true
      ? HasKey<SubpntResult, "srfvec"> extends true
        ? true
        : false
      : false
    : false
>;

type SincptResult = ReturnType<Backend["sincpt"]>;
type SincptFound = Extract<SincptResult, { found: true }>;
type _SincptFoundHasFields = Assert<
  HasKey<SincptFound, "spoint"> extends true
    ? HasKey<SincptFound, "trgepc"> extends true
      ? HasKey<SincptFound, "srfvec"> extends true
        ? true
        : false
      : false
    : false
>;

type IlluminResult = ReturnType<Backend["ilumin"]>;
type _IluminHasFields = Assert<
  HasKey<IlluminResult, "phase"> extends true
    ? HasKey<IlluminResult, "incdnc"> extends true
      ? HasKey<IlluminResult, "emissn"> extends true
        ? true
        : false
      : false
    : false
>;

type OccultResult = ReturnType<Backend["occult"]>;
type _OccultReturnsNumber = Assert<OccultResult extends number ? true : false>;

// --- createSpice() contract ---

type _SpiceHasRaw = Assert<HasKey<Spice, "raw">>;
type _SpiceHasKit = Assert<HasKey<Spice, "kit">>;

// No flattening onto the top-level.
type _SpiceHasNoFurnsh = AssertFalse<HasKey<Spice, "furnsh">>;

// Kit API surface.
type Kit = Spice["kit"];
type _KitHasLoadKernel = Assert<HasKey<Kit, "loadKernel">>;
type _KitHasUnloadKernel = Assert<HasKey<Kit, "unloadKernel">>;
type _KitHasUtcToEt = Assert<HasKey<Kit, "utcToEt">>;
type _KitHasGetState = Assert<HasKey<Kit, "getState">>;

describe("TypeScript type assertions", () => {
  it("compiles", () => {
    expect(true).toBe(true);
  });
});
