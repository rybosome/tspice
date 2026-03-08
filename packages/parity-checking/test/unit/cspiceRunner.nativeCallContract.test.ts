import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile, chmod } from "node:fs/promises";
import * as path from "node:path";

const mockExistsSync = vi.hoisted(() => vi.fn());

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

import * as cspiceRunnerModule from "../../src/runners/cspiceRunner.js";

import type { RunCaseInputV2 } from "../../src/runners/types.js";

function createCallContractInput(): RunCaseInputV2 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/tkvrsn@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.tkvrsn",
      canonicalMethod: "time.tkvrsn",
      errors: [],
    },
    args: ["TOOLKIT"],
    workflow: {
      steps: [{ op: "callContract" }],
    },
  };
}

describe("cspice runner callContract native transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockExistsSync.mockReset();
  });

  it("fails explicitly when native runner binary is unavailable", async () => {
    mockExistsSync.mockReturnValue(false);

    const runner = await cspiceRunnerModule.createCspiceRunner();
    const out = await runner.runCase(createCallContractInput());

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.message).toContain("cspice-runner binary not found");
    }
  });

  it("routes single-step callContract workflows through invokeRunner", async () => {
    mockExistsSync.mockReturnValue(true);

    const binaryPath = cspiceRunnerModule.getCspiceRunnerBinaryPath();
    await mkdir(path.dirname(binaryPath), { recursive: true });
    await writeFile(
      binaryPath,
      "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ ok: true, result: 'TOOLKIT' }) + '\\n');\n",
      "utf8",
    );
    await chmod(binaryPath, 0o755);

    try {
      const runner = await cspiceRunnerModule.createCspiceRunner();
      const input = createCallContractInput();

      const out = await runner.runCase(input);

      expect(out).toEqual({ ok: true, result: "TOOLKIT" });
    } finally {
      await rm(binaryPath, { force: true });
    }
  });
});
