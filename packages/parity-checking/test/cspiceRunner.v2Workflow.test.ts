import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  getCspiceRunnerBinaryPath,
  getCspiceRunnerStatus,
} from "../src/runners/cspiceRunner.js";

type RunnerResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code?: string; message: string; detail?: string } };

function invokeRaw(payload: unknown): {
  stdout: string;
  stderr: string;
  response: RunnerResponse;
} {
  const binaryPath = getCspiceRunnerBinaryPath();
  const res = spawnSync(binaryPath, {
    input: `${JSON.stringify(payload)}\n`,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  if (res.error) {
    throw res.error;
  }

  if (res.status !== 0) {
    throw new Error(
      `cspice-runner exited non-zero (status=${res.status ?? "null"} signal=${res.signal ?? "null"}) ` +
        `stdout=${JSON.stringify(res.stdout)} stderr=${JSON.stringify(res.stderr)}`,
    );
  }

  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(
      `cspice-runner produced empty stdout (stderr=${JSON.stringify(stderr)})`,
    );
  }

  return {
    stdout,
    stderr,
    response: JSON.parse(trimmed) as RunnerResponse,
  };
}

describe("cspice-runner v2 workflow behavior", () => {
  const status = getCspiceRunnerStatus();

  if (!status.ready) {
    it.skip(
      `cspice-runner unavailable: ${status.hint}. State: ${status.statePath}`,
      () => {},
    );

    return;
  }

  it("emits a single structured error envelope for projection resolution failures", () => {
    const payload = {
      schemaVersion: 2,
      args: {
        present: 7,
      },
      workflow: {
        steps: [
          {
            op: "projectResult",
            out: {
              present: "$args.present",
              missing: "$args.missing",
            },
          },
        ],
      },
    };

    const out = invokeRaw(payload);
    const okFieldCount = (out.stdout.match(/"ok":/g) ?? []).length;

    expect(okFieldCount).toBe(1);
    expect(out.response.ok).toBe(false);
    if (!out.response.ok) {
      expect(out.response.error.code).toBe("invalid_args");
      expect(out.response.error.message).toBe("Missing v2 argument");
      expect(out.response.error.detail).toBe("missing");
    }
  });

  it("accepts generic v2 cleanup ops without overriding the primary projected result", () => {
    const payload = {
      schemaVersion: 2,
      args: {},
      workflow: {
        steps: [
          {
            op: "projectResult",
            out: {
              value: 1,
            },
          },
        ],
        cleanup: [
          {
            op: "allocCell",
            as: "tmp",
            params: {
              kind: "int",
              size: 2,
            },
          },
          {
            op: "spiceCall",
            call: "size_c",
            in: ["$refs.tmp"],
            as: "tmpSize",
          },
          {
            op: "projectResult",
            out: {
              ignored: "$refs.tmpSize",
            },
          },
          {
            op: "freeCell",
            target: "$refs.tmp",
          },
        ],
      },
    };

    const out = invokeRaw(payload);
    expect(out.response).toEqual({ ok: true, result: { value: 1 } });
  });

  it("resolves projectResult before cleanup steps run", () => {
    const payload = {
      schemaVersion: 2,
      args: {
        size: 4,
      },
      workflow: {
        steps: [
          {
            op: "allocCell",
            as: "cell",
            params: {
              kind: "int",
              size: "$args.size",
            },
          },
          {
            op: "projectResult",
            out: {
              shouldFail: "$refs.cleanupSize",
            },
          },
        ],
        cleanup: [
          {
            op: "spiceCall",
            call: "size_c",
            in: ["$refs.cell"],
            as: "cleanupSize",
          },
          {
            op: "freeCell",
            target: "$refs.cell",
          },
        ],
      },
    };

    const out = invokeRaw(payload);
    expect(out.response.ok).toBe(false);
    if (!out.response.ok) {
      expect(out.response.error.code).toBe("invalid_request");
      expect(out.response.error.message).toBe("Unknown v2 ref");
      expect(out.response.error.detail).toBe("cleanupSize");
    }
  });
  it("reuses freed ref slots under alloc/free churn", () => {
    const steps: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 80; i++) {
      steps.push({
        op: "allocCell",
        as: `cell${i}`,
        params: {
          kind: "int",
          size: 1,
        },
      });
      steps.push({
        op: "freeCell",
        target: `$refs.cell${i}`,
      });
    }

    steps.push({
      op: "projectResult",
      out: {
        ok: 1,
      },
    });

    const payload = {
      schemaVersion: 2,
      args: {},
      workflow: {
        steps,
      },
    };

    const out = invokeRaw(payload);
    expect(out.response).toEqual({ ok: true, result: { ok: 1 } });
  });

  it("executes EK fast-write workflow ops with semantic readback checks", () => {
    const payload = {
      schemaVersion: 2,
      args: {},
      workflow: {
        steps: [
          { op: "spiceCall", call: "ekifld_c", in: [] },
          { op: "spiceCall", call: "ekacli_c", in: [] },
          { op: "spiceCall", call: "ekacld_c", in: [] },
          { op: "spiceCall", call: "ekaclc_c", in: [] },
          { op: "spiceCall", call: "ekffld_c", in: [] },
          { op: "spiceCall", call: "ekfind_c", in: [3] },
          { op: "spiceCall", call: "ekgi_c", in: [0, 1] },
          { op: "spiceCall", call: "ekgd_c", in: [1, 20.25] },
          { op: "spiceCall", call: "ekgc_c", in: [2, "Carol"] },
          { op: "projectResult", out: { validated: 1 } },
        ],
      },
    };

    const out = invokeRaw(payload);
    expect(out.response).toEqual({ ok: true, result: { validated: 1 } });
  });
});
