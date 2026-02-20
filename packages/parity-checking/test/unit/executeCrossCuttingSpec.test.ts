import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CrossCuttingSpec } from "../../src/dsl/types.js";

const { getCspiceRunnerBinaryPathMock, getCspiceRunnerStatusMock } = vi.hoisted(() => ({
  getCspiceRunnerBinaryPathMock: vi.fn(() => "/tmp/cspice-runner"),
  getCspiceRunnerStatusMock: vi.fn(() => ({
    ready: false,
    hint: "runner intentionally unavailable for test",
    statePath: "/tmp/cspice-runner.state.json",
  })),
}));

vi.mock("../../src/runners/cspiceRunner.js", () => ({
  getCspiceRunnerBinaryPath: getCspiceRunnerBinaryPathMock,
  getCspiceRunnerStatus: getCspiceRunnerStatusMock,
}));

import { executeCrossCuttingSpec } from "../../src/engine/executeCrossCuttingSpec.js";

const sampleSpec: CrossCuttingSpec = {
  schemaVersion: 1,
  kind: "crossCuttingSpec",
  id: "cross-cutting/unavailable@v1",
  owner: "test",
  cases: [
    {
      id: "single",
      transport: "native",
      rawRequest: '{"kind":"ping"}',
      expect: {
        ok: true,
      },
    },
  ],
  meta: {
    sourcePath: "/tmp/cross-cutting-unavailable.yml",
  },
};

describe("executeCrossCuttingSpec", () => {
  beforeEach(() => {
    getCspiceRunnerBinaryPathMock.mockClear();
    getCspiceRunnerStatusMock.mockClear();
  });

  it("returns a structured skip summary when native CSPICE is unavailable", async () => {
    const summary = await executeCrossCuttingSpec(sampleSpec);

    expect(summary).toEqual({
      specId: sampleSpec.id,
      caseCount: 0,
      skipped: true,
      skipReason: "cspice-runner unavailable: runner intentionally unavailable for test",
    });
    expect(getCspiceRunnerStatusMock).toHaveBeenCalledTimes(1);
    expect(getCspiceRunnerBinaryPathMock).not.toHaveBeenCalled();
  });
});
