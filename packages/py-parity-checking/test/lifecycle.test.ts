import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Spice } from "@rybosome/tspice";

import { createRunTspiceContext, registerFinalizer } from "../src/runtime/context.js";
import { beforeCaseLifecycle, finalizeCaseLifecycle } from "../src/runtime/lifecycle.js";

describe("runtime lifecycle", () => {
  it("runs finalizers best-effort in stable order and always resets toolkit", () => {
    const calls: string[] = [];
    const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "py-parity-lifecycle-"));

    const spice = {
      raw: {
        kclear: () => {
          calls.push("kclear");
        },
        reset: () => {
          calls.push("reset");
        },
      },
      kit: {
        newWindow: (_maxIntervals: number) => ({}) as never,
        freeWindow: (_window: unknown) => {
          calls.push("freeWindow");
        },
      },
    } as unknown as Spice;

    const context = createRunTspiceContext(spice, {
      fixturesRoot: path.join(os.tmpdir(), "fixtures"),
      scratchRoot,
    });

    beforeCaseLifecycle(context);

    registerFinalizer(context, "alpha", () => {
      calls.push("finalizer-alpha");
    });
    registerFinalizer(context, "beta", () => {
      calls.push("finalizer-beta");
      throw new Error("ignore me");
    });
    registerFinalizer(context, "gamma", () => {
      calls.push("finalizer-gamma");
    });

    finalizeCaseLifecycle(context);

    expect(calls).toEqual([
      "kclear",
      "reset",
      "finalizer-alpha",
      "finalizer-beta",
      "finalizer-gamma",
      "kclear",
      "reset",
    ]);

    expect(fs.existsSync(scratchRoot)).toBe(false);
  });
});
