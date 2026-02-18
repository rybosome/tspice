import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { CONTRACT_CATALOG_PATH } from "../config/constants.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export function readContractCatalog(): string[] {
  const filePath = path.join(packageRoot(), CONTRACT_CATALOG_PATH);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Contract catalog must be a JSON string[] at ${filePath}`);
  }

  const methods = parsed.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Contract catalog entry at index ${index} is not a string`);
    }
    return entry;
  });

  return methods;
}
