import { kernels, spiceClients } from "@rybosome/tspice";

/**
 * Minimal browser-oriented quickstart:
 *
 * - Uses `kernels.tspice()` so demo code can run without self-hosting kernels.
 * - Uses `toAsync({ backend: "wasm" })`, so SPICE runs on the main thread.
 *
 * For production, prefer self-hosted/proxied kernels via `kernels.naif(...)`
 * or `kernels.custom(...)`. For heavier UI workloads, prefer `toWebWorker()`.
 */
export async function browserUtcToEtQuickstart() {
  const pack = kernels.tspice().pick("lsk/naif0012.tls");

  const { spice, dispose } = await spiceClients
    .withKernels(pack)
    .toAsync({ backend: "wasm" });

  try {
    return await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  } finally {
    await dispose();
  }
}
