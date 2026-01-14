import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

const tspiceEntry = pathToFileURL(
  path.join(repoRoot, "packages", "tspice", "dist", "index.js")
);

try {
  const { createBackend } = await import(tspiceEntry.href);
  const backend = createBackend({ backend: "node" });
  console.log(backend.spiceVersion());
} catch (error) {
  console.error("Failed to load built @rybosome/tspice. Ensure `pnpm run build` has succeeded.");
  throw error;
}
