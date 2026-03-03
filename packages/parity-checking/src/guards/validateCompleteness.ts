import { readContractCatalog } from "../generated/readContractCatalog.js";
import { readParityDenylist } from "../generated/readParityDenylist.js";
import { methodCanonicalMethod } from "../dsl/types.js";

import type { AnyMethodSpec } from "../dsl/types.js";

const BASELINE_METHOD_SPEC_COVERAGE = 114;

export type CompletenessValidationSummary = {
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
};

/** Enforce parity catalog coverage invariants for the v3 migration baseline. */
export function validateCompleteness(methodSpecs: AnyMethodSpec[]): CompletenessValidationSummary {
  const contractMethods = readContractCatalog();
  const denylist = readParityDenylist();

  const coveredCanonical = new Set(methodSpecs.map((method) => methodCanonicalMethod(method)));

  if (denylist.length !== 0) {
    throw new Error(
      `Parity denylist must be empty in v3 baseline migration (expected 0, got ${denylist.length}). Regenerate via \`pnpm -C packages/parity-checking generate:denylist\`.`,
    );
  }

  if (coveredCanonical.size !== BASELINE_METHOD_SPEC_COVERAGE) {
    throw new Error(
      `Method-spec coverage changed from baseline ${BASELINE_METHOD_SPEC_COVERAGE} to ${coveredCanonical.size}. ` +
        "This migration PR must preserve existing parity-tested method coverage.",
    );
  }

  return {
    contractCount: contractMethods.length,
    coveredCount: coveredCanonical.size,
    denylistCount: denylist.length,
  };
}
