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
import { normalizeError } from "./utils/errors.js";

/** Execute one parity case against tspice (WASM backend) with per-case kernel isolation. */
export function runCaseInTspice(
  spice: Spice,
  parityCase: ParityCase,
  fixturesRoot: string,
): CaseExecutionResult {
  const context = createRunTspiceContext(spice, fixturesRoot);

  try {
    clearKernelState(context);

    const outputs: StepOutput[] = [];
    for (const step of parityCase.workflow) {
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
    cleanupContext(context);
  }
}
