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

export type RunTspiceContext = RuntimeRunTspiceContext;

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

function closeFileIoHandlesBestEffort(context: RunTspiceContext): void {
  for (const entry of context.state.fileIo.handles.values()) {
    if (!entry.isOpen) {
      continue;
    }

    try {
      if (entry.closeWith === "dafcls") {
        context.spice.raw.dafcls(entry.handle);
      } else {
        context.spice.raw.dascls(entry.handle);
      }
    } catch {
      // best-effort cleanup only
    }
  }

  context.state.fileIo.handles.clear();
  context.state.fileIo.descriptors.clear();
  context.state.fileIo.spatialIndexes.clear();
}

/** Finalize tspice case lifecycle after running steps. */
export function cleanupContext(context: RunTspiceContext): void {
  closeFileIoHandlesBestEffort(context);
  finalizeCaseLifecycle(context);
}
