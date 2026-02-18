import { describe, expect, it } from "vitest";

type Assert<T extends true> = T;
type AssertFalse<T extends false> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type Tspice = typeof import("@rybosome/tspice");

// --- public export surface ---

type _HasSpiceClients = Assert<HasKey<Tspice, "spiceClients">>;
type _HasKernels = Assert<HasKey<Tspice, "kernels">>;

type _NoCreateBackend = AssertFalse<HasKey<Tspice, "createBackend">>;
type _NoCreateSpice = AssertFalse<HasKey<Tspice, "createSpice">>;
type _NoCreateSpiceAsync = AssertFalse<HasKey<Tspice, "createSpiceAsync">>;
type _NoResolveKernelUrl = AssertFalse<HasKey<Tspice, "resolveKernelUrl">>;

// --- removed option types should not be exported from the package root ---

// @ts-expect-error `CreateBackendOptions` is internal-only.
type _NoCreateBackendOptions = import("@rybosome/tspice").CreateBackendOptions;
// @ts-expect-error `CreateSpiceOptions` is internal-only.
type _NoCreateSpiceOptions = import("@rybosome/tspice").CreateSpiceOptions;
// @ts-expect-error `CreateSpiceAsyncOptions` is internal-only.
type _NoCreateSpiceAsyncOptions = import("@rybosome/tspice").CreateSpiceAsyncOptions;

// --- key public types should remain exported ---
type _KernelPackIsExported = import("@rybosome/tspice").KernelPack;
type _KernelSourceIsExported = import("@rybosome/tspice").KernelSource;
type _SpiceBackendIsExported = import("@rybosome/tspice").SpiceBackend;
type _SpiceIsExported = import("@rybosome/tspice").Spice;
type _SpiceAsyncIsExported = import("@rybosome/tspice").SpiceAsync;

// --- spiceClients builder contracts ---
type SpiceClientsBuilder = Tspice["spiceClients"];
type SyncClient = Awaited<ReturnType<SpiceClientsBuilder["toSync"]>>;
type AsyncClient = Awaited<ReturnType<SpiceClientsBuilder["toAsync"]>>;

type SyncSpice = SyncClient["spice"];
type AsyncSpice = AsyncClient["spice"];

type _SyncClientHasSpice = Assert<HasKey<SyncClient, "spice">>;
type _SyncClientHasDispose = Assert<HasKey<SyncClient, "dispose">>;
type _SyncSpiceHasRaw = Assert<HasKey<SyncSpice, "raw">>;
type _SyncSpiceHasKit = Assert<HasKey<SyncSpice, "kit">>;
type _SyncSpiceHasNoFurnsh = AssertFalse<HasKey<SyncSpice, "furnsh">>;

type KeysEqual<A extends object, B extends object> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;

type _AsyncSpiceHasRaw = Assert<HasKey<AsyncSpice, "raw">>;
type _AsyncSpiceHasKit = Assert<HasKey<AsyncSpice, "kit">>;
type _AsyncSpiceHasNoFurnsh = AssertFalse<HasKey<AsyncSpice, "furnsh">>;
type _AsyncRawKeysMatch = Assert<KeysEqual<AsyncSpice["raw"], SyncSpice["raw"]>>;
type _AsyncKitKeysMatch = Assert<KeysEqual<AsyncSpice["kit"], SyncSpice["kit"]>>;

// Spot-check a few async return types.
type _AsyncToolkitVersionReturnsPromise = Assert<
  ReturnType<AsyncSpice["kit"]["toolkitVersion"]> extends Promise<string> ? true : false
>;
type _AsyncKtotalReturnsPromise = Assert<
  ReturnType<AsyncSpice["raw"]["ktotal"]> extends Promise<number> ? true : false
>;
type _AsyncRawKindIsNotPromise = AssertFalse<
  AsyncSpice["raw"]["kind"] extends Promise<unknown> ? true : false
>;

describe("TypeScript type assertions", () => {
  it("compiles", () => {
    expect(true).toBe(true);
  });
});
