import { describe, expect, it } from "vitest";

import { createSpice } from "@rybosome/tspice";
import { loadTestKernels } from "./test-kernels.js";

function expectClose(a: number, b: number, { atol = 1e-6, rtol = 1e-12 } = {}): void {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  expect(diff).toBeLessThanOrEqual(atol + rtol * scale);
}

describe("mid-level API parity (node vs wasm)", () => {
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

    wasm.tools.loadKernel({ path: "/kernels/naif0012.tls", bytes: lsk });
    wasm.tools.loadKernel({ path: "/kernels/de405s.bsp", bytes: spk });
    node.tools.loadKernel({ path: "/kernels/naif0012.tls", bytes: lsk });
    node.tools.loadKernel({ path: "/kernels/de405s.bsp", bytes: spk });

    const time = "2000 JAN 01 12:00:00";
    const etWasm = wasm.tools.utcToEt(time);
    const etNode = node.tools.utcToEt(time);
    expectClose(etNode, etWasm);

    const stateWasm = wasm.tools.getState({
      target: "EARTH",
      observer: "SUN",
      at: etWasm,
      frame: "J2000",
      aberration: "NONE",
    });
    const stateNode = node.tools.getState({
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

    wasm.tools.unloadKernel("/kernels/de405s.bsp");
    wasm.tools.unloadKernel("/kernels/naif0012.tls");
    node.tools.unloadKernel("/kernels/de405s.bsp");
    node.tools.unloadKernel("/kernels/naif0012.tls");
  });
});
