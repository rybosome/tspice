import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const denylistJsonPath = path.resolve(packageRoot, "catalogs/parity-denylist.json");

const denylist: string[] = [];

fs.mkdirSync(path.dirname(denylistJsonPath), { recursive: true });
fs.writeFileSync(denylistJsonPath, `${JSON.stringify(denylist, null, 2)}\n`, "utf8");

console.log(
  `[parity-checking] wrote denylist (${denylist.length}) -> ${denylistJsonPath}`,
);
