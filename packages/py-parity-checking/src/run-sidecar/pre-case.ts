import fs from "node:fs";
import path from "node:path";

import { resolvePathRef, type RuntimePaths } from "../runtime/path-ref.js";
import type { PreCaseCleanupCandidate, WorkflowNormalizationMetadata } from "../workflow-normalization/types.js";

const GENERATED_FIXTURE_PREFIX = "kernels/generated/";
const WRITER_EXTENSION_ALLOWLIST = new Set([".dla", ".bds"]);

function isAllowedFixtureCleanupCandidate(candidate: PreCaseCleanupCandidate): boolean {
  if (candidate.path.kind !== "fixture") {
    return false;
  }

  if (!candidate.path.rel.startsWith(GENERATED_FIXTURE_PREFIX)) {
    return false;
  }

  const extension = path.extname(candidate.path.rel).toLowerCase();
  return WRITER_EXTENSION_ALLOWLIST.has(extension);
}

function unlinkExactFileBestEffort(filePath: string): void {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile()) {
      return;
    }

    fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup only
  }
}

/** Execute metadata-driven sidecar pre-case cleanup hooks with strict policy gates. */
export function runSidecarPreCaseHooks(
  metadata: WorkflowNormalizationMetadata,
  runtimePaths: RuntimePaths,
): void {
  const resolvedCleanupTargets = new Set<string>();

  for (const candidate of metadata.preCase.cleanupCandidates) {
    if (!isAllowedFixtureCleanupCandidate(candidate)) {
      continue;
    }

    const resolvedPath = resolvePathRef(runtimePaths, candidate.path);
    if (resolvedCleanupTargets.has(resolvedPath)) {
      continue;
    }

    resolvedCleanupTargets.add(resolvedPath);
    unlinkExactFileBestEffort(resolvedPath);
  }
}
