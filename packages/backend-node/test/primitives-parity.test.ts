import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import { loadTestKernels } from "./test-kernels.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

function expectClose(a: number, b: number, { atol = 1e-6, rtol = 1e-12 } = {}): void {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  expect(diff).toBeLessThanOrEqual(atol + rtol * scale);
}

describe("Stage 3 primitives parity (node vs wasm)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("matches for str2et / et2utc / pxform / spkezr", async () => {
    const { lsk, spk } = await loadTestKernels();

    const node = createNodeBackend();
    const wasm = await createWasmBackend();

    node.furnsh({ path: "/kernels/naif0012.tls", bytes: lsk });
    node.furnsh({ path: "/kernels/de405s.bsp", bytes: spk });
    wasm.furnsh({ path: "/kernels/naif0012.tls", bytes: lsk });
    wasm.furnsh({ path: "/kernels/de405s.bsp", bytes: spk });

    const time = "2000 JAN 01 12:00:00";
    const etNode = node.str2et(time);
    const etWasm = wasm.str2et(time);
    expectClose(etNode, etWasm);

    const utcNode = node.et2utc(etNode, "C", 3);
    const utcWasm = wasm.et2utc(etWasm, "C", 3);
    expect(utcNode).toBe(utcWasm);

    const mNode = node.pxform("J2000", "J2000", etNode);
    const mWasm = wasm.pxform("J2000", "J2000", etWasm);
    expect(mNode).toHaveLength(9);
    expect(mWasm).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      expectClose(mNode[i]!, mWasm[i]!);
    }
    // Basic sanity check: J2000->J2000 should be identity.
    expectClose(mNode[0]!, 1);
    expectClose(mNode[4]!, 1);
    expectClose(mNode[8]!, 1);

    const spkNode = node.spkezr("EARTH", etNode, "J2000", "NONE", "SUN");
    const spkWasm = wasm.spkezr("EARTH", etWasm, "J2000", "NONE", "SUN");
    expectClose(spkNode.lt, spkWasm.lt);
    for (let i = 0; i < 6; i++) {
      expectClose(spkNode.state[i]!, spkWasm.state[i]!);
    }

    wasm.unload("/kernels/de405s.bsp");
    wasm.unload("/kernels/naif0012.tls");
    node.unload("/kernels/de405s.bsp");
    node.unload("/kernels/naif0012.tls");
  });
});
