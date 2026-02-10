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
    const result = parseYaml(yamlText, { sourceName: filePath });

    // Ensure file context is always present even if lower-level parsing changes.
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors.map((error) => ({
          ...error,
          message: error.message.includes(filePath)
            ? error.message
            : `${filePath}: ${error.message}`,
        })),
      };
    }

    return result;
  } catch (err) {
    const baseMessage =
      err instanceof Error ? err.message : "Failed to read YAML file.";

    const message = baseMessage.includes(filePath)
      ? baseMessage
      : `${filePath}: ${baseMessage}`;

    return { ok: false, errors: [{ path: "$", message }] };
  }
}
