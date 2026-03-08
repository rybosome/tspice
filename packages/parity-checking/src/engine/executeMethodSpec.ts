import { mergeCompareChain, mergeSetupChain } from "../dsl/mergeResolvedSpec.js";
import { executeMethodSpecParityV2 } from "./executeMethodSpecV2.js";

import type { MethodSpecV2, ScenarioCompareAst, ScenarioSetupAst } from "../dsl/types.js";
import type { ReferenceTransport } from "../proof/nativeProof.js";
import type { CaseRunner } from "../runners/types.js";

export type MethodProofReferenceRecord = {
  method: string;
  caseId: string;
  transport: ReferenceTransport;
  ops: string[];
};

export type MethodExecutionSummary = {
  methodId: string;
  caseCount: number;
  proofReferenceRecords?: MethodProofReferenceRecord[];
};

type LegacyResolvedLike = {
  method: {
    id?: string;
    kind?: "method";
    contractMethod?: string;
    canonicalMethod?: string;
    contract?: MethodSpecV2["contract"];
    setup?: ScenarioSetupAst;
    defaults?: { compare?: ScenarioCompareAst };
    workflow?: MethodSpecV2["workflow"];
    cases?: MethodSpecV2["cases"];
    suites?: MethodSpecV2["suites"];
    meta?: { sourcePath?: string };
    manifest?: MethodSpecV2["manifest"];
  };
  mergedSetup?: ScenarioSetupAst;
  mergedCompareDefaults?: ScenarioCompareAst;
};

function isMethodSpecV3Like(input: unknown): input is MethodSpecV2 {
  return (
    typeof input === "object" &&
    input !== null &&
    "manifest" in input &&
    "contract" in input
  );
}

function isLegacyResolvedLike(input: unknown): input is LegacyResolvedLike {
  return typeof input === "object" && input !== null && "method" in input;
}

function toMethodSpecV3(input: MethodSpecV2 | LegacyResolvedLike): MethodSpecV2 {
  if (isMethodSpecV3Like(input)) {
    return input;
  }

  const legacy = input.method;
  const mergedSetup = mergeSetupChain([input.mergedSetup, legacy.setup]);
  const mergedCompare = mergeCompareChain([input.mergedCompareDefaults, legacy.defaults?.compare]);

  const manifestId = legacy.manifest?.id ?? legacy.id ?? "methods/unknown@v3";

  return {
    schemaVersion: 3,
    manifest: legacy.manifest ?? {
      id: manifestId,
      kind: "method",
    },
    contract:
      legacy.contract ?? {
        contractMethod: legacy.contractMethod ?? "unknown.method",
        canonicalMethod: legacy.canonicalMethod ?? legacy.contractMethod ?? "unknown.method",
      },
    ...(mergedSetup ? { setup: mergedSetup } : {}),
    ...(mergedCompare ? { defaults: { compare: mergedCompare } } : {}),
    workflow:
      legacy.workflow ?? {
        steps: [{ op: "callContract" }],
      },
    cases: legacy.cases ?? [],
    ...(legacy.suites !== undefined ? { suites: legacy.suites } : {}),
    meta: {
      sourcePath: legacy.meta?.sourcePath ?? "legacy-adapter",
    },
  };
}

/**
 * v3 parity executor entrypoint.
 *
 * Historically this module handled legacy v1 specs; now it delegates to the unified
 * v3 method executor implemented in `executeMethodSpecV2` (name retained for churn minimization).
 */
export async function executeMethodSpecParity(
  input: MethodSpecV2 | LegacyResolvedLike,
  runners: {
    tspice: CaseRunner;
    cspice: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  return executeMethodSpecParityV2(toMethodSpecV3(input), runners);
}
