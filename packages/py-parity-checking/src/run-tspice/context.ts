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
  type RunTspiceContext,
} from "../runtime/context.js";
import { beforeCaseLifecycle, finalizeCaseLifecycle } from "../runtime/lifecycle.js";
import { createCaseRuntimePaths } from "../runtime/path-ref.js";

export type { RunTspiceContext };
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
  return createRunTspiceContextCore(spice, createCaseRuntimePaths(fixturesRoot, caseId));
}

/** Prepare tspice case lifecycle before running steps. */
export const clearKernelState = beforeCaseLifecycle;

/** Finalize tspice case lifecycle after running steps. */
export const cleanupContext = finalizeCaseLifecycle;
