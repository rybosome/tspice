import { describe, expect, it } from "vitest";

import { createSpice } from "@rybosome/tspice";
import { loadTestKernels } from "./test-kernels.js";

const runNodeBackendTests = process.env.TSPICE_RUN_NODE_BACKEND_TESTS === "1";

function expectClose(a: number, b: number, { atol = 1e-6, rtol = 1e-12 } = {}): void {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  expect(diff).toBeLessThanOrEqual(atol + rtol * scale);
}

describe("mid-level API parity (node vs wasm)", () => {
  const itNode = it.runIf(runNodeBackendTests && process.arch !== "arm64");

  itNode("getState matches within tolerance", async () => {
    const { lsk, spk } = await loadTestKernels();

    const wasm = await createSpice({ backend: "wasm" });
    // If node-backend tests are enabled, the native backend must load.
    const node = await createSpice({ backend: "node" });

    wasm.loadKernel({ path: "/kernels/naif0012.tls", bytes: lsk });
    wasm.loadKernel({ path: "/kernels/de405s.bsp", bytes: spk });
    node.loadKernel({ path: "/kernels/naif0012.tls", bytes: lsk });
    node.loadKernel({ path: "/kernels/de405s.bsp", bytes: spk });

    const time = "2000 JAN 01 12:00:00";
    const etWasm = wasm.utcToEt(time);
    const etNode = node.utcToEt(time);
    expectClose(etNode, etWasm);

    const stateWasm = wasm.getState({
      target: "EARTH",
      observer: "SUN",
      at: etWasm,
      frame: "J2000",
      aberration: "NONE",
    });
    const stateNode = node.getState({
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

    wasm.unloadKernel("/kernels/de405s.bsp");
    wasm.unloadKernel("/kernels/naif0012.tls");
    node.unloadKernel("/kernels/de405s.bsp");
    node.unloadKernel("/kernels/naif0012.tls");
  });
});
