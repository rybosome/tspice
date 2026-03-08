import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  getCspiceRunnerBinaryPath,
  getCspiceRunnerBuildStatePath,
  isCspiceRunnerAvailable,
  readCspiceRunnerBuildState,
} from "../src/runners/cspiceRunner.js";

function cspiceRunnerReady(): boolean {
  if (!isCspiceRunnerAvailable()) {
    const statePath = getCspiceRunnerBuildStatePath();
    const state = readCspiceRunnerBuildState();

    const hint =
      state?.reason ||
      state?.error ||
      (fs.existsSync(statePath)
        ? `cspice-runner unavailable (see ${statePath})`
        : `cspice-runner unavailable (missing ${statePath})`);

    // eslint-disable-next-line no-console
    console.error(`[parity-checking] skipping cspice escape test: ${hint}`);
    return false;
  }
  return true;
}

function runRawJson(payload: string): unknown {
  const binaryPath = getCspiceRunnerBinaryPath();
  const r = spawnSync(binaryPath, [], { input: payload, encoding: "utf8" });
  if (r.error) throw r.error;
  const stdout = (r.stdout ?? "").trim();
  if (!stdout) throw new Error("cspice-runner produced no stdout");
  return JSON.parse(stdout) as unknown;
}

describe("cspice-runner JSON string escaping", () => {
  const maybeIt = cspiceRunnerReady() ? it : it.skip;

  maybeIt("rejects invalid JSON string escape sequences", () => {
    const out = runRawJson(
      '{"schemaVersion":3,"manifest":{"id":"methods/test/noop@v3","kind":"method"},"contract":{"contractMethod":"test.noop","canonicalMethod":"test.noop"},"args":{},"setup":{"kernels":["bad\\q"]},"workflow":{"steps":[{"op":"projectResult","out":{"ok":0}}]}}\n',
    ) as any;

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("invalid_request");
    expect(out.error?.message).toMatch(/invalid json string escape/i);
  });

  maybeIt("unescapes \\uXXXX in workflow call fn names", () => {
    const out = runRawJson(
      '{"schemaVersion":3,"manifest":{"id":"methods/cells-windows/size@v3","kind":"method"},"contract":{"contractMethod":"cells-windows.size","canonicalMethod":"cells-windows.size"},"args":{"size":1},"workflow":{"steps":[{"op":"allocCell","as":"cell","params":{"kind":"int","size":"$args.size"}},{"op":"call","fn":"cells-windows.siz\\u0065","in":["$refs.cell"],"as":"size"},{"op":"projectResult","out":{"size":"$refs.size"}}],"cleanup":[{"op":"freeCell","target":"$refs.cell"}]}}\n',
    ) as any;

    expect(out.ok).toBe(true);
    expect(out.result).toEqual({ size: 1 });
  });

  maybeIt("unescapes \\\\ and \\/ in setup.kernels paths", () => {
    const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const fixturePack = path.resolve(
      pkgRoot,
      "../tspice/test/fixtures/kernels/basic-time",
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-cspice-escapes-"));
    const packDir = path.join(tmp, "basic\\time");
    fs.mkdirSync(packDir, { recursive: true });

    fs.copyFileSync(path.join(fixturePack, "basic-time.tm"), path.join(packDir, "basic-time.tm"));
    fs.copyFileSync(path.join(fixturePack, "naif0012.tls"), path.join(packDir, "naif0012.tls"));

    const input = {
      schemaVersion: 3,
      manifest: {
        id: "methods/test/noop@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "test.noop",
        canonicalMethod: "test.noop",
      },
      args: {},
      setup: {
        kernels: [
          {
            path: path.join(packDir, "basic-time.tm"),
            restrictToDir: packDir,
          },
        ],
      },
      workflow: {
        steps: [
          {
            op: "projectResult",
            out: { ok: 0 },
          },
        ],
      },
    };

    // Force forward slashes to appear as `\/` escape sequences in JSON.
    const payload = `${JSON.stringify(input).replaceAll("/", "\\/")}\n`;
    const out = runRawJson(payload) as any;

    expect(out.ok).toBe(true);
    expect(out.result).toEqual({ ok: 0 });
  });
});
