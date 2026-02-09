import { describe, expect, it } from "vitest";

import { invokeRunner } from "../src/runners/cspiceRunner.js";

describe("invokeRunner (bounded time)", () => {
  it("rejects quickly on timeout", async () => {
    const start = Date.now();

    await expect(
      invokeRunner(
        process.execPath,
        { call: "noop", args: [] },
        {
          timeoutMs: 50,
          args: ["-e", "setInterval(() => {}, 1000)"]
        },
      ),
    ).rejects.toThrow(/timed out/i);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it("rejects quickly on stdout truncation", async () => {
    const start = Date.now();

    // Print a large amount of non-JSON output and keep the process alive so we
    // don't depend on `close` to settle the promise.
    const script = [
      "process.stdout.write('a'.repeat(100_000))",
      "setTimeout(() => {}, 1_000_000)",
    ].join("; ");

    await expect(
      invokeRunner(
        process.execPath,
        { call: "noop", args: [] },
        {
          timeoutMs: 10_000,
          maxStdoutChars: 10_000,
          args: ["-e", script],
        },
      ),
    ).rejects.toThrow(/output exceeded limit/i);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it("rejects quickly on stderr truncation", async () => {
    const start = Date.now();

    // Print a large amount of non-JSON output and keep the process alive so we
    // don't depend on `close` to settle the promise.
    const script = [
      "process.stderr.write('b'.repeat(100_000))",
      "setTimeout(() => {}, 1_000_000)",
    ].join("; ");

    await expect(
      invokeRunner(
        process.execPath,
        { call: "noop", args: [] },
        {
          timeoutMs: 10_000,
          maxStderrChars: 10_000,
          args: ["-e", script],
        },
      ),
    ).rejects.toThrow(/stderr capped/i);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});
