import { parse as parseYamlImpl } from "yaml";

/**
 * Parse a v1 benchmark suite YAML string into an intermediate JS value.
 */
export function parseYaml(yaml: string): unknown {
  try {
    return parseYamlImpl(yaml);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse benchmark suite YAML: ${cause}`);
  }
}
