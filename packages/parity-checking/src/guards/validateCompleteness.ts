import { readContractCatalog } from "../generated/readContractCatalog.js";
import { readMethodSurfaceRegistry } from "../generated/readMethodSurfaceRegistry.js";
import { readParityDenylist } from "../generated/readParityDenylist.js";
import { methodCanonicalMethod } from "../dsl/types.js";
import {
  BASELINE_CONTRACT_METHOD_COUNT,
  BASELINE_CONTRACT_METHOD_COVERAGE,
  BASELINE_METHOD_SPEC_COVERAGE,
  BASELINE_UNCOVERED_CONTRACT_METHODS,
} from "./completenessBaseline.js";

import type { AnyMethodSpec } from "../dsl/types.js";

export type CompletenessValidationSummary = {
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
};

/** Enforce parity catalog coverage invariants for the v3 migration baseline. */
export function validateCompleteness(methodSpecs: AnyMethodSpec[]): CompletenessValidationSummary {
  const contractMethods = readContractCatalog();
  const methodSurface = readMethodSurfaceRegistry();
  const denylist = readParityDenylist();

  const coveredCanonical = new Set(methodSpecs.map((method) => methodCanonicalMethod(method)));
  const methodSurfaceCanonical = methodSurface.map((entry) => entry.canonicalMethod);
  const methodSurfaceSet = new Set(methodSurfaceCanonical);

  const missingMethodSurfaceCoverage = methodSurfaceCanonical.filter(
    (canonicalMethod) => !coveredCanonical.has(canonicalMethod),
  );
  const unexpectedCoveredCanonical = [...coveredCanonical].filter(
    (canonicalMethod) => !methodSurfaceSet.has(canonicalMethod),
  );

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

  if (methodSurface.length !== BASELINE_METHOD_SPEC_COVERAGE) {
    throw new Error(
      `Method-surface registry size changed from baseline ${BASELINE_METHOD_SPEC_COVERAGE} to ${methodSurface.length}. ` +
        "Update registry/specs together and regenerate artifacts.",
    );
  }

  if (missingMethodSurfaceCoverage.length > 0 || unexpectedCoveredCanonical.length > 0) {
    const missingPreview = missingMethodSurfaceCoverage.slice(0, 8).join(", ");
    const unexpectedPreview = unexpectedCoveredCanonical.slice(0, 8).join(", ");

    const diagnostics = [
      `missing=${missingMethodSurfaceCoverage.length}`,
      `unexpected=${unexpectedCoveredCanonical.length}`,
      missingPreview ? `missingSample=${missingPreview}${missingMethodSurfaceCoverage.length > 8 ? ", ..." : ""}` : "",
      unexpectedPreview
        ? `unexpectedSample=${unexpectedPreview}${unexpectedCoveredCanonical.length > 8 ? ", ..." : ""}`
        : "",
    ]
      .filter(Boolean)
      .join("; ");

    throw new Error(
      "Parity method-spec coverage must exactly match registry/method-surface.yml. " + diagnostics,
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
