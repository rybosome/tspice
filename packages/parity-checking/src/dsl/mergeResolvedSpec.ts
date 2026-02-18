import type { KernelEntry } from "../runners/types.js";

import type { MethodSpec, ResolvedMethodSpec, ScenarioCompareAst, ScenarioSetupAst, WorkflowSpec } from "./types.js";

function kernelEntryKey(entry: KernelEntry): string {
  return typeof entry === "string" ? `str:${entry}` : `obj:${JSON.stringify(entry)}`;
}

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

export function mergeResolvedMethodSpec(method: MethodSpec, includeOrder: WorkflowSpec[]): ResolvedMethodSpec {
  const mergedSetup = mergeSetupChain([...includeOrder.map((workflow) => workflow.setup), method.setup]);

  const mergedCompareDefaults = mergeCompareChain([
    ...includeOrder.map((workflow) => workflow.compareDefaults),
    method.defaults?.compare,
  ]);

  const out: ResolvedMethodSpec = {
    method,
    includeOrder,
  };

  if (mergedSetup !== undefined) {
    out.mergedSetup = mergedSetup;
  }

  if (mergedCompareDefaults !== undefined) {
    out.mergedCompareDefaults = mergedCompareDefaults;
  }

  return out;
}
