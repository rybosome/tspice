import fs from "node:fs";

import { parse } from "yaml";

import type { ValidationResult } from "./types.js";

export function parseYaml(yamlText: string): ValidationResult<unknown> {
  try {
    return { ok: true, value: parse(yamlText) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse YAML.";
    return { ok: false, errors: [{ path: "$", message }] };
  }
}

export function parseYamlFile(filePath: string): ValidationResult<unknown> {
  try {
    const yamlText = fs.readFileSync(filePath, "utf8");
    return parseYaml(yamlText);
  } catch (err) {
    const message = err instanceof Error ? err.message : `Failed to read ${filePath}.`;
    return { ok: false, errors: [{ path: "$", message }] };
  }
}
