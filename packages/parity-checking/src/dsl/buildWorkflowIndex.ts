import type { WorkflowSpec } from "./types.js";

export function buildWorkflowIndex(workflows: WorkflowSpec[]): Map<string, WorkflowSpec> {
  const byId = new Map<string, WorkflowSpec>();

  for (const workflow of workflows) {
    const existing = byId.get(workflow.id);
    if (existing) {
      throw new Error(
        `Duplicate workflow id ${JSON.stringify(workflow.id)} in ${existing.meta.sourcePath} and ${workflow.meta.sourcePath}`,
      );
    }

    byId.set(workflow.id, workflow);
  }

  return byId;
}
