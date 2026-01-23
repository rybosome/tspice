import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADDON_FILE = "tspice_backend_node.node";

/**
* Returns true if the native addon exists on disk.
*
* Note: we intentionally don't attempt to `require()` the addon here, since
* that would surface opaque dlopen errors and make skipping logic flaky.
*/
export function nodeAddonAvailable(): boolean {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(testDir, "..", "..");

  const override = process.env.TSPICE_BACKEND_NODE_BINDING_PATH;
  if (override) {
    const resolvedOverride = path.resolve(packageRoot, override);
    return fs.existsSync(resolvedOverride);
  }

  const candidate = path.join(packageRoot, "native", "build", "Release", ADDON_FILE);
  return fs.existsSync(candidate);
}
