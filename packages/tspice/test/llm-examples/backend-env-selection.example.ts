import { createSpice, spiceClients } from "@rybosome/tspice";

function parseBackend(input: string | undefined): "wasm" | "node" {
  // Default to WASM for portability.
  return input === "node" ? "node" : "wasm";
}

/**
 * Example: explicit backend selection via an env var.
 *
 * Notes:
 * - `backend: "node"` requires the platform-native optional dependency.
 * - `backend: "wasm"` is the most portable choice.
 */
export async function createSpiceFromEnv() {
  const backend = parseBackend(process.env.TSPICE_BACKEND);
  return await createSpice({ backend });
}

/**
 * Example: using the higher-level `spiceClients` helper.
 *
 * This is handy when you want a `dispose()` function (e.g. to tear down a
 * WebWorker backend or free native resources).
 */
export async function getToolkitVersion(backend: "wasm" | "node") {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  try {
    return spice.kit.toolkitVersion();
  } finally {
    await dispose();
  }
}
