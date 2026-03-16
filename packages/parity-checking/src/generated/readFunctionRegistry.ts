import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { FUNCTION_REGISTRY_CATALOG_PATH } from "../config/constants.js";
import { parseFunctionRegistryCatalog } from "../dsl/functionRegistryValidate.js";

import type { FunctionRegistryCatalog } from "../dsl/functionRegistryTypes.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

/** Read and validate the generated function registry catalog. */
export function readFunctionRegistry(): FunctionRegistryCatalog {
  const filePath = path.join(packageRoot(), FUNCTION_REGISTRY_CATALOG_PATH);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  return parseFunctionRegistryCatalog(parsed);
}
