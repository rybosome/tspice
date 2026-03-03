import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  getCspiceRunnerBinaryPath,
  getCspiceRunnerStatus,
} from "../src/runners/cspiceRunner.js";

type RunnerResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code?: string; message: string; detail?: string } };

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

function buildSchemaVersionPayload(literal: string): string {
  return `{"schemaVersion":${literal},"manifest":{"id":"methods/test/noop@v3","kind":"method"},"contract":{"contractMethod":"test.noop","canonicalMethod":"test.noop"},"args":{},"workflow":{"steps":[{"op":"projectResult","out":{"ok":0}}]}}\n`;
}

function buildAllocSizePayload(literal: string): string {
  return `{"schemaVersion":3,"manifest":{"id":"methods/cells-windows/size@v3","kind":"method"},"contract":{"contractMethod":"cells-windows.size","canonicalMethod":"cells-windows.size"},"args":{"size":${literal}},"workflow":{"steps":[{"op":"allocCell","as":"cell","params":{"kind":"int","size":"$args.size"}},{"op":"spiceCall","call":"size_c","in":["$refs.cell"],"as":"size"},{"op":"projectResult","out":{"size":"$refs.size"}}],"cleanup":[{"op":"freeCell","target":"$refs.cell"}]}}\n`;
}

describe("cspice-runner strict JSON integer literal grammar", () => {
  const status = getCspiceRunnerStatus();

  if (!status.ready) {
    it.skip(
      `cspice-runner unavailable: ${status.hint}. State: ${status.statePath}`,
      () => {},
    );

    return;
  }

  const schemaVersionCases: Array<{ literal: string; ok: boolean }> = [
    { literal: "3", ok: true },
    { literal: "4", ok: false },
    { literal: "+3", ok: false },
    { literal: "03", ok: false },
    { literal: "3.0", ok: false },
    { literal: "3e0", ok: false },
    { literal: "3.", ok: false },
    { literal: "3e", ok: false },
    { literal: "3e+", ok: false },
    { literal: "3e-", ok: false },
    { literal: "9223372036854775808", ok: false },
    { literal: "NaN", ok: false },
    { literal: "Infinity", ok: false },
    { literal: "-Infinity", ok: false },
  ];

  for (const c of schemaVersionCases) {
    it(`parses schemaVersion literal strictly: ${c.literal}`, () => {
      const out = invokeRaw(buildSchemaVersionPayload(c.literal));

      expect(out.ok).toBe(c.ok);
      if (!c.ok) {
        expect(out.ok).toBe(false);
        if (!out.ok) {
          expect(out.error.code).toBe("invalid_request");
        }
      }
    });
  }

  const allocSizeCases: Array<{ literal: string; ok: boolean; errorCode: "invalid_request" | "invalid_args" }> = [
    { literal: "1", ok: true, errorCode: "invalid_args" },
    { literal: "+1", ok: false, errorCode: "invalid_request" },
    { literal: "01", ok: false, errorCode: "invalid_request" },
    { literal: "1.0", ok: false, errorCode: "invalid_args" },
    { literal: "1e0", ok: false, errorCode: "invalid_args" },
    { literal: "9223372036854775808", ok: false, errorCode: "invalid_args" },
    { literal: "NaN", ok: false, errorCode: "invalid_request" },
  ];

  for (const c of allocSizeCases) {
    it(`parses allocCell integer arg strictly: ${c.literal}`, () => {
      const out = invokeRaw(buildAllocSizePayload(c.literal));

      if (c.ok) {
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(out.result).toEqual({ size: 1 });
        }
      } else {
        expect(out.ok).toBe(false);
        if (!out.ok) {
          expect(out.error.code).toBe(c.errorCode);
        }
      }
    });
  }
});
