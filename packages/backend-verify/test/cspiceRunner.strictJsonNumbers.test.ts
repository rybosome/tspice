import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  getCspiceRunnerBinaryPath,
  getCspiceRunnerStatus,
} from "../src/runners/cspiceRunner.js";

function isRequired(): boolean {
  return process.env.TSPICE_BACKEND_VERIFY_REQUIRED === "true";
}

type RunnerResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code?: string; message: string } };

function invokeRaw(json: string): RunnerResponse {
  const binaryPath = getCspiceRunnerBinaryPath();

  const res = spawnSync(binaryPath, {
    input: json,
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

  const out = (res.stdout ?? "").trim();
  if (!out) {
    throw new Error(
      `cspice-runner produced empty stdout (exit=${res.status ?? "?"} stderr=${JSON.stringify(res.stderr)})`,
    );
  }

  return JSON.parse(out) as RunnerResponse;
}

describe("cspice-runner strict JSON number/int literal grammar", () => {
  const status = getCspiceRunnerStatus();

  if (!status.ready) {
    if (!isRequired()) {
      it("cspice-runner unavailable (skipping strict JSON literal tests)", () => {
        // eslint-disable-next-line no-console
        console.warn(
          `[backend-verify] cspice-runner unavailable; skipping strict JSON literal tests (TSPICE_BACKEND_VERIFY_REQUIRED=false): ${status.hint}`,
        );
      });
      return;
    }

    it("cspice-runner required but unavailable", () => {
      throw new Error(
        `[backend-verify] cspice-runner required but unavailable: ${status.hint}. ` +
          `Remediation: ensure CSPICE is available (pnpm -w fetch:cspice) and rebuild (pnpm test:verify). ` +
          `State: ${status.statePath}`,
      );
    });

    return;
  }

  const numberCases: Array<{ literal: string; ok: boolean }> = [
    // accepted
    { literal: "0", ok: true },
    { literal: "-0", ok: true },
    { literal: "1", ok: true },
    { literal: "-1", ok: true },
    { literal: "1.0", ok: true },
    { literal: "1e0", ok: true },
    { literal: "1e+0", ok: true },
    { literal: "1e-0", ok: true },

    // rejected (invalid JSON number literal)
    { literal: "+0", ok: false },
    { literal: "01", ok: false },
    { literal: "-01", ok: false },
    { literal: "1.", ok: false },
    { literal: "1e", ok: false },
    { literal: "1e+", ok: false },
    { literal: "1e-", ok: false },

    // rejected (non-finite after strtod)
    { literal: "1e309", ok: false },

    // rejected (not a JSON number)
    { literal: "NaN", ok: false },
    { literal: "Infinity", ok: false },
    { literal: "-Infinity", ok: false },
  ];

  for (const c of numberCases) {
    it(`parses strict JSON number: ${c.literal}`, () => {
      const payload = `{"call":"frames.pxform","args":["J2000","J2000",${c.literal}]}\n`;
      const out = invokeRaw(payload);

      if (c.ok) {
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(Array.isArray(out.result)).toBe(true);
        }
      } else {
        expect(out.ok).toBe(false);
        if (!out.ok) {
          expect(out.error.code).toBe("invalid_args");
          expect(out.error.message).toBe("frames.pxform expects args[2] to be a number");
        }
      }
    });
  }

  const intCases: Array<{ literal: string; ok: boolean }> = [
    // accepted
    { literal: "0", ok: true },
    { literal: "-0", ok: true },
    { literal: "1", ok: true },
    { literal: "-1", ok: true },
    { literal: "10", ok: true },

    // rejected (invalid JSON int literal)
    { literal: "+0", ok: false },
    { literal: "01", ok: false },
    { literal: "-01", ok: false },
    { literal: "1.0", ok: false },
    { literal: "1e0", ok: false },
    { literal: "1.", ok: false },

    // rejected (range)
    { literal: "9223372036854775808", ok: false },

    // rejected (not a number)
    { literal: "NaN", ok: false },
  ];

  for (const c of intCases) {
    it(`parses strict JSON int: ${c.literal}`, () => {
      const payload = `{"call":"frames.frmnam","args":[${c.literal}]}\n`;
      const out = invokeRaw(payload);

      if (c.ok) {
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(out.result).toEqual(
            expect.objectContaining({
              found: expect.any(Boolean),
            }),
          );
        }
      } else {
        expect(out.ok).toBe(false);
        if (!out.ok) {
          expect(out.error.code).toBe("invalid_args");
          expect(out.error.message).toBe(
            "frames.frmnam expects args[0] to be an integer (SpiceInt range)",
          );
        }
      }
    });
  }
});
