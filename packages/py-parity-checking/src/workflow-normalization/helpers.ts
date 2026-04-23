import type { AliasValue, NormalizationContext, NormalizeTarget } from "./types.js";

import { readAlias } from "./context.js";

/**
* Convert alias values into existing path-string contract used by `kernels.kinfo`/`kernels.unload`.
 *
* For `PathRef` aliases, we map to current string-path forms (`rel` or `scratch/rel`) so consumers
* can keep using existing path fields without broad step-surface changes.
 */
export function aliasValueToPathString(value: AliasValue, target: NormalizeTarget): string {
  if (typeof value === "string") {
    return value;
  }

  if (value.kind === "fixture") {
    return value.rel;
  }

  if (target === "sidecar") {
    throw new Error("Scratch-path aliases are not supported for sidecar path consumers");
  }

  return `scratch/${value.rel}`;
}

/** Return either the direct path input or an alias-resolved path-string. */
export function resolvePathWithOptionalAlias(
  path: string,
  alias: string | undefined,
  context: NormalizationContext,
): string {
  if (alias == null) {
    return path;
  }

  const value = readAlias(context, alias);
  return aliasValueToPathString(value, context.target);
}
