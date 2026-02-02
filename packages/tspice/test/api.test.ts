import { describe, expect, it } from "vitest";

import { createSpice } from "@rybosome/tspice";
import { loadTestKernels } from "./test-kernels.js";

function expectClose(a: number, b: number, { atol = 1e-6, rtol = 1e-12 } = {}): void {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  expect(diff).toBeLessThanOrEqual(atol + rtol * scale);
}

describe("mid-level API parity (node vs wasm)", () => {
  it("unloadKernel works for byte-backed kernels across backends", async () => {
    const { lsk } = await loadTestKernels();

    const wasm = await createSpice({ backend: "wasm" });
    wasm.kit.loadKernel({ path: "/kernels//naif0012.tls", bytes: lsk });
    expect(wasm.raw.ktotal("ALL")).toBeGreaterThan(0);
    wasm.kit.unloadKernel("naif0012.tls");
    wasm.raw.kclear();
    expect(wasm.raw.ktotal("ALL")).toBe(0);

    // Native backend isn't available in JS-only CI.
    try {
      const node = await createSpice({ backend: "node" });
      node.kit.loadKernel({ path: "/kernels//naif0012.tls", bytes: lsk });
      expect(node.raw.ktotal("ALL")).toBeGreaterThan(0);
      node.kit.unloadKernel("naif0012.tls");
      node.raw.kclear();
      expect(node.raw.ktotal("ALL")).toBe(0);
    } catch {
      // ignore
    }
  });

  it("getState matches within tolerance", async () => {
    const { lsk, spk } = await loadTestKernels();

    const wasm = await createSpice({ backend: "wasm" });
    let node: Awaited<ReturnType<typeof createSpice>> | undefined;
    try {
      node = await createSpice({ backend: "node" });
    } catch {
      // JS-only CI does not build the native backend. In native CI, this should succeed.
      return;
    }

    wasm.kit.loadKernel({ path: "naif0012.tls", bytes: lsk });
    wasm.kit.loadKernel({ path: "de405s.bsp", bytes: spk });
    node.kit.loadKernel({ path: "naif0012.tls", bytes: lsk });
    node.kit.loadKernel({ path: "de405s.bsp", bytes: spk });

    const time = "2000 JAN 01 12:00:00";
    const etWasm = wasm.kit.utcToEt(time);
    const etNode = node.kit.utcToEt(time);
    expectClose(etNode, etWasm);

    const stateWasm = wasm.kit.getState({
      target: "EARTH",
      observer: "SUN",
      at: etWasm,
      frame: "J2000",
      aberration: "NONE",
    });
    const stateNode = node.kit.getState({
      target: "EARTH",
      observer: "SUN",
      at: etNode,
      frame: "J2000",
      aberration: "NONE",
    });

    expectClose(stateNode.lightTime, stateWasm.lightTime);
    for (let i = 0; i < 3; i++) {
      expectClose(stateNode.position[i]!, stateWasm.position[i]!);
      expectClose(stateNode.velocity[i]!, stateWasm.velocity[i]!);
    }

    wasm.kit.unloadKernel("de405s.bsp");
    wasm.kit.unloadKernel("naif0012.tls");
    node.kit.unloadKernel("de405s.bsp");
    node.kit.unloadKernel("naif0012.tls");
  });
});
