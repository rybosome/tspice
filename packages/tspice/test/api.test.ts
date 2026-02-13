import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
import { loadTestKernels } from "./test-kernels.js";

function expectClose(a: number, b: number, { atol = 1e-6, rtol = 1e-12 } = {}): void {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  expect(diff).toBeLessThanOrEqual(atol + rtol * scale);
}

describe("mid-level API parity (node vs wasm)", () => {
  it("unloadKernel works for byte-backed kernels across backends", async () => {
    const { lsk } = await loadTestKernels();
    const kernelId = "naif0012.tls";

    const { spice: wasm, dispose: disposeWasm } = await spiceClients.toSync({ backend: "wasm" });
    try {
      wasm.kit.loadKernel({ path: kernelId, bytes: lsk });
      expect(wasm.raw.ktotal("ALL")).toBeGreaterThan(0);
      wasm.kit.unloadKernel(kernelId);
      expect(wasm.raw.ktotal("ALL")).toBe(0);
      wasm.kit.kclear();
      expect(wasm.raw.ktotal("ALL")).toBe(0);
    } finally {
      await disposeWasm();
    }

    // Native backend isn't available in JS-only CI.
    if (nodeBackendAvailable) {
      const { spice: node, dispose: disposeNode } = await spiceClients.toSync({ backend: "node" });
      try {
        node.kit.loadKernel({ path: kernelId, bytes: lsk });
        expect(node.raw.ktotal("ALL")).toBeGreaterThan(0);
        node.kit.unloadKernel(kernelId);
        expect(node.raw.ktotal("ALL")).toBe(0);
        node.kit.kclear();
        expect(node.raw.ktotal("ALL")).toBe(0);
      } finally {
        await disposeNode();
      }
    }
  }, 20_000);

  it("getState matches within tolerance", async () => {
    const { lsk, spk } = await loadTestKernels();

    // JS-only CI does not build the native backend.
    if (!nodeBackendAvailable) return;

    const { spice: wasm, dispose: disposeWasm } = await spiceClients.toSync({ backend: "wasm" });
    const { spice: node, dispose: disposeNode } = await spiceClients.toSync({ backend: "node" });
    try {
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
    } finally {
      await disposeWasm();
      await disposeNode();
    }
  });
});
