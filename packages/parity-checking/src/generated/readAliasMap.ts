import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { ALIAS_MAP_CATALOG_PATH } from "../config/constants.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export function readAliasMap(): Record<string, string> {
  const filePath = path.join(packageRoot(), ALIAS_MAP_CATALOG_PATH);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Alias catalog must be a JSON object at ${filePath}`);
  }

  const out: Record<string, string> = {};
  for (const [alias, canonical] of Object.entries(parsed)) {
    if (typeof canonical !== "string") {
      throw new Error(`Alias map value for ${alias} must be a string`);
    }
    out[alias] = canonical;
  }

  return out;
}
