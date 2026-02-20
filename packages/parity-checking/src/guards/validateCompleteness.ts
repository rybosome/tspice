import { readContractCatalog } from "../generated/readContractCatalog.js";
import { readParityDenylist } from "../generated/readParityDenylist.js";

import type { MethodSpec } from "../dsl/types.js";

const BASELINE_CANONICAL_METHOD_COVERAGE = 125;
const MAX_BASELINE_DENYLIST_SIZE = 48;

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type CompletenessValidationSummary = {
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
};

/** Enforce parity catalog coverage invariants for migration safety. */
export function validateCompleteness(methodSpecs: MethodSpec[]): CompletenessValidationSummary {
  const contractMethods = readContractCatalog();
  const denylist = readParityDenylist();

  const contractSet = new Set(contractMethods);
  const coveredCanonical = new Set(methodSpecs.map((method) => method.canonicalMethod));

  if (new Set(denylist).size !== denylist.length) {
    throw new Error("Parity denylist must not contain duplicate entries.");
  }

  const sortedDenylist = [...denylist].sort(stableSort);
  if (sortedDenylist.join("\n") !== denylist.join("\n")) {
    throw new Error(
      "Parity denylist must be sorted deterministically. Regenerate via `pnpm -C packages/parity-checking generate:denylist`.",
    );
  }

  if (denylist.length > MAX_BASELINE_DENYLIST_SIZE) {
    throw new Error(
      `Parity denylist grew beyond baseline (${MAX_BASELINE_DENYLIST_SIZE}). Current count=${denylist.length}.`,
    );
  }

  const unknownDenylist = denylist.filter((method) => !contractSet.has(method));
  if (unknownDenylist.length > 0) {
    throw new Error(
      `Parity denylist has unknown contract methods (${unknownDenylist.length}): ${unknownDenylist.join(", ")}`,
    );
  }

  const uncovered = contractMethods.filter(
    (method) => !coveredCanonical.has(method) && !denylist.includes(method),
  );

  if (uncovered.length > 0) {
    throw new Error(
      `Parity completeness failed; uncovered canonical methods (${uncovered.length}): ${uncovered.join(", ")}`,
    );
  }

  if (coveredCanonical.size !== BASELINE_CANONICAL_METHOD_COVERAGE) {
    throw new Error(
      `Canonical parity coverage changed from baseline ${BASELINE_CANONICAL_METHOD_COVERAGE} to ${coveredCanonical.size}. ` +
        "This migration PR must preserve existing canonical coverage.",
    );
  }

  return {
    contractCount: contractMethods.length,
    coveredCount: coveredCanonical.size,
    denylistCount: denylist.length,
  };
}
