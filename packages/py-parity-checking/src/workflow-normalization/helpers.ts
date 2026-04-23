import type { AliasValue, NormalizationContext, NormalizeTarget } from "./types.js";

import { readAlias } from "./context.js";

/** Convert alias values into path strings (`rel`/`scratch/rel`) for `kernels.kinfo` and `kernels.unload`. */
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
