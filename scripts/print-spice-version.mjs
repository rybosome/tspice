import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

const tspiceEntry = pathToFileURL(path.join(repoRoot, "packages", "tspice", "dist", "index.js"));
const { createBackend } = await import(tspiceEntry.href);

const backend = createBackend({ backend: "node" });
console.log(backend.spiceVersion());
