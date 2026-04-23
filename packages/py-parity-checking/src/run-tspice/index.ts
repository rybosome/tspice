import type {
  CaseExecutionFailure,
  CaseExecutionResult,
  CaseExecutionSuccess,
  ParityCase,
  StepOutput,
} from "../case-types.js";
import type { Spice } from "@rybosome/tspice";

import { cleanupContext, clearKernelState, createRunTspiceContext } from "./context.js";
import { dispatchStep } from "./dispatch.js";
import { runTspicePostCaseHooks } from "./post-case.js";
import { normalizeError } from "./utils/errors.js";
import { normalizeWorkflowDetailed } from "../workflow-normalization/index.js";

/** Execute one parity case against tspice (WASM backend) with per-case kernel isolation. */
export function runCaseInTspice(
  spice: Spice,
  parityCase: ParityCase,
  fixturesRoot: string,
): CaseExecutionResult {
  const context = createRunTspiceContext(spice, fixturesRoot, parityCase.caseId);

  try {
    clearKernelState(context);

    const normalized = normalizeWorkflowDetailed(parityCase.workflow, "tspice");
    context.normalization.metadata = normalized.metadata;

    const outputs: StepOutput[] = [];
    for (const step of normalized.workflow) {
      outputs.push(dispatchStep(context, step));
    }

    const result: CaseExecutionSuccess = {
      caseId: parityCase.caseId,
      ok: true,
      outputs,
      error: null,
    };
    return result;
  } catch (error) {
    const normalized = normalizeError(error);
    const failed: CaseExecutionFailure = {
      caseId: parityCase.caseId,
      ok: false,
      outputs: [],
      error: normalized,
    };
    return failed;
  } finally {
    runTspicePostCaseHooks(context, context.normalization.metadata);
    cleanupContext(context);
  }
}
