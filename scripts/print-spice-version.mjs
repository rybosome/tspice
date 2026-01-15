import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

try {
  let createBackend;
  try {
    ({ createBackend } = await import("@rybosome/tspice"));
  } catch (error) {
    const shouldFallback =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_MODULE_NOT_FOUND";
    if (!shouldFallback) {
      throw error;
    }

    const tspiceEntry = pathToFileURL(
      path.join(repoRoot, "packages", "tspice", "dist", "index.js")
    );
    ({ createBackend } = await import(tspiceEntry.href));
  }

  const backend = createBackend({ backend: "node" });
  console.log(backend.spiceVersion());
} catch (error) {
  console.error(
    "Failed to load @rybosome/tspice (from node_modules or local dist). Ensure it is built and its native bindings are available."
  );
  throw error;
}
