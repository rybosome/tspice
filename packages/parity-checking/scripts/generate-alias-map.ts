import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ALIAS_MAP: Record<string, string> = {
  bodc2n: "ids-names.bodc2n",
  bodc2s: "ids-names.bodc2s",
  boddef: "ids-names.boddef",
  bodfnd: "ids-names.bodfnd",
  bodn2c: "ids-names.bodn2c",
  bods2c: "ids-names.bods2c",
  bodvar: "ids-names.bodvar",
  ccifrm: "frames.ccifrm",
  cidfrm: "frames.cidfrm",
  cnmfrm: "frames.cnmfrm",
  et2utc: "time.et2utc",
  frinfo: "frames.frinfo",
  frmnam: "frames.frmnam",
  namfrm: "frames.namfrm",
  pxform: "frames.pxform",
  str2et: "time.str2et",
  sxform: "frames.sxform",
};

const stableEntries = Object.entries(ALIAS_MAP).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const out = Object.fromEntries(stableEntries);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const outputPath = path.resolve(packageRoot, "catalogs/alias-map.json");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

console.log(`[parity-checking] wrote ${stableEntries.length} aliases -> ${outputPath}`);
