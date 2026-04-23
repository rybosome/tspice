import type { WorkflowStep } from "../case-types.js";

import { createNormalizationContext } from "./context.js";
import { normalizers } from "./domains/index.js";
import type {
  NormalizeTarget,
  NormalizedWorkflowResult,
  WorkflowNormalizationMetadata,
} from "./types.js";

/** Create a deterministic empty metadata envelope for one normalization run. */
export function createEmptyWorkflowNormalizationMetadata(): WorkflowNormalizationMetadata {
  return {
    preCase: {
      cleanupCandidates: [],
    },
    postCase: {
      cleanupScopes: [],
    },
    runtimePath: {
      canonicalizationHints: [],
    },
  };
}

/** Normalize a parity workflow and return both normalized steps and metadata lanes. */
export function normalizeWorkflowDetailed(
  workflow: WorkflowStep[],
  target: NormalizeTarget,
): NormalizedWorkflowResult {
  const context = createNormalizationContext(target);

  for (const step of workflow) {
    for (const normalizer of normalizers) {
      normalizer.publish?.(step, context);
    }
  }

  const normalizedWorkflow = workflow.map((step) => {
    let normalizedStep = step;
    for (const normalizer of normalizers) {
      if (normalizer.normalize != null) {
        normalizedStep = normalizer.normalize(normalizedStep, context);
      }
    }
    return normalizedStep;
  });

  const metadata = createEmptyWorkflowNormalizationMetadata();

  for (const step of normalizedWorkflow) {
    for (const normalizer of normalizers) {
      normalizer.analyze?.(step, context, metadata);
    }
  }

  return {
    workflow: normalizedWorkflow,
    metadata,
  };
}

/** Normalize a parity workflow via deterministic publish/normalize/analyze processing. */
export function normalizeWorkflow(workflow: WorkflowStep[], target: NormalizeTarget): WorkflowStep[] {
  return normalizeWorkflowDetailed(workflow, target).workflow;
}
