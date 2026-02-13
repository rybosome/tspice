import { spiceClients } from "@rybosome/tspice";

/**
* Minimal end-to-end slice used by CI.
*/
export async function tkvrsnToolkitE2e(options: { backend: "node" | "wasm" }): Promise<string> {
  const { spice, dispose } = await spiceClients.toSync(options);
  try {
    return spice.kit.toolkitVersion();
  } finally {
    await dispose();
  }
}
