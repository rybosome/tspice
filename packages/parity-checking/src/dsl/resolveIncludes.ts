import * as path from "node:path";

import { MAX_INCLUDE_DEPTH } from "../config/constants.js";

import type { MethodSpec, WorkflowSpec } from "./types.js";

type ResolveState = {
  readonly rootSourcePath: string;
  readonly workflowIndex: Map<string, WorkflowSpec>;
  readonly visiting: string[];
  readonly emitted: Set<string>;
  readonly ordered: WorkflowSpec[];
};

function formatSourcePath(sourcePath: string): string {
  const rel = path.relative(process.cwd(), sourcePath);
  return rel && !rel.startsWith("..") ? rel : sourcePath;
}

function depthError(rootSourcePath: string, visitingPath: string[]): Error {
  const prettySource = formatSourcePath(rootSourcePath);
  return new Error(
    `Include depth exceeded while resolving ${prettySource}: max=${MAX_INCLUDE_DEPTH}, path=${visitingPath.join(" -> ")}. ` +
      "Update MAX_INCLUDE_DEPTH in packages/parity-checking/src/config/constants.ts if this recursion is intentional.",
  );
}

function resolveOneIncludeById(workflowId: string, state: ResolveState): void {
  const cycleIndex = state.visiting.indexOf(workflowId);
  if (cycleIndex >= 0) {
    const cyclePath = [...state.visiting.slice(cycleIndex), workflowId];
    throw new Error(
      `Include cycle detected while resolving ${formatSourcePath(state.rootSourcePath)}: ${cyclePath.join(" -> ")}`,
    );
  }

  const nextPath = [...state.visiting, workflowId];
  if (nextPath.length > MAX_INCLUDE_DEPTH) {
    throw depthError(state.rootSourcePath, nextPath);
  }

  const workflow = state.workflowIndex.get(workflowId);
  if (!workflow) {
    const parent = state.visiting.at(-1);
    if (parent) {
      throw new Error(
        `Unknown workflow include id ${JSON.stringify(workflowId)} (referenced by ${JSON.stringify(parent)}) while resolving ${formatSourcePath(state.rootSourcePath)}`,
      );
    }

    throw new Error(
      `Unknown workflow include id ${JSON.stringify(workflowId)} while resolving ${formatSourcePath(state.rootSourcePath)}`,
    );
  }

  state.visiting.push(workflowId);
  try {
    for (const childId of workflow.uses ?? []) {
      resolveOneIncludeById(childId, state);
    }
  } finally {
    state.visiting.pop();
  }

  if (!state.emitted.has(workflowId)) {
    state.emitted.add(workflowId);
    state.ordered.push(workflow);
  }
}

/**
 * Resolve `uses` include IDs to concrete workflows in deterministic merge order.
 *
 * Merge order is: include[0] subtree, include[1] subtree, ..., local spec last.
 */
export function resolveMethodIncludes(method: MethodSpec, workflowIndex: Map<string, WorkflowSpec>): WorkflowSpec[] {
  const state: ResolveState = {
    rootSourcePath: method.meta.sourcePath,
    workflowIndex,
    visiting: [],
    emitted: new Set<string>(),
    ordered: [],
  };

  for (const workflowId of method.uses ?? []) {
    resolveOneIncludeById(workflowId, state);
  }

  return state.ordered;
}
