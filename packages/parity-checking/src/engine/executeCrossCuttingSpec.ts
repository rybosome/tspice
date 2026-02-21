import { spawn } from "node:child_process";

import { getCspiceRunnerBinaryPath, getCspiceRunnerStatus } from "../runners/cspiceRunner.js";
import { crossCuttingSpecId } from "../dsl/types.js";

import type { AnyCrossCuttingSpec } from "../dsl/types.js";

type RawRunnerResponse = {
  ok: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

async function invokeRawNativeRequest(rawRequest: string): Promise<RawRunnerResponse> {
  const binaryPath = getCspiceRunnerBinaryPath();

  return await new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeoutMs = 15_000;
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      reject(new Error(`cross-cutting native request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();

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

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);

      if (code !== 0 || signal) {
        reject(
          new Error(
            `cross-cutting native request failed (code=${String(code)}, signal=${String(signal)} stdout=${JSON.stringify(stdout.trim())} stderr=${JSON.stringify(stderr.trim())})`,
          ),
        );
        return;
      }

      const out = stdout.trim();
      if (!out) {
        reject(new Error(`cross-cutting native request produced no output (stderr=${JSON.stringify(stderr.trim())})`));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(out);
      } catch (error) {
        reject(
          new Error(
            `cross-cutting native request returned non-JSON output: ${JSON.stringify(out)} (${String(error)})`,
          ),
        );
        return;
      }

      if (typeof parsed !== "object" || parsed === null) {
        reject(new Error(`cross-cutting native response must be an object (got ${JSON.stringify(parsed)})`));
        return;
      }

      const response = parsed as RawRunnerResponse;
      if (typeof response.ok !== "boolean") {
        reject(new Error(`cross-cutting native response missing boolean ok field: ${JSON.stringify(parsed)}`));
        return;
      }

      resolve(response);
    });

    child.stdin.write(rawRequest);
    child.stdin.end();
  });
}

export type CrossCuttingExecutionSummary = {
  specId: string;
  caseCount: number;
  skipped: boolean;
  skipReason?: string;
};

/** Execute one cross-cutting spec against the native CSPICE runner. */
export async function executeCrossCuttingSpec(spec: AnyCrossCuttingSpec): Promise<CrossCuttingExecutionSummary> {
  const specId = crossCuttingSpecId(spec);

  const status = getCspiceRunnerStatus();
  if (!status.ready) {
    return {
      specId,
      caseCount: 0,
      skipped: true,
      skipReason: `cspice-runner unavailable: ${status.hint}`,
    };
  }

  for (const scenarioCase of spec.cases) {
    const response = await invokeRawNativeRequest(scenarioCase.rawRequest);

    if (response.ok !== scenarioCase.expect.ok) {
      throw new Error(
        `Cross-cutting mismatch in ${specId} case=${scenarioCase.id}: expected ok=${scenarioCase.expect.ok}, got ok=${response.ok}`,
      );
    }

    if (scenarioCase.expect.errorCode !== undefined) {
      const actualErrorCode = response.error?.code;
      if (actualErrorCode !== scenarioCase.expect.errorCode) {
        throw new Error(
          `Cross-cutting mismatch in ${specId} case=${scenarioCase.id}: expected error.code=${scenarioCase.expect.errorCode}, got ${String(actualErrorCode)}`,
        );
      }
    }
  }

  return {
    specId,
    caseCount: spec.cases.length,
    skipped: false,
  };
}
