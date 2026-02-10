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

describe("primitives parity (node vs wasm)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  // CI on Node 20 Linux can be slow to initialize the WASM backend.
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

    const etNodeParsed = node.tparse(time);
    const etWasmParsed = wasm.tparse(time);
    expectClose(etNodeParsed, etWasmParsed);
    // Sanity: `tparse` should agree with `str2et` on straightforward inputs.
    expectClose(etNodeParsed, etNode);

    const deltaNode = node.deltet(etNode, "ET");
    const deltaWasm = wasm.deltet(etWasm, "ET");
    expectClose(deltaNode, deltaWasm);

    const taiNode = node.unitim(etNode, "ET", "TAI");
    const taiWasm = wasm.unitim(etWasm, "ET", "TAI");
    expectClose(taiNode, taiWasm);

    const etNodeRound = node.unitim(taiNode, "TAI", "ET");
    const etWasmRound = wasm.unitim(taiWasm, "TAI", "ET");
    expectClose(etNodeRound, etWasmRound);
    expectClose(etNodeRound, etNode);

    // Samples from NAIF `tpictr_c` docs.
    const tpictrSampleA = "Thu Oct 01 11:11:11 PDT 1111";
    const expectedPicturA = "Wkd Mon DD HR:MN:SC PDT YYYY ::UTC-7";

    const tpictrSampleB = "24 Mar 2018  16:23:00 UTC";
    const expectedPicturB = "DD Mon YYYY  HR:MN:SC UTC ::UTC";

    const longTemplate = " ".repeat(80);
    const shortTemplate = "X";

    const pictNodeALong = node.tpictr(tpictrSampleA, longTemplate);
    const pictWasmALong = wasm.tpictr(tpictrSampleA, longTemplate);
    expect(pictNodeALong).toBe(pictWasmALong);
    expect(pictNodeALong).toBe(expectedPicturA);

    const pictNodeAShort = node.tpictr(tpictrSampleA, shortTemplate);
    const pictWasmAShort = wasm.tpictr(tpictrSampleA, shortTemplate);
    expect(pictNodeAShort).toBe(pictWasmAShort);
    expect(pictNodeAShort).toBe(expectedPicturA);
    expect(pictNodeAShort).toBe(pictNodeALong);

    const pictNodeBShort = node.tpictr(tpictrSampleB, shortTemplate);
    const pictWasmBShort = wasm.tpictr(tpictrSampleB, shortTemplate);
    expect(pictNodeBShort).toBe(pictWasmBShort);
    expect(pictNodeBShort).toBe(expectedPicturB);

    const pictNodeBLong = node.tpictr(tpictrSampleB, longTemplate);
    const pictWasmBLong = wasm.tpictr(tpictrSampleB, longTemplate);
    expect(pictNodeBLong).toBe(pictWasmBLong);
    expect(pictNodeBLong).toBe(expectedPicturB);

    expect(pictNodeBLong).not.toBe(pictNodeALong);

    const calNode = node.timdef("GET", "CALENDAR");
    const calWasm = wasm.timdef("GET", "CALENDAR");
    expect(calNode).toBe(calWasm);

    node.timdef("SET", "CALENDAR", calNode);
    wasm.timdef("SET", "CALENDAR", calWasm);
    expect(node.timdef("GET", "CALENDAR")).toBe(calNode);
    expect(wasm.timdef("GET", "CALENDAR")).toBe(calWasm);

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
  }, 20_000);
});
