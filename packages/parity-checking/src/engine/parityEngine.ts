import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverYamlFiles } from "../dsl/discoverYamlFiles.js";
import { loadYamlFile } from "../dsl/loadYaml.js";
import { parseCrossCuttingSpec, parseMethodSpec } from "../dsl/schemaValidate.js";
import { executeCrossCuttingSpec } from "./executeCrossCuttingSpec.js";
import { executeMethodSpecParityV2 } from "./executeMethodSpecV2.js";
import { validateCompleteness } from "../guards/validateCompleteness.js";
import { validateCrossCuttingSpecs } from "../guards/validateCrossCuttingSpecs.js";
import { validateSchema } from "../guards/validateSchema.js";
import {
  PARITY_PROOF_NATIVE_V2_ENV,
  PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST,
  isParityProofNativeV2Enabled,
  parityProofMarker,
} from "../proof/nativeProof.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../runners/cspiceRunner.js";
import { createTspiceRunner } from "../runners/tspiceRunner.js";

import { crossCuttingSpecId, methodSpecId } from "../dsl/types.js";
import type { LoadedParitySpecs } from "../dsl/types.js";
import type { MethodProofReferenceRecord } from "./executeMethodSpec.js";
import type { CaseRunner } from "../runners/types.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function extractFailingCaseId(error: unknown): string | undefined {
  const message = formatErrorMessage(error);
  const match = message.match(/\bcase=([^\s:]+)/);
  return match?.[1];
}

async function loadParitySpecs(): Promise<LoadedParitySpecs> {
  const root = packageRoot();

  const methodFiles = discoverYamlFiles(path.join(root, "specs", "methods"));
  const crossCuttingFiles = discoverYamlFiles(path.join(root, "specs", "cross-cutting"));

  const methods = (
    await Promise.all(methodFiles.map(async (filePath) => parseMethodSpec(await loadYamlFile(filePath))))
  ).sort((a, b) => stableSort(methodSpecId(a), methodSpecId(b)));

  const crossCutting = (
    await Promise.all(
      crossCuttingFiles.map(async (filePath) => parseCrossCuttingSpec(await loadYamlFile(filePath))),
    )
  ).sort((a, b) => stableSort(crossCuttingSpecId(a), crossCuttingSpecId(b)));

  return {
    workflows: [],
    methods,
    crossCutting,
  };
}

type ProofLane = "node" | "wasm";

export type ParityProofLaneBackendRecord = {
  lane: ProofLane;
  requestedBackend: ProofLane;
  actualBackend: ProofLane;
  verified: boolean;
};

export type ParityProofSummary = {
  marker: string;
  mode: "disabled" | "native-v2";
  referenceVerification: "disabled" | "native-cspice-runner";
  laneVerification: "disabled" | "strict-requested-equals-actual";
  exceptions: string[];
  fallbackDetected: boolean;
  failingCases: string[];
  perCaseReferenceRecords: MethodProofReferenceRecord[];
  perLaneBackendRecords: ParityProofLaneBackendRecord[];
};

export type ParityEngineSummary = {
  skipped: boolean;
  skipReason?: string;
  workflowCount: number;
  methodCount: number;
  crossCuttingSpecCount: number;
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
  methodCaseCount: number;
  crossCuttingCaseCount: number;
  proof: ParityProofSummary;
};

function buildDisabledProofSummary(): ParityProofSummary {
  return {
    marker: "proof=disabled",
    mode: "disabled",
    referenceVerification: "disabled",
    laneVerification: "disabled",
    exceptions: [...PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST],
    fallbackDetected: false,
    failingCases: [],
    perCaseReferenceRecords: [],
    perLaneBackendRecords: [],
  };
}

function backendFromRunnerKind(kind: string): ProofLane | undefined {
  if (kind === "tspice(node)") {
    return "node";
  }

  if (kind === "tspice(wasm)") {
    return "wasm";
  }

  return undefined;
}

