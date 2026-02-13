import type { KernelSource } from "@rybosome/tspice";
import { createSpice } from "@rybosome/tspice";

import { readFile } from "node:fs/promises";

/**
 * Example: load kernels from the OS filesystem (Node backend only).
 */
export async function loadKernelFromFsPath(absPathToKernel: string) {
  const spice = await createSpice({ backend: "node" });

  // When `KernelSource` is a string, it is passed directly to the backend's
  // `furnsh()` implementation.
  spice.kit.loadKernel(absPathToKernel);

  return spice;
}

/**
 * Example: load kernels from bytes (portable across WASM + Node backends).
 */
export async function loadKernelFromBytes(kernelId: string, absPathToKernel: string) {
  const spice = await createSpice({ backend: "wasm" });

  const bytes = await readFile(absPathToKernel);

  const kernel: KernelSource = {
    // This is a *virtual* identifier (not necessarily an OS path).
    // Keep it stable so you can unload the kernel later.
    path: kernelId,
    bytes,
  };

  spice.kit.loadKernel(kernel);

  // Later, unload using the same identifier (or a normalized variant like
  // `/kernels/<id>` — tspice normalizes virtual paths internally).
  spice.kit.unloadKernel(kernelId);

  return spice;
}
