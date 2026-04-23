import type { Spice } from "@rybosome/tspice";

import {
  createRunTspiceContext as createRunTspiceContextCore,
  getOrCreateCharCell,
  getOrCreateDoubleCell,
  getOrCreateIntCell,
  getOrCreateWindow,
  registerFinalizer,
  requireCharCell,
  requireDoubleCell,
  requireIntCell,
  requireWindow,
  type RunTspiceContext as RuntimeRunTspiceContext,
} from "../runtime/context.js";
import { beforeCaseLifecycle, finalizeCaseLifecycle } from "../runtime/lifecycle.js";
import { createCaseRuntimePaths } from "../runtime/path-ref.js";
import { createEmptyWorkflowNormalizationMetadata } from "../workflow-normalization/index.js";
import type { WorkflowNormalizationMetadata } from "../workflow-normalization/types.js";

export type RunTspiceContext = RuntimeRunTspiceContext & {
  normalization: {
    metadata: WorkflowNormalizationMetadata;
  };
};

export {
  getOrCreateCharCell,
  getOrCreateDoubleCell,
  getOrCreateIntCell,
  getOrCreateWindow,
  registerFinalizer,
  requireCharCell,
  requireDoubleCell,
  requireIntCell,
  requireWindow,
};

/** Create per-case tspice execution context with runtime fixture/scratch roots. */
export function createRunTspiceContext(
  spice: Spice,
  fixturesRoot: string,
  caseId: string,
): RunTspiceContext {
  return {
    ...createRunTspiceContextCore(spice, createCaseRuntimePaths(fixturesRoot, caseId)),
    normalization: {
      metadata: createEmptyWorkflowNormalizationMetadata(),
    },
  };
}

/** Prepare tspice case lifecycle before running steps. */
export const clearKernelState = beforeCaseLifecycle;

/** Finalize tspice case lifecycle after running steps. */
export function cleanupContext(context: RunTspiceContext): void {
  finalizeCaseLifecycle(context);
}
