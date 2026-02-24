import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SpiceBackend, SpiceIntCell } from "@rybosome/tspice-backend-contract";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import { createNodeBackend } from "../src/index.js";

const itNative = it.runIf(nodeAddonAvailable());

const DSK_FIXTURE_BYTES = fs.readFileSync(
  fileURLToPath(
    new URL(
      "../../tspice/test/fixtures/kernels/dsk-minimal/apophis_g_25000mm_rad_obj_0000n00000_v001.bds",
      import.meta.url,
    ),
  ),
);

const DSK_FILENAME = "apophis_g_25000mm_rad_obj_0000n00000_v001.bds" as const;

function readIntCell(backend: SpiceBackend, cell: SpiceIntCell): number[] {
  const n = backend.raw.card(cell);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(backend.kit.cellGeti(cell, i));
  }
  return out;
}

describe("dsk parity", () => {
  let tmpDir: string;
  let dskPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dsk-parity-"));
    dskPath = path.join(tmpDir, `${randomUUID()}-${DSK_FILENAME}`);
    fs.writeFileSync(dskPath, DSK_FIXTURE_BYTES);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  itNative("dskobj + dsksrf match in node and wasm", async () => {
    const node = createNodeBackend();
    const wasm = await createWasmBackend();

    let didFurnsh = false;

    try {
      // WASM backend needs the bytes staged into its virtual FS.
      wasm.raw.furnsh({ path: DSK_FILENAME, bytes: DSK_FIXTURE_BYTES });
      didFurnsh = true;
      const nodeBodids = node.kit.newIntCell(100);
      const wasmBodids = wasm.kit.newIntCell(100);

      try {
        node.raw.dskobj(dskPath, nodeBodids);
        wasm.raw.dskobj(DSK_FILENAME, wasmBodids);

        const nodeBodies = readIntCell(node, nodeBodids);
        const wasmBodies = readIntCell(wasm, wasmBodids);

        expect(nodeBodies.length).toBeGreaterThanOrEqual(1);
        expect(nodeBodies).toEqual(wasmBodies);

        const bodyid = nodeBodies[0];
        expect(typeof bodyid).toBe("number");

        const nodeSrfids = node.kit.newIntCell(100);
        const wasmSrfids = wasm.kit.newIntCell(100);
        try {
          node.raw.dsksrf(dskPath, bodyid, nodeSrfids);
          wasm.raw.dsksrf(DSK_FILENAME, bodyid, wasmSrfids);

          const nodeSurfaces = readIntCell(node, nodeSrfids);
          const wasmSurfaces = readIntCell(wasm, wasmSrfids);

          expect(nodeSurfaces.length).toBeGreaterThanOrEqual(1);
          expect(nodeSurfaces).toEqual(wasmSurfaces);
        } finally {
          node.kit.freeCell(nodeSrfids);
          wasm.kit.freeCell(wasmSrfids);
        }
      } finally {
        node.kit.freeCell(nodeBodids);
        wasm.kit.freeCell(wasmBodids);
      }
    } finally {
      try {
        if (didFurnsh) {
          wasm.raw.unload(DSK_FILENAME);
        }
      } finally {
        // Ensure kernel pool cleanup even if unload fails.
        wasm.raw.kclear();
        node.raw.kclear();
      }
    }
  });

  itNative("dskobj throws TypeError on wrong-dtype cell handle", () => {
    const node = createNodeBackend();

    const wrong = node.kit.newDoubleCell(100);
    try {
      // The JS wrapper can't know the underlying native cell dtype, so this
      // is enforced at the native boundary.
      expect(() => (node as any).dskobj(dskPath, wrong)).toThrow(TypeError);
    } finally {
      node.kit.freeCell(wrong);
      node.raw.kclear();
    }
  });

  itNative("dsksrf throws TypeError on wrong-dtype cell handle", () => {
    const node = createNodeBackend();

    const wrong = node.kit.newCharCell(10, 16);
    try {
      expect(() => (node as any).dsksrf(dskPath, 0, wrong)).toThrow(TypeError);
    } finally {
      node.kit.freeCell(wrong);
      node.raw.kclear();
    }
  });

  itNative("dskobj throws RangeError on expired handle", () => {
    const node = createNodeBackend();

    const bodids = node.kit.newIntCell(10);
    node.kit.freeCell(bodids);
    try {
      expect(() => (node as any).dskobj(dskPath, bodids)).toThrow(RangeError);
    } finally {
      node.raw.kclear();
    }
  });
});
