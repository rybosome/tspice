import { spiceClients } from "@rybosome/tspice";

type SpiceSync = Awaited<ReturnType<typeof spiceClients.toSync>>["spice"];

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
 * - Prefer `spiceClients` so you can reliably `dispose()` resources.
 */
export async function withSpiceFromEnv<T>(
  fn: (spice: SpiceSync) => Promise<T> | T,
): Promise<T> {
  const backend = parseBackend(process.env.TSPICE_BACKEND);

  const { spice, dispose } = await spiceClients.toSync({ backend });
  try {
    return await fn(spice);
  } finally {
    await dispose();
  }
}

/**
 * Example: pass the backend explicitly (useful for tests and programmatic selection).
 */
export async function getToolkitVersion(backend: "wasm" | "node") {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  try {
    return spice.kit.toolkitVersion();
  } finally {
    await dispose();
  }
}
