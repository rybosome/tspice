import { describe, expect, it } from "vitest";

import type { CreateSpiceOptions, Spice, SpiceAsync, SpiceClientsBuilder } from "@rybosome/tspice";

type Assert<T extends true> = T;
type AssertFalse<T extends false> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type PublicExports = typeof import("@rybosome/tspice");

// --- public exports contract (issue #444) ---

type _HasSpiceClients = Assert<HasKey<PublicExports, "spiceClients">>;
type _HasKernels = Assert<HasKey<PublicExports, "kernels">>;

type _NoCreateBackend = AssertFalse<HasKey<PublicExports, "createBackend">>;
type _NoCreateSpice = AssertFalse<HasKey<PublicExports, "createSpice">>;
type _NoCreateSpiceAsync = AssertFalse<HasKey<PublicExports, "createSpiceAsync">>;
type _NoResolveKernelUrl = AssertFalse<HasKey<PublicExports, "resolveKernelUrl">>;

type KeysEqual<A extends object, B extends object> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;

// --- CreateSpiceOptions contract ---

type BackendKind = CreateSpiceOptions["backend"];
type _BackendKindIsSupported = Assert<BackendKind extends "node" | "wasm" ? true : false>;
type _BackendKindDoesNotIncludeFake = AssertFalse<"fake" extends BackendKind ? true : false>;

// --- Spice / SpiceAsync contract ---

type _SpiceHasRaw = Assert<HasKey<Spice, "raw">>;
type _SpiceHasKit = Assert<HasKey<Spice, "kit">>;
type _SpiceHasNoFurnsh = AssertFalse<HasKey<Spice, "furnsh">>;

type _SpiceAsyncHasRaw = Assert<HasKey<SpiceAsync, "raw">>;
type _SpiceAsyncHasKit = Assert<HasKey<SpiceAsync, "kit">>;
type _SpiceAsyncHasNoFurnsh = AssertFalse<HasKey<SpiceAsync, "furnsh">>;

type _AsyncRawKeysMatch = Assert<KeysEqual<SpiceAsync["raw"], Spice["raw"]>>;
type _AsyncKitKeysMatch = Assert<KeysEqual<SpiceAsync["kit"], Spice["kit"]>>;

type _AsyncToolkitVersionReturnsPromise = Assert<
  ReturnType<SpiceAsync["kit"]["toolkitVersion"]> extends Promise<string> ? true : false
>;

type _AsyncKtotalReturnsPromise = Assert<
  ReturnType<SpiceAsync["raw"]["ktotal"]> extends Promise<number> ? true : false
>;

type _AsyncRawKindIsNotPromise = AssertFalse<
  SpiceAsync["raw"]["kind"] extends Promise<unknown> ? true : false
>;

// --- spiceClients builder contract ---

type _ToSyncReturnsPromise = Assert<
  ReturnType<SpiceClientsBuilder["toSync"]> extends Promise<unknown> ? true : false
>;

type ToSyncResult = Awaited<ReturnType<SpiceClientsBuilder["toSync"]>>;
type _ToSyncResultHasSpice = Assert<HasKey<ToSyncResult, "spice">>;
type _ToSyncResultSpiceIsSync = Assert<ToSyncResult["spice"] extends Spice ? true : false>;

type ToAsyncResult = Awaited<ReturnType<SpiceClientsBuilder["toAsync"]>>;
type _ToAsyncResultHasSpice = Assert<HasKey<ToAsyncResult, "spice">>;
type _ToAsyncResultSpiceIsAsync = Assert<ToAsyncResult["spice"] extends SpiceAsync ? true : false>;

describe("TypeScript type assertions", () => {
  it("compiles", () => {
    expect(true).toBe(true);
  });
});
