import type { Spice } from "@rybosome/tspice";

import type { EtSeconds, SpiceClient } from "./SpiceClient.js";
import { createCachedSpiceClient } from "./createCachedSpiceClient.js";
import { TspiceSpiceClient } from "./TspiceSpiceClient.js";

export type SpiceBackendKind = "fake" | "wasm";

export type ViewerSpiceClientBundle = {
  backend: SpiceBackendKind;
  spice: Spice;
  client: SpiceClient;
  utcToEt(utc: string): EtSeconds;
};

function normalizeBackend(value: string | null | undefined): SpiceBackendKind | undefined {
  if (!value) return undefined;
  if (value === "fake" || value === "wasm") return value;
  return undefined;
}

async function createFakeSpice(): Promise<Spice> {
  const [{ createSpice }, { createFakeBackend }] = await Promise.all([
    import("@rybosome/tspice"),
    import("@rybosome/tspice-backend-fake"),
  ]);

  return createSpice({ backendInstance: createFakeBackend() });
}

async function createWasmSpiceOrFallbackToFake(): Promise<{ spice: Spice; backend: SpiceBackendKind }> {
  // Note: the viewer's WASM integration is intentionally not wired up yet.
  // Keep the selection surface area (`?backend=wasm` / `VITE_SPICE_BACKEND=wasm`)
  // but fall back to the fake backend so local dev + e2e keep working.
  console.warn(
    "WASM backend requested (backend=wasm), but tspice-viewer currently falls back to the fake backend.",
  );
  const spice = await createFakeSpice();
  return { spice, backend: "fake" };
}

/**
* Viewer entrypoint for selecting and initializing a tspice-backed `SpiceClient`.
*
* Selection:
* - query param override: `?backend=fake|wasm`
* - env default: `import.meta.env.VITE_SPICE_BACKEND`
* - final default: `fake`
*/
export async function createSpiceClient(
  options: { searchParams?: URLSearchParams } = {},
): Promise<ViewerSpiceClientBundle> {
  const searchParams = options.searchParams ?? new URLSearchParams(window.location.search);
  const queryBackend = normalizeBackend(searchParams.get("backend"));
  const envBackend = normalizeBackend(import.meta.env.VITE_SPICE_BACKEND);
  const backendRequested: SpiceBackendKind = queryBackend ?? envBackend ?? "fake";

  const { spice, backend } =
    backendRequested === "wasm"
      ? await createWasmSpiceOrFallbackToFake()
      : { spice: await createFakeSpice(), backend: "fake" as const };

  const client = createCachedSpiceClient(new TspiceSpiceClient(spice));

  return {
    backend,
    spice,
    client,
    utcToEt: (utc) => spice.utcToEt(utc) as unknown as EtSeconds,
  };
}
