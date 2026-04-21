import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import type { Spice } from "@rybosome/tspice";

import {
  createRunTspiceContext as createRunTspiceContextCore,
  getOrCreateCharCell,
  getOrCreateDoubleCell,
  getOrCreateIntCell,
  type EkSegmentState,
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

/** Track a newly opened EK handle by workflow-local ID. */
export function registerEkHandle(
  context: RunTspiceContext,
  handleId: string,
  handle: SpiceHandle,
): void {
  if (context.state.ek.handles.has(handleId)) {
    throw new Error(`EK handle already exists: ${handleId}`);
  }

  context.state.ek.handles.set(handleId, handle);
  registerFinalizer(context, `ek.closeHandle:${handleId}`, () => {
    const tracked = context.state.ek.handles.get(handleId);
    if (tracked == null) {
      return;
    }
    try {
      context.spice.raw.ekcls(tracked);
    } catch {
      // best-effort cleanup only
    }
    context.state.ek.handles.delete(handleId);
    clearSegmentsForHandle(context, handleId);
  });
}

/** Require an existing EK handle by workflow-local ID. */
export function requireEkHandle(context: RunTspiceContext, handleId: string): SpiceHandle {
  const handle = context.state.ek.handles.get(handleId);
  if (handle == null) {
    throw new Error(`EK handle does not exist: ${handleId}`);
  }
  return handle;
}

function clearSegmentsForHandle(context: RunTspiceContext, handleId: string): void {
  for (const [segmentId, segment] of context.state.ek.segments.entries()) {
    if (segment.handleId === handleId) {
      context.state.ek.segments.delete(segmentId);
    }
  }
}

/** Close and remove an EK handle by workflow-local ID. */
export function closeEkHandle(context: RunTspiceContext, handleId: string): void {
  const handle = requireEkHandle(context, handleId);
  context.spice.raw.ekcls(handle);
  context.state.ek.handles.delete(handleId);
  clearSegmentsForHandle(context, handleId);
}

/** Track a workflow-local EK fast-write segment. */
export function registerEkSegment(
  context: RunTspiceContext,
  segmentId: string,
  segment: EkSegmentState,
): void {
  if (context.state.ek.segments.has(segmentId)) {
    throw new Error(`EK segment already exists: ${segmentId}`);
  }
  context.state.ek.segments.set(segmentId, segment);
}

/** Require an existing EK segment by workflow-local ID. */
export function requireEkSegment(context: RunTspiceContext, segmentId: string): EkSegmentState {
  const segment = context.state.ek.segments.get(segmentId);
  if (segment == null) {
    throw new Error(`EK segment does not exist: ${segmentId}`);
  }
  return segment;
}

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
