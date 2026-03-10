import { executeMethodSpecParityV2 } from "./executeMethodSpecV2.js";

import type { MethodSpecV3 } from "../dsl/types.js";
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

/**
* Canonical parity executor entrypoint.
*/
export async function executeMethodSpecParity(
  input: MethodSpecV3,
  runners: {
    tspice: CaseRunner;
    cspice: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  return executeMethodSpecParityV2(input, runners);
}
