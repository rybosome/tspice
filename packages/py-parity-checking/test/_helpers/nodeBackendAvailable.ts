import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const nodeBackendAvailable = (() => {
  // In JS-only CI we intentionally don't build @rybosome/tspice-backend-node.
  // Skip node-backend tests unless both the JS entrypoint and native addon exist.
  const distEntrypoint = path.resolve(__dirname, "..", "..", "..", "backend-node", "dist", "index.js");
  if (!fs.existsSync(distEntrypoint)) {
    return false;
  }

  const releaseDir = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "backend-node",
    "native",
    "build",
    "Release",
  );

  if (!fs.existsSync(releaseDir)) {
    return false;
  }

  return fs.readdirSync(releaseDir).some((file) => file.endsWith(".node"));
})();
