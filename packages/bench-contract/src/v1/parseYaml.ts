import fs from "node:fs";

import { parse } from "yaml";

import type { ValidationResult } from "./types.js";

export function parseYaml(
  yamlText: string,
  options?: { sourceName?: string },
): ValidationResult<unknown> {
  try {
    return { ok: true, value: parse(yamlText) };
  } catch (err) {
    const baseMessage =
      err instanceof Error ? err.message : "Failed to parse YAML.";

    const message = options?.sourceName
      ? `${options.sourceName}: ${baseMessage}`
      : baseMessage;

    return { ok: false, errors: [{ path: "$", message }] };
  }
}

export function parseYamlFile(filePath: string): ValidationResult<unknown> {
  try {
    const yamlText = fs.readFileSync(filePath, "utf8");
    return parseYaml(yamlText, { sourceName: filePath });
  } catch (err) {
    const baseMessage =
      err instanceof Error ? err.message : "Failed to read YAML file.";

    const message = baseMessage.includes(filePath)
      ? baseMessage
      : `${filePath}: ${baseMessage}`;

    return { ok: false, errors: [{ path: "$", message }] };
  }
}
