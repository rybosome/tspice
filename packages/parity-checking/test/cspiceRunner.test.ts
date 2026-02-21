import { describe, expect, it } from "vitest";

import { invokeRunner } from "../src/runners/cspiceRunner.js";

describe("cspice-runner protocol", () => {
  it("preserves KernelEntry metadata in setup.kernels", async () => {
    // Use `node` as a stand-in binary so we can inspect the stdin payload.
    const script = [
      "process.stdin.setEncoding('utf8')",
      "let data = ''",
      "process.stdin.on('data', (c) => (data += c))",
      "process.stdin.on('end', () => {",
      "  const input = JSON.parse(data)",
      "  process.stdout.write(JSON.stringify({ ok: true, result: input.setup?.kernels }) + '\\n')",
      "})",
    ].join("; ");

    const input = {
      call: "noop",
      args: [],
      setup: {
        kernels: [
          { path: "/a/pack1/pack1.tm", restrictToDir: "/a/pack1" },
          "/b/kernel.bsp",
        ],
      },
    };

    const out = await invokeRunner(process.execPath, input, {
      timeoutMs: 5_000,
      args: ["-e", script],
    });

    expect(out).toEqual({ ok: true, result: input.setup.kernels });
  });
});
