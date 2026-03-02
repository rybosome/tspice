import { describe, expect, it } from "vitest";

import { spiceClients } from "../src/clients/spiceClients.js";
import { kernels } from "../src/kernels/kernels.js";

const samplePack = kernels
  .custom({
    origin: "https://example.com/",
    pathBase: "custom/",
  })
  .pick("mission.bsp");

describe("spiceClients.withKernels()", () => {
  it("throws for an empty pack array at runtime", () => {
    expect(() =>
      (spiceClients.withKernels as unknown as (packs: unknown) => unknown)([])
    ).toThrow(/non-empty KernelPack\[\]/);
  });

  it("accepts a single pack and a non-empty array", () => {
    expect(() => spiceClients.withKernels(samplePack)).not.toThrow();
    expect(() => spiceClients.withKernels([samplePack] as const)).not.toThrow();
  });
});
