import type {
  StepFramesCkcov,
  StepFramesCklpf,
  StepFramesCkobj,
  WorkflowStep,
} from "../../case-types.js";
import { toPathRef } from "../../fixtures.js";

import type { DomainNormalizer, WorkflowNormalizationMetadata } from "../types.js";

type FramesCkPathStep = StepFramesCklpf | StepFramesCkobj | StepFramesCkcov;

function normalizeFramesCkPath(step: FramesCkPathStep): FramesCkPathStep {
  return {
    ...step,
    ck: toPathRef(step.ck),
  };
}

function publishFramesCkCanonicalizationHint(
  step: FramesCkPathStep,
  metadata: WorkflowNormalizationMetadata,
): void {
  metadata.runtimePath.canonicalizationHints.push({
    domain: "frames",
    op: step.op,
    field: "ck",
    canonicalPath: toPathRef(step.ck),
  });
}

export const framesNormalizer: DomainNormalizer = {
  name: "frames",

  normalize(step: WorkflowStep) {
    switch (step.op) {
      case "frames.cklpf":
      case "frames.ckobj":
      case "frames.ckcov":
        return normalizeFramesCkPath(step);

      default:
        return step;
    }
  },

  analyze(step, _context, metadata) {
    switch (step.op) {
      case "frames.cklpf":
      case "frames.ckobj":
      case "frames.ckcov":
        publishFramesCkCanonicalizationHint(step, metadata);
        return;

      default:
        return;
    }
  },
};
