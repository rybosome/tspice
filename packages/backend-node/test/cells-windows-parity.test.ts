import { describe, expect, it } from "vitest";

import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

function runScenario(b: SpiceBackend) {
  const icell = b.kit.newIntCell(10);
  const dcell = b.kit.newDoubleCell(10);
  const ccell = b.kit.newCharCell(10, 16);
  const win = b.kit.newWindow(4);

  try {
    b.raw.insrti(3, icell);
    b.raw.insrti(1, icell);
    b.raw.insrti(2, icell);

    b.raw.insrtd(3.25, dcell);
    b.raw.insrtd(-1.0, dcell);

    b.raw.insrtc("b", ccell);
    b.raw.insrtc("a", ccell);
    b.raw.insrtc("c", ccell);

    b.raw.wninsd(0, 1, win);
    b.raw.wninsd(2, 3, win);
    b.raw.wninsd(0.5, 2.5, win);

    return {
      ints: [b.kit.cellGeti(icell, 0), b.kit.cellGeti(icell, 1), b.kit.cellGeti(icell, 2)],
      doubles: [b.kit.cellGetd(dcell, 0), b.kit.cellGetd(dcell, 1)],
      chars: [b.kit.cellGetc(ccell, 0), b.kit.cellGetc(ccell, 1), b.kit.cellGetc(ccell, 2)],
      winCard: b.raw.wncard(win),
      win0: b.raw.wnfetd(win, 0),
    };
  } finally {
    b.kit.freeCell(icell);
    b.kit.freeCell(dcell);
    b.kit.freeCell(ccell);
    b.kit.freeWindow(win);
  }
}

describe("cells/windows parity (node vs wasm)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("matches for basic cells + windows ops", async () => {
    const node = createNodeBackend();
    const wasm = await createWasmBackend();

    const nodeOut = runScenario(node);
    const wasmOut = runScenario(wasm);

    expect(nodeOut).toEqual(wasmOut);
  }, 20_000);
});
