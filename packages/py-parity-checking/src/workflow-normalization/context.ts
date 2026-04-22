import type { AliasValue, NormalizationContext, NormalizeTarget } from "./types.js";

function normalizeAliasName(alias: string): string {
  const normalized = alias.trim();
  if (normalized.length === 0) {
    throw new Error("Workflow alias must be non-empty");
  }

  return normalized;
}

/** Create an isolated alias map for one workflow-normalization run. */
export function createNormalizationContext(target: NormalizeTarget): NormalizationContext {
  return {
    target,
    aliases: new Map<string, AliasValue>(),
  };
}

/** Register an alias value in the normalization context. */
export function publishAlias(
  context: NormalizationContext,
  alias: string,
  value: AliasValue,
): void {
  const normalizedAlias = normalizeAliasName(alias);
  if (context.aliases.has(normalizedAlias)) {
    throw new Error(`Workflow alias already published: ${normalizedAlias}`);
  }

  context.aliases.set(normalizedAlias, value);
}

/** Resolve a previously published alias value. */
export function readAlias(context: NormalizationContext, alias: string): AliasValue {
  const normalizedAlias = normalizeAliasName(alias);
  const resolved = context.aliases.get(normalizedAlias);
  if (resolved == null) {
    throw new Error(`Workflow alias not found: ${normalizedAlias}`);
  }

  return resolved;
}
