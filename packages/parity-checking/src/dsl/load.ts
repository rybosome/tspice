import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

import type { ScenarioYamlFile } from "./types.js";

/** Load a scenario YAML file from disk and parse it into a structured object. */
export async function loadScenarioYamlFile(sourcePath: string): Promise<ScenarioYamlFile> {
  const text = await readFile(sourcePath, "utf8");
  const data = parseYaml(text);
  return { sourcePath, text, data };
}
