import { readContractCatalog } from "../generated/readContractCatalog.js";
import { readParityDenylist } from "../generated/readParityDenylist.js";
import { methodCanonicalMethod } from "../dsl/types.js";

import type { AnyMethodSpec } from "../dsl/types.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type CompletenessValidationSummary = {
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
};

/** Enforce parity catalog coverage invariants for migration safety. */
export function validateCompleteness(methodSpecs: AnyMethodSpec[]): CompletenessValidationSummary {
  const contractMethods = readContractCatalog();
  const denylist = readParityDenylist();

  const contractSet = new Set(contractMethods);
  const coveredCanonical = new Set(methodSpecs.map((method) => methodCanonicalMethod(method)));
  const coveredContract = new Set(
    [...coveredCanonical].filter((canonicalMethod) => contractSet.has(canonicalMethod)),
  );

  if (new Set(denylist).size !== denylist.length) {
    throw new Error("Parity denylist must not contain duplicate entries.");
  }

  const sortedDenylist = [...denylist].sort(stableSort);
  if (sortedDenylist.join("\n") !== denylist.join("\n")) {
    throw new Error(
      "Parity denylist must be sorted deterministically. Regenerate via `pnpm -C packages/parity-checking generate:denylist`.",
    );
  }

  const unknownDenylist = denylist.filter((method) => !contractSet.has(method));
  if (unknownDenylist.length > 0) {
    throw new Error(
      `Parity denylist has unknown contract methods (${unknownDenylist.length}): ${unknownDenylist.join(", ")}`,
    );
  }

  const denylistedCovered = denylist.filter((method) => coveredContract.has(method));
  if (denylistedCovered.length > 0) {
    throw new Error(
      `Parity denylist contains already-covered contract methods (${denylistedCovered.length}): ${denylistedCovered.join(", ")}`,
    );
  }

  const uncovered = contractMethods.filter(
    (method) => !coveredContract.has(method) && !denylist.includes(method),
  );

  if (uncovered.length > 0) {
    throw new Error(
      `Parity completeness failed; uncovered canonical methods (${uncovered.length}): ${uncovered.join(", ")}`,
    );
  }

  if (coveredContract.size + denylist.length !== contractMethods.length) {
    throw new Error(
      `Parity completeness invariant failed: covered (${coveredContract.size}) + denylist (${denylist.length}) must equal contract catalog size (${contractMethods.length}).`,
    );
  }

  return {
    contractCount: contractMethods.length,
    coveredCount: coveredContract.size,
    denylistCount: denylist.length,
  };
}
