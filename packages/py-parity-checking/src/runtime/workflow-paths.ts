import path from "node:path";

import type { PathRef, StepKernelsFurnsh, WorkflowStep } from "../case-types.js";
import { toPathRef } from "./path-ref.js";

function tryNormalizeRelativePath(rawPath: string): string | null {
  if (path.isAbsolute(rawPath)) {
    return null;
  }

  try {
    return toPathRef(rawPath).rel;
  } catch {
    return null;
  }
}

function collectEkScratchRelativePaths(workflow: WorkflowStep[]): Set<string> {
  const ekScratchPaths = new Set<string>();

  for (const step of workflow) {
    if (step.op !== "ek.ekopn" && step.op !== "ek.ekopr" && step.op !== "ek.ekopw") {
      continue;
    }

    const normalizedRel = tryNormalizeRelativePath(step.path);
    if (normalizedRel != null) {
      ekScratchPaths.add(normalizedRel);
    }
  }

  return ekScratchPaths;
}

function normalizeFurnshFile(
  file: StepKernelsFurnsh["file"],
  ekScratchPaths: Set<string>,
): PathRef {
  if (typeof file === "string") {
    const normalizedRel = tryNormalizeRelativePath(file);
    if (normalizedRel != null && ekScratchPaths.has(normalizedRel)) {
      return {
        kind: "scratch",
        rel: normalizedRel,
      };
    }
  }

  return toPathRef(file);
}

/**
 * Normalize workflow kernel-file references for parity runs.
 *
 * Legacy `kernels.furnsh` string paths are fixture-relative by default, but EK
 * workflows use string paths to refer to case-scoped scratch outputs created by
 * `ekopn/ekopw/ekopr`. We promote those references to explicit scratch PathRefs
 * so both tspice and sidecar runs resolve them consistently.
 */
export function withNormalizedWorkflowPathRefs(workflow: WorkflowStep[]): WorkflowStep[] {
  const ekScratchPaths = collectEkScratchRelativePaths(workflow);

  return workflow.map((step) => {
    if (step.op !== "kernels.furnsh") {
      return step;
    }

    return {
      ...step,
      file: normalizeFurnshFile(step.file, ekScratchPaths),
    } satisfies StepKernelsFurnsh;
  });
}
