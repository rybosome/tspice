import { buildWorkflowIndex } from "../dsl/buildWorkflowIndex.js";
import { resolveMethodIncludes } from "../dsl/resolveIncludes.js";
import { isMethodSpecV2 } from "../dsl/types.js";

import type { LoadedParitySpecs } from "../dsl/types.js";

/** Validate include references and cycles across method specs. */
export function validateIncludeGraph(specs: LoadedParitySpecs): void {
  const workflowIndex = buildWorkflowIndex(specs.workflows);

  for (const method of specs.methods) {
    if (isMethodSpecV2(method)) {
      continue;
    }

    resolveMethodIncludes(method, workflowIndex);
  }
}
