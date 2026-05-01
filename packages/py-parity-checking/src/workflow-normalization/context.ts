import path from "node:path";

import { normalizePathRefRelativePath } from "../runtime/path-ref.js";

import type {
  AliasValue,
  GeneratedPathValue,
  NormalizationContext,
  NormalizeTarget,
} from "./types.js";

function normalizeAliasName(alias: string): string {
  const normalized = alias.trim();
  if (normalized.length === 0) {
    throw new Error("Workflow alias must be non-empty");
  }

  return normalized;
}

function normalizeGeneratedPathKey(rawPath: string): string | null {
  if (path.isAbsolute(rawPath)) {
    return null;
  }

  try {
    return normalizePathRefRelativePath(rawPath);
  } catch {
    return null;
  }
}

/** Create an isolated alias map for one workflow-normalization run. */
export function createNormalizationContext(target: NormalizeTarget): NormalizationContext {
  return {
    target,
    aliases: new Map<string, AliasValue>(),
    generatedPaths: new Map<string, GeneratedPathValue>(),
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

/** Publish a generated path reference so later workflow steps can consume it. */
export function publishGeneratedPath(
  context: NormalizationContext,
  rawPath: string,
  value: GeneratedPathValue,
): void {
  const normalizedKey = normalizeGeneratedPathKey(rawPath);
  if (normalizedKey == null) {
    return;
  }

  context.generatedPaths.set(normalizedKey, value);
}

/** Read a generated path reference, if one was published for this path. */
export function readGeneratedPath(
  context: NormalizationContext,
  rawPath: string,
): GeneratedPathValue | null {
  const normalizedKey = normalizeGeneratedPathKey(rawPath);
  if (normalizedKey == null) {
    return null;
  }

  return context.generatedPaths.get(normalizedKey) ?? null;
}
