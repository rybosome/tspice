import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverYamlFiles } from "../dsl/discoverYamlFiles.js";
import { loadYamlFile } from "../dsl/loadYaml.js";
import { parseMethodSpec } from "../dsl/schemaValidate.js";

import { methodSpecId } from "../dsl/types.js";
import type { LoadedParitySpecs } from "../dsl/types.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Load canonical parity-tested method specs from `specs/methods/**`.
 * This is the same source used by the parity harness.
 */
export async function loadParitySpecs(): Promise<LoadedParitySpecs> {
  const root = packageRoot();
  const methodFiles = discoverYamlFiles(path.join(root, "specs", "methods"));

  const methods = (
    await Promise.all(methodFiles.map(async (filePath) => parseMethodSpec(await loadYamlFile(filePath))))
  ).sort((a, b) => stableSort(methodSpecId(a), methodSpecId(b)));

  return { methods };
}
