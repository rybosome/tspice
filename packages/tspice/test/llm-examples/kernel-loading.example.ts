import type { KernelSource } from "@rybosome/tspice";
import { spiceClients } from "@rybosome/tspice";

import { readFile } from "node:fs/promises";

type SpiceSync = Awaited<ReturnType<typeof spiceClients.toSync>>["spice"];

/**
 * Example: load kernels from the OS filesystem (Node backend only).
 *
 * Notes:
 * - When `KernelSource` is a string, it is passed directly to the backend's
 *   `furnsh()` implementation.
 * - Prefer using `spiceClients` so you can reliably `dispose()` resources.
 */
export async function withKernelFromFsPath<T>(
  absPathToKernel: string,
  fn: (spice: SpiceSync) => Promise<T> | T,
): Promise<T> {
  const { spice, dispose } = await spiceClients.toSync({ backend: "node" });
  try {
    spice.kit.loadKernel(absPathToKernel);
    return await fn(spice);
  } finally {
    await dispose();
  }
}

/**
 * Example: load kernels from bytes (portable across WASM + Node backends).
 */
export async function withKernelFromBytes<T>(
  kernelId: string,
  absPathToKernel: string,
  fn: (spice: SpiceSync) => Promise<T> | T,
): Promise<T> {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });

  let loaded = false;
  try {
    // In browsers, use `fetch()` (or another source) to obtain kernel bytes.
    const bytes = await readFile(absPathToKernel);

    const kernel: KernelSource = {
      // This is a *virtual* identifier (not necessarily an OS path).
      // Keep it stable so you can unload the kernel later.
      path: kernelId,
      bytes,
    };

    spice.kit.loadKernel(kernel);
    loaded = true;

    return await fn(spice);
  } finally {
    try {
      // If you're keeping the client alive, you can unload kernels explicitly
      // using the same identifier (or a normalized variant like `/kernels/<id>`
      // — tspice normalizes virtual paths internally).
      if (loaded) spice.kit.unloadKernel(kernelId);
    } finally {
      await dispose();
    }
  }
}
