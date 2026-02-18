import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

import type { ScenarioYamlFile } from "./types.js";

/** Read and parse a scenario YAML file from disk. */
export async function loadYamlFile(sourcePath: string): Promise<ScenarioYamlFile> {
  const text = await readFile(sourcePath, "utf8");
  const data = parseYaml(text);
  return { sourcePath, text, data };
}
