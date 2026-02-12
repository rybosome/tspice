import * as tspice from "@rybosome/tspice";
import type { GetStateArgs, SpiceAsync, SpiceClientsBuilder, SpiceTime } from "@rybosome/tspice";
import { describe, expect, it } from "vitest";

type Assert<T extends true> = T;
type AssertFalse<T extends false> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

// --- public runtime exports ---

type Exports = typeof tspice;

type _ExportsHasSpiceClients = Assert<HasKey<Exports, "spiceClients">>;
type _ExportsHasPublicKernels = Assert<HasKey<Exports, "publicKernels">>;
type _ExportsHasCreatePublicKernels = Assert<HasKey<Exports, "createPublicKernels">>;

// Ensure low-level factories/helpers are not available at the root.
type _NoCreateBackend = AssertFalse<HasKey<Exports, "createBackend">>;
type _NoCreateSpice = AssertFalse<HasKey<Exports, "createSpice">>;
type _NoCreateSpiceAsync = AssertFalse<HasKey<Exports, "createSpiceAsync">>;
type _NoWithCaching = AssertFalse<HasKey<Exports, "withCaching">>;
type _NoWithCachingSync = AssertFalse<HasKey<Exports, "withCachingSync">>;
type _NoCreateWorkerTransport = AssertFalse<HasKey<Exports, "createWorkerTransport">>;

// --- builder contract ---

type _SpiceClientsIsBuilder = Assert<typeof tspice.spiceClients extends SpiceClientsBuilder ? true : false>;
type _BuilderHasNoBuild = AssertFalse<HasKey<SpiceClientsBuilder, "build">>;
type _BuilderHasNoModeSelectors = AssertFalse<
  HasKey<SpiceClientsBuilder, "synchronous"> extends true
    ? true
    : HasKey<SpiceClientsBuilder, "asynchronous"> extends true
      ? true
      : HasKey<SpiceClientsBuilder, "webWorker"> extends true
        ? true
        : false
>;
type _BuilderHasToSync = Assert<HasKey<SpiceClientsBuilder, "toSync">>;
type _BuilderHasToAsync = Assert<HasKey<SpiceClientsBuilder, "toAsync">>;
type _BuilderHasToWebWorker = Assert<HasKey<SpiceClientsBuilder, "toWebWorker">>;
type _BuilderHasWithKernel = Assert<HasKey<SpiceClientsBuilder, "withKernel">>;

type SyncBuild = Awaited<ReturnType<typeof tspice.spiceClients.toSync>>;
type _SyncBuildHasSpice = Assert<HasKey<SyncBuild, "spice">>;
type _SyncBuildHasDispose = Assert<HasKey<SyncBuild, "dispose">>;

type AsyncBuild = Awaited<ReturnType<typeof tspice.spiceClients.toAsync>>;
type _AsyncBuildHasSpice = Assert<HasKey<AsyncBuild, "spice">>;
type _AsyncBuildHasDispose = Assert<HasKey<AsyncBuild, "dispose">>;

// --- SpiceTime contract ---

// No branding: SpiceTime should be `number`.
type _SpiceTimeIsNumber = Assert<SpiceTime extends number ? true : false>;
type _NumberAssignableToSpiceTime = Assert<number extends SpiceTime ? true : false>;

// --- GetStateArgs contract ---

type _GetStateTargetAcceptsNumber = Assert<number extends GetStateArgs["target"] ? true : false>;
type _GetStateObserverAcceptsNumber = Assert<number extends GetStateArgs["observer"] ? true : false>;

// Async raw.kind should remain a non-Promise property.
type _AsyncRawKindIsNotPromise = AssertFalse<SpiceAsync["raw"]["kind"] extends Promise<unknown> ? true : false>;

describe("TypeScript type assertions", () => {
  it("compiles", () => {
    expect(true).toBe(true);
  });
});
