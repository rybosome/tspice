import { describe, expect, it } from "vitest";

import { fixturePackCwdFromKernels } from "../src/runners/cspiceRunner.js";

describe("fixturePackCwdFromKernels", () => {
  it("throws an actionable error when multiple packs are detected", () => {
    expect(() =>
      fixturePackCwdFromKernels([
        { path: "/a/pack1/pack1.tm", restrictToDir: "/a/pack1" },
        { path: "/b/pack2/pack2.tm", restrictToDir: "/b/pack2" },
      ]),
    ).toThrow(/Multiple fixture packs were detected/i);
  });
});
