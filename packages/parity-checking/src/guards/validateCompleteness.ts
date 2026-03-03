import { readContractCatalog } from "../generated/readContractCatalog.js";
import { readParityDenylist } from "../generated/readParityDenylist.js";
import { methodCanonicalMethod } from "../dsl/types.js";

import type { AnyMethodSpec } from "../dsl/types.js";

const BASELINE_METHOD_SPEC_COVERAGE = 114;
const BASELINE_CONTRACT_METHOD_COVERAGE = 103;
const BASELINE_CONTRACT_METHOD_COUNT = 162;
const BASELINE_UNCOVERED_CONTRACT_METHODS =
  BASELINE_CONTRACT_METHOD_COUNT - BASELINE_CONTRACT_METHOD_COVERAGE;

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
  const contractSet = new Set(contractMethods);
  const coveredContract = new Set(
    [...coveredCanonical].filter((canonicalMethod) => contractSet.has(canonicalMethod)),
  );
  const uncovered = contractMethods.filter((contractMethod) => !coveredContract.has(contractMethod));

  if (denylist.length !== 0) {
    throw new Error(
      `Parity denylist must be empty in v3 baseline migration (expected 0, got ${denylist.length}). Regenerate via \`pnpm -C packages/parity-checking generate:denylist\`.`,
    );
  }

  if (contractMethods.length !== BASELINE_CONTRACT_METHOD_COUNT) {
    throw new Error(
      `Contract catalog size changed from baseline ${BASELINE_CONTRACT_METHOD_COUNT} to ${contractMethods.length}. ` +
        "This migration PR must preserve current parity catalog expectations.",
    );
  }

  if (coveredCanonical.size !== BASELINE_METHOD_SPEC_COVERAGE) {
    throw new Error(
      `Method-spec coverage changed from baseline ${BASELINE_METHOD_SPEC_COVERAGE} to ${coveredCanonical.size}. ` +
        "This migration PR must preserve existing parity-tested method coverage.",
    );
  }

  if (coveredContract.size !== BASELINE_CONTRACT_METHOD_COVERAGE) {
    throw new Error(
      `Contract-scoped method coverage changed from baseline ${BASELINE_CONTRACT_METHOD_COVERAGE} to ${coveredContract.size}. ` +
        "This migration PR must preserve existing contract-scoped parity coverage.",
    );
  }

  if (uncovered.length !== BASELINE_UNCOVERED_CONTRACT_METHODS) {
    const uncoveredPreview = uncovered.slice(0, 8).join(", ");
    const previewSuffix = uncovered.length > 8 ? ", ..." : "";

    throw new Error(
      `Parity completeness failed; uncovered catalog methods changed from baseline ${BASELINE_UNCOVERED_CONTRACT_METHODS} to ${uncovered.length}. ` +
        `Current uncovered sample: ${uncoveredPreview}${previewSuffix}`,
    );
  }

  return {
    contractCount: contractMethods.length,
    coveredCount: coveredCanonical.size,
    denylistCount: denylist.length,
  };
}
