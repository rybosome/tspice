import type { CreateBackendOptions } from "@rybosome/tspice";

import { createBackend } from "@rybosome/tspice";

/**
 * Minimal end-to-end slice used by CI.
 *
 * The same module can be executed with either backend chosen at runtime.
 */
export async function tkvrsnToolkitE2e(
  options: CreateBackendOptions,
): Promise<string> {
  const backend = await createBackend(options);
  return backend.tkvrsn("TOOLKIT");
}
