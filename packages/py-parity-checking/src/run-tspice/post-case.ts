import type { RunTspiceContext } from "./context.js";
import type { WorkflowNormalizationMetadata } from "../workflow-normalization/types.js";

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

/** Execute metadata-driven tspice post-case cleanup hooks. */
export function runTspicePostCaseHooks(
  context: RunTspiceContext,
  metadata: WorkflowNormalizationMetadata,
): void {
  const executedScopes = new Set<string>();

  for (const scope of metadata.postCase.cleanupScopes) {
    const key = `${scope.domain}:${scope.scope}`;
    if (executedScopes.has(key)) {
      continue;
    }

    executedScopes.add(key);

    switch (key) {
      case "file-io:open-handles":
        closeFileIoHandlesBestEffort(context);
        break;

      default:
        break;
    }
  }
}
