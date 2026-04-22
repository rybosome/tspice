import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CaseExecutionResult,
  ParityCase,
  StepKernelsFurnsh,
  WorkflowStep,
} from "./case-types.js";
import {
  createCaseRuntimePaths,
  removeScratchRootBestEffort,
  toPathRef,
  type RuntimePaths,
} from "./runtime/path-ref.js";

const moduleFile = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFile);
const packageRoot = path.resolve(moduleDir, "..");
const sidecarProjectRoot = path.resolve(packageRoot, "sidecars", "spiceypy");

type SidecarRequestPayload = {
  caseId: string;
  runtime: {
    paths: RuntimePaths;
  };
  workflow: WorkflowStep[];
};

function withPathRefs(workflow: WorkflowStep[]): WorkflowStep[] {
  return workflow.map((step) => {
    if (step.op !== "kernels.furnsh") {
      return step;
    }

    const normalized: StepKernelsFurnsh = {
      ...step,
      file: toPathRef(step.file),
    };
    return normalized;
  });
}

function parseSidecarResponse(stdout: string): CaseExecutionResult {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error("Sidecar produced empty stdout");
  }
  return JSON.parse(trimmed) as CaseExecutionResult;
}

/** Execute one parity case in the Python SpiceyPy sidecar. */
export async function runCaseInSidecar(
  parityCase: ParityCase,
  fixturesRoot: string,
): Promise<CaseExecutionResult> {
  const runtimePaths = createCaseRuntimePaths(fixturesRoot, parityCase.caseId);

  try {
    const requestPayload: SidecarRequestPayload = {
      caseId: parityCase.caseId,
      runtime: {
        paths: runtimePaths,
      },
      workflow: withPathRefs(parityCase.workflow),
    };

    const child = spawn(
      "uv",
      ["run", "--project", sidecarProjectRoot, "python", "-m", "py_parity_sidecar.cli"],
      {
        cwd: packageRoot,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.stdin.end(JSON.stringify(requestPayload));

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? -1));
    });

    let parsed: CaseExecutionResult;
    try {
      parsed = parseSidecarResponse(stdout);
    } catch (error) {
      throw new Error(
        [
          `Failed to parse sidecar response for case ${parityCase.caseId}.`,
          `exitCode=${exitCode}`,
          stderr ? `stderr:\n${stderr}` : "",
          stdout ? `stdout:\n${stdout}` : "",
          String(error),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    if (parsed.caseId !== parityCase.caseId) {
      throw new Error(
        `Sidecar caseId mismatch. Expected ${parityCase.caseId}, got ${parsed.caseId}`,
      );
    }

    return parsed;
  } finally {
    removeScratchRootBestEffort(runtimePaths.scratchRoot);
  }
}
