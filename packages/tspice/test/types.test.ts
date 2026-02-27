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
type _NoAssertMat3ArrayLike9 = AssertFalse<HasKey<Tspice, "assertMat3ArrayLike9">>;
type _NoIsMat3ArrayLike9 = AssertFalse<HasKey<Tspice, "isMat3ArrayLike9">>;
type _NoBrandMat3ColMajor = AssertFalse<HasKey<Tspice, "brandMat3ColMajor">>;
type _NoBrandMat3RowMajor = AssertFalse<HasKey<Tspice, "brandMat3RowMajor">>;
type _NoIsBrandedMat3ColMajor = AssertFalse<HasKey<Tspice, "isBrandedMat3ColMajor">>;
type _NoIsBrandedMat3RowMajor = AssertFalse<HasKey<Tspice, "isBrandedMat3RowMajor">>;
type _NoTspiceKernelIds = AssertFalse<HasKey<Tspice, "TSPICE_KERNEL_IDS">>;

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

// Moved helpers: hidden on `raw`, exposed on `kit`.
type _RawHidesNewIntCell = AssertFalse<HasKey<SyncSpice["raw"], "newIntCell">>;
type _RawHidesNewDoubleCell = AssertFalse<HasKey<SyncSpice["raw"], "newDoubleCell">>;
type _RawHidesNewCharCell = AssertFalse<HasKey<SyncSpice["raw"], "newCharCell">>;
type _RawHidesNewWindow = AssertFalse<HasKey<SyncSpice["raw"], "newWindow">>;
type _RawHidesFreeCell = AssertFalse<HasKey<SyncSpice["raw"], "freeCell">>;
type _RawHidesFreeWindow = AssertFalse<HasKey<SyncSpice["raw"], "freeWindow">>;
type _RawHidesCellGeti = AssertFalse<HasKey<SyncSpice["raw"], "cellGeti">>;
type _RawHidesCellGetd = AssertFalse<HasKey<SyncSpice["raw"], "cellGetd">>;
type _RawHidesCellGetc = AssertFalse<HasKey<SyncSpice["raw"], "cellGetc">>;
type _RawHidesSpiceVersion = AssertFalse<HasKey<SyncSpice["raw"], "spiceVersion">>;
type _RawHidesReadVirtualOutput = AssertFalse<HasKey<SyncSpice["raw"], "readVirtualOutput">>;

type _KitHasNewIntCell = Assert<HasKey<SyncSpice["kit"], "newIntCell">>;
type _KitHasNewDoubleCell = Assert<HasKey<SyncSpice["kit"], "newDoubleCell">>;
type _KitHasNewCharCell = Assert<HasKey<SyncSpice["kit"], "newCharCell">>;
type _KitHasNewWindow = Assert<HasKey<SyncSpice["kit"], "newWindow">>;
type _KitHasFreeCell = Assert<HasKey<SyncSpice["kit"], "freeCell">>;
type _KitHasFreeWindow = Assert<HasKey<SyncSpice["kit"], "freeWindow">>;
type _KitHasCellGeti = Assert<HasKey<SyncSpice["kit"], "cellGeti">>;
type _KitHasCellGetd = Assert<HasKey<SyncSpice["kit"], "cellGetd">>;
type _KitHasCellGetc = Assert<HasKey<SyncSpice["kit"], "cellGetc">>;
type _KitHasSpiceVersion = Assert<HasKey<SyncSpice["kit"], "spiceVersion">>;
type _KitHasReadVirtualOutput = Assert<HasKey<SyncSpice["kit"], "readVirtualOutput">>;

// Spot-check a few async return types.
type _AsyncToolkitVersionReturnsPromise = Assert<
  ReturnType<AsyncSpice["kit"]["toolkitVersion"]> extends Promise<string> ? true : false
>;
type _AsyncSpiceVersionReturnsPromise = Assert<
  ReturnType<AsyncSpice["kit"]["spiceVersion"]> extends Promise<string> ? true : false
>;
type _AsyncNewIntCellReturnsPromise = Assert<
  ReturnType<AsyncSpice["kit"]["newIntCell"]> extends Promise<unknown> ? true : false
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
