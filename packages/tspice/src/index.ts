// NOTE: This file is the *only* public entrypoint for the published
// `@rybosome/tspice` package.
//
// Keep this surface area intentionally small (see issue #444).

export { spiceClients } from "./clients/spiceClients.js";
export type {
  SpiceClientBuildResult,
  SpiceClientsBuilder,
  SpiceClientsWebWorkerOptions,
} from "./clients/spiceClients.js";

// Types required to configure the `spiceClients` builder and use its outputs.
export type { CreateSpiceAsyncOptions, CreateSpiceOptions } from "./spice.js";
export type { Spice, SpiceAsync } from "./kit/types/spice-types.js";
export type { WithCachingOptions } from "./transport/caching/withCaching.js";
export { kernels } from "./kernels/kernels.js";
export type { FetchLike, KernelPack, KernelPackKernel } from "./kernels/kernelPack.js";
