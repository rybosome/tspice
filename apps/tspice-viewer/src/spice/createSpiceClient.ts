import { wrapTspiceWorker } from "@rybosome/tspice-web/client";

import type { EtSeconds, SpiceClient } from "./SpiceClient.js";
import { createCachedSpiceClient } from "./createCachedSpiceClient.js";
import { loadDefaultKernels } from "./loadDefaultKernels.js";

export type ViewerSpiceClientBundle = {
  client: SpiceClient;
  utcToEt(utc: string): Promise<EtSeconds>;
  dispose(): void;
};

/**
* Viewer entrypoint for initializing a tspice-backed `SpiceClient`.
*
* This app always uses the real WASM backend.
*/
export async function createSpiceClient(
  options: { searchParams?: URLSearchParams } = {},
): Promise<ViewerSpiceClientBundle> {
  // Keep URL parsing for other params (`?utc=...`, `?et=...`) in the caller.
  // Currently `searchParams` isn't used here, but we keep the option for API stability.
  void options;

  const worker = new Worker(new URL("../workers/tspice.worker.ts", import.meta.url), {
    type: "module",
  });

  const { api, dispose } = wrapTspiceWorker(worker);

  try {
    await api.init();

    // Load the viewer's default kernels via RPC so the main thread stays responsive.
    await loadDefaultKernels({
      loadKernel: (kernel) => api.loadKernel(kernel),
    });

    const spiceClient = api as unknown as SpiceClient;
    const client = createCachedSpiceClient(spiceClient);

    return {
      client,
      utcToEt: async (utc) => (await api.utcToEt(utc)) as EtSeconds,
      dispose,
    };
  } catch (err) {
    dispose();
    throw err;
  }
}
