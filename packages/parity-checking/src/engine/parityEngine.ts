import { executeMethodSpecParity } from "./executeMethodSpec.js";
import { loadParitySpecs } from "./loadParitySpecs.js";
import { validateCompleteness } from "../guards/validateCompleteness.js";
import { validateSchema } from "../guards/validateSchema.js";
import { parityProofMarker } from "../proof/nativeProof.js";
import { createCspiceRunner } from "../runners/cspiceRunner.js";
import { createTspiceRunner } from "../runners/tspiceRunner.js";

import type { MethodProofReferenceRecord } from "./executeMethodSpec.js";
import type { CaseRunner } from "../runners/types.js";

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

type ProofLane = "node" | "wasm";

export type ParityProofLaneBackendRecord = {
  lane: ProofLane;
  requestedBackend: ProofLane;
  actualBackend: ProofLane;
  verified: boolean;
};

export type ParityProofSummary = {
  marker: string;
  mode: "generated-dispatch-boundary";
  referenceVerification: "generated-dispatch-seam";
  laneVerification: "strict-required-lanes-no-fallback";
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
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
  methodCaseCount: number;
  proof: ParityProofSummary;
};

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
      `Lane ${lane} requested backend mismatch: expected requested=${lane}, got ${requestedBackend}`,
    );
  }

  if (!actualBackend) {
    throw new Error(
      `Lane ${lane} could not determine actual backend from runner kind=${JSON.stringify(runner.kind)}`,
    );
  }

  if (fallbackDetected) {
    throw new Error(
      `Lane ${lane} detected backend fallback (requested=${requestedBackend}, actual=${actualBackend})`,
    );
  }

  if (actualBackend !== lane) {
    throw new Error(
      `Lane ${lane} backend mismatch: requested=${requestedBackend}, actual=${actualBackend}`,
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

async function withRunners<T>(
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

/** Run parity validation across method specs. */
export async function runParityEngine(): Promise<ParityEngineSummary> {
  const specs = await loadParitySpecs();

  validateSchema(specs);

  const completeness = validateCompleteness(specs.methods);

  const failingCases: string[] = [];
  const proofReferenceRecords: MethodProofReferenceRecord[] = [];
  const proofLaneBackendRecords: ParityProofLaneBackendRecord[] = [];

  let methodCaseCount = 0;

  await withRunners(async (runners) => {
    proofLaneBackendRecords.push(verifyProofLaneRunner("node", runners.node));
    proofLaneBackendRecords.push(verifyProofLaneRunner("wasm", runners.wasm));

    for (const method of specs.methods) {
      try {
        const summary = await executeMethodSpecParity(method, {
          cspice: runners.cspice,
          node: runners.node,
          wasm: runners.wasm,
        });

        methodCaseCount += summary.caseCount;
        proofReferenceRecords.push(...(summary.proofReferenceRecords ?? []));
      } catch (error) {
        const failingCaseId = extractFailingCaseId(error);
        failingCases.push(failingCaseId ? `${method.manifest.id}:${failingCaseId}` : method.manifest.id);
        throw new Error(
          `Method parity execution failed for ${method.manifest.id}: ${formatErrorMessage(error)}`,
          { cause: error instanceof Error ? error : undefined },
        );
      }
    }
  });

  const dedupedReferenceRecords = dedupeProofReferenceRecords(proofReferenceRecords);
  const fallbackDetected = proofLaneBackendRecords.some(
    (record) => record.requestedBackend !== record.actualBackend,
  );

  return {
    skipped: false,
    workflowCount: 0,
    methodCount: specs.methods.length,
    contractCount: completeness.contractCount,
    coveredCount: completeness.coveredCount,
    denylistCount: completeness.denylistCount,
    methodCaseCount,
    proof: {
      marker: parityProofMarker(),
      mode: "generated-dispatch-boundary",
      referenceVerification: "generated-dispatch-seam",
      laneVerification: "strict-required-lanes-no-fallback",
      exceptions: [],
      fallbackDetected,
      failingCases,
      perCaseReferenceRecords: dedupedReferenceRecords,
      perLaneBackendRecords: proofLaneBackendRecords,
    },
  };
}