function verifyProofLaneRunner(lane: ProofLane, runner: CaseRunner): ParityProofLaneBackendRecord {
  const actualBackend = runner.backendMetadata?.actualBackend ?? backendFromRunnerKind(runner.kind);
  const requestedBackend = runner.backendMetadata?.requestedBackend ?? lane;
  const fallbackDetected = runner.backendMetadata?.fallbackDetected ?? false;

  if (requestedBackend !== lane) {
    throw new Error(
      `Proof lane ${lane} requested backend mismatch: expected requested=${lane}, got ${requestedBackend}`,
    );
  }

  if (!actualBackend) {
    throw new Error(
      `Proof lane ${lane} could not determine actual backend from runner kind=${JSON.stringify(runner.kind)}`,
    );
  }

  if (fallbackDetected) {
    throw new Error(
      `Proof lane ${lane} detected backend fallback (requested=${requestedBackend}, actual=${actualBackend})`,
    );
  }

  if (actualBackend !== lane) {
    throw new Error(
      `Proof lane ${lane} backend mismatch: requested=${requestedBackend}, actual=${actualBackend}`,
    );
  }

  return {
    lane,
    requestedBackend: lane,
    actualBackend,
    verified: true,
  };
}

function dedupeProofReferenceRecords(
  records: MethodProofReferenceRecord[],
): MethodProofReferenceRecord[] {
  const deduped = new Map<string, MethodProofReferenceRecord>();

  for (const record of records) {
    const key = `${record.method}::${record.caseId}::${record.transport}::${record.ops.join(",")}`;
    deduped.set(key, record);
  }

  return [...deduped.values()];
}

function requiresWasmProofLane(records: MethodProofReferenceRecord[] | undefined): boolean {
  return (records ?? []).some((record) => record.transport === "native-cspice-runner");
}

async function withRunners<T>(
  fn: (runners: { tspice: CaseRunner; cspice: CaseRunner }) => Promise<T>,
): Promise<T> {
  let tspice: CaseRunner | undefined;
  let cspice: CaseRunner | undefined;

  try {
    tspice = await createTspiceRunner();
    cspice = await createCspiceRunner();

    return await fn({ tspice, cspice });
  } finally {
    await Promise.allSettled([tspice?.dispose?.(), cspice?.dispose?.()]);
  }
}

async function withProofRunners<T>(
  fn: (runners: { node: CaseRunner; wasm: CaseRunner; cspice: CaseRunner }) => Promise<T>,
): Promise<T> {
  let node: CaseRunner | undefined;
  let wasm: CaseRunner | undefined;
  let cspice: CaseRunner | undefined;

  try {
    node = await createTspiceRunner({ backend: "node" });
    wasm = await createTspiceRunner({ backend: "wasm" });
    cspice = await createCspiceRunner();

    return await fn({ node, wasm, cspice });
  } finally {
    await Promise.allSettled([node?.dispose?.(), wasm?.dispose?.(), cspice?.dispose?.()]);
  }
}

