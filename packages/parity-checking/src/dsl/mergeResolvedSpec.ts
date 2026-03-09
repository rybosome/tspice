import type { KernelEntry } from "../runners/types.js";

import type { ScenarioCompareAst, ScenarioSetupAst } from "./types.js";

function kernelEntryKey(entry: KernelEntry): string {
  return typeof entry === "string" ? `str:${entry}` : `obj:${JSON.stringify(entry)}`;
}

/** Merge setup kernel entries while preserving first-seen order. */
export function mergeSetupChain(setups: Array<ScenarioSetupAst | undefined>): ScenarioSetupAst | undefined {
  const seen = new Set<string>();
  const merged: KernelEntry[] = [];

  for (const setup of setups) {
    const kernels = setup?.kernels ?? [];
    for (const entry of kernels) {
      const key = kernelEntryKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
  }

  return merged.length === 0 ? undefined : { kernels: merged };
}

/** Merge compare settings where later entries override earlier ones. */
export function mergeCompareChain(compareChain: Array<ScenarioCompareAst | undefined>): ScenarioCompareAst | undefined {
  const out: ScenarioCompareAst = {};

  for (const compare of compareChain) {
    if (!compare) continue;
    if (compare.tolAbs !== undefined) out.tolAbs = compare.tolAbs;
    if (compare.tolRel !== undefined) out.tolRel = compare.tolRel;
    if (compare.angleWrapPi !== undefined) out.angleWrapPi = compare.angleWrapPi;
    if (compare.errorShort !== undefined) out.errorShort = compare.errorShort;
  }

  return Object.keys(out).length === 0 ? undefined : out;
}

