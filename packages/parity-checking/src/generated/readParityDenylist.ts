import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export function readParityDenylist(): string[] {
  const filePath = path.join(packageRoot(), "catalogs", "parity-denylist.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Parity denylist must be a JSON array at ${filePath}`);
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Parity denylist entry at index ${index} must be a string`);
    }
    return entry;
  });
}
