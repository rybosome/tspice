import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { computeContractKeys, stableCompare } from "./parity-contract-keys.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const contractIndexPath = path.resolve(packageRoot, "../backend-contract/src/index.ts");
const contractDomainsDir = path.resolve(packageRoot, "../backend-contract/src/domains");
const outputPath = path.resolve(packageRoot, "catalogs/contract-methods.json");

const keys = computeContractKeys({
  indexPath: contractIndexPath,
  domainsDir: contractDomainsDir,
}).sort(stableCompare);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(keys, null, 2)}\n`, "utf8");

console.log(`[parity-checking] wrote ${keys.length} canonical methods -> ${outputPath}`);
