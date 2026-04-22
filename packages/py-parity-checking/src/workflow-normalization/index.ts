import type { WorkflowStep } from "../case-types.js";

import { createNormalizationContext } from "./context.js";
import { normalizers } from "./domains/index.js";
import type { NormalizeTarget } from "./types.js";

/** Normalize a parity workflow via deterministic two-pass domain processing. */
export function normalizeWorkflow(workflow: WorkflowStep[], target: NormalizeTarget): WorkflowStep[] {
  const context = createNormalizationContext(target);

  for (const step of workflow) {
    for (const normalizer of normalizers) {
      normalizer.publish?.(step, context);
    }
  }

  return workflow.map((step) => {
    let normalizedStep = step;
    for (const normalizer of normalizers) {
      if (normalizer.normalize != null) {
        normalizedStep = normalizer.normalize(normalizedStep, context);
      }
    }
    return normalizedStep;
  });
}
