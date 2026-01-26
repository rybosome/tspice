import { createSpice, type Spice } from "@rybosome/tspice";

import type { EtSeconds, SpiceClient } from "./SpiceClient.js";
import { createCachedSpiceClient } from "./createCachedSpiceClient.js";
import { TspiceSpiceClient } from "./TspiceSpiceClient.js";
import { loadDefaultKernels } from "./loadDefaultKernels.js";

export type ViewerSpiceClientBundle = {
  spice: Spice;
  client: SpiceClient;
  utcToEt(utc: string): EtSeconds;
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

  const spice = await createSpice({ backend: "wasm" });
  await loadDefaultKernels(spice);

  const client = createCachedSpiceClient(new TspiceSpiceClient(spice));

  return {
    spice,
    client,
    utcToEt: (utc) => spice.utcToEt(utc) as unknown as EtSeconds,
  };
}
