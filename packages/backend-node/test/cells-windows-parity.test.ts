import { describe, expect, it } from "vitest";

import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

function runScenario(b: SpiceBackend) {
  const icell = b.newIntCell(10);
  const dcell = b.newDoubleCell(10);
  const ccell = b.newCharCell(10, 16);
  const win = b.newWindow(4);

  try {
    b.insrti(3, icell);
    b.insrti(1, icell);
    b.insrti(2, icell);

    b.insrtd(3.25, dcell);
    b.insrtd(-1.0, dcell);

    b.insrtc("b", ccell);
    b.insrtc("a", ccell);
    b.insrtc("c", ccell);

    b.wninsd(0, 1, win);
    b.wninsd(2, 3, win);
    b.wninsd(0.5, 2.5, win);

    return {
      ints: [b.cellGeti(icell, 0), b.cellGeti(icell, 1), b.cellGeti(icell, 2)],
      doubles: [b.cellGetd(dcell, 0), b.cellGetd(dcell, 1)],
      chars: [b.cellGetc(ccell, 0), b.cellGetc(ccell, 1), b.cellGetc(ccell, 2)],
      winCard: b.wncard(win),
      win0: b.wnfetd(win, 0),
    };
  } finally {
    b.freeCell(icell);
    b.freeCell(dcell);
    b.freeCell(ccell);
    b.freeWindow(win);
  }
}

describe("cells/windows parity (node vs wasm)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("matches for basic cells + windows ops", async () => {
    const node = createNodeBackend();
    const wasm = await createWasmBackend();

    if (!(wasm as any).cellsWindowsSupported) {
      // This repo can include prebuilt WASM artifacts; if the artifact in-tree
      // does not include the cells/windows exports, don't fail native CI runs.
      return;
    }

    const nodeOut = runScenario(node);
    const wasmOut = runScenario(wasm);

    expect(nodeOut).toEqual(wasmOut);
  }, 20_000);
});
