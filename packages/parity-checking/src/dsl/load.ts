import { loadYamlFile } from "./loadYaml.js";
import type { ScenarioYamlFile } from "./types.js";

/** Load a scenario YAML file from disk and parse it into a structured object. */
export async function loadScenarioYamlFile(sourcePath: string): Promise<ScenarioYamlFile> {
  return loadYamlFile(sourcePath);
}