/** Run parity validation across cross-cutting specs and method specs. */
export async function runParityEngine(): Promise<ParityEngineSummary> {
  const specs = await loadParitySpecs();

  validateSchema(specs);

  const completeness = validateCompleteness(specs.methods);
  validateCrossCuttingSpecs(specs.crossCutting);

  const proofEnabled = isParityProofNativeV2Enabled();
  const proofDisabledSummary = buildDisabledProofSummary();

  const status = getCspiceRunnerStatus();
  if (!status.ready) {
    if (proofEnabled) {
      throw new Error(
        `cspice-runner unavailable in proof mode (${PARITY_PROOF_NATIVE_V2_ENV}=1): ${status.hint}`,
      );
    }

    return {
      skipped: true,
      skipReason: `cspice-runner unavailable: ${status.hint}`,
      workflowCount: 0,
      methodCount: specs.methods.length,
      crossCuttingSpecCount: specs.crossCutting.length,
      contractCount: completeness.contractCount,
      coveredCount: completeness.coveredCount,
      denylistCount: completeness.denylistCount,
      methodCaseCount: 0,
      crossCuttingCaseCount: 0,
      proof: proofDisabledSummary,
    };
  }

  if (!proofEnabled) {
    const paritySummary = await withRunners(async (runners) => {
      let crossCuttingCaseCount = 0;
      for (const spec of specs.crossCutting) {
        const summary = await executeCrossCuttingSpec(spec);
        crossCuttingCaseCount += summary.caseCount;
      }

      let methodCaseCount = 0;
      for (const method of specs.methods) {
        const summary = await executeMethodSpecParityV2(method, runners);
        methodCaseCount += summary.caseCount;
      }

      return {
        skipped: false,
        workflowCount: 0,
        methodCount: specs.methods.length,
        crossCuttingSpecCount: specs.crossCutting.length,
        contractCount: completeness.contractCount,
        coveredCount: completeness.coveredCount,
        denylistCount: completeness.denylistCount,
        methodCaseCount,
        crossCuttingCaseCount,
      };
    });

    return {
      ...paritySummary,
      proof: proofDisabledSummary,
    };
  }

  const failingCases: string[] = [];
  const proofReferenceRecords: MethodProofReferenceRecord[] = [];
  const proofLaneBackendRecords: ParityProofLaneBackendRecord[] = [];

  let paritySummary:
    | Omit<ParityEngineSummary, "proof">
    | undefined;

  try {
    paritySummary = await withProofRunners(async (runners) => {
      proofLaneBackendRecords.push(verifyProofLaneRunner("node", runners.node));
      proofLaneBackendRecords.push(verifyProofLaneRunner("wasm", runners.wasm));

      let crossCuttingCaseCount = 0;
      for (const spec of specs.crossCutting) {
        const summary = await executeCrossCuttingSpec(spec);
        crossCuttingCaseCount += summary.caseCount;
      }

      let methodCaseCount = 0;
      for (const method of specs.methods) {
        try {
          const nodeSummary = await executeMethodSpecParityV2(method, {
            tspice: runners.node,
            cspice: runners.cspice,
          });
          methodCaseCount += nodeSummary.caseCount;
          proofReferenceRecords.push(...(nodeSummary.proofReferenceRecords ?? []));

          if (requiresWasmProofLane(nodeSummary.proofReferenceRecords)) {
            const wasmSummary = await executeMethodSpecParityV2(method, {
              tspice: runners.wasm,
              cspice: runners.cspice,
            });

            if (nodeSummary.caseCount !== wasmSummary.caseCount) {
              throw new Error(
                `Proof lane case-count mismatch for ${method.manifest.id}: node=${nodeSummary.caseCount} wasm=${wasmSummary.caseCount}`,
              );
            }

            proofReferenceRecords.push(...(wasmSummary.proofReferenceRecords ?? []));
          }
        } catch (error) {
          const failingCaseId = extractFailingCaseId(error);
          failingCases.push(
            failingCaseId ? `${method.manifest.id}:${failingCaseId}` : method.manifest.id,
          );
          throw new Error(
            `Method proof execution failed for ${method.manifest.id}: ${formatErrorMessage(error)}`,
            { cause: error instanceof Error ? error : undefined },
          );
        }
      }

      return {
        skipped: false,
        workflowCount: 0,
        methodCount: specs.methods.length,
        crossCuttingSpecCount: specs.crossCutting.length,
        contractCount: completeness.contractCount,
        coveredCount: completeness.coveredCount,
        denylistCount: completeness.denylistCount,
        methodCaseCount,
        crossCuttingCaseCount,
      };
    });
  } catch (error) {
    const failed = failingCases.length > 0 ? ` failingCases=${failingCases.join(",")}` : "";
    throw new Error(
      `Proof parity execution failed (${parityProofMarker()})${failed}: ${formatErrorMessage(error)}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (!paritySummary) {
    throw new Error("Proof parity execution did not produce a summary");
  }

  const dedupedReferenceRecords = dedupeProofReferenceRecords(proofReferenceRecords);
  const fallbackDetected = proofLaneBackendRecords.some(
    (record) => record.requestedBackend !== record.actualBackend,
  );

  return {
    ...paritySummary,
    proof: {
      marker: parityProofMarker(),
      mode: "native-v2",
      referenceVerification: "native-cspice-runner",
      laneVerification: "strict-requested-equals-actual",
      exceptions: [...PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST],
      fallbackDetected,
      failingCases,
      perCaseReferenceRecords: dedupedReferenceRecords,
      perLaneBackendRecords: proofLaneBackendRecords,
    },
  };
}
