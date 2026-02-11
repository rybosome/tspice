import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import { loadTestKernels } from "./test-kernels.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type TimdefApi = {
  timdef(action: "GET", item: string): string;
  timdef(action: "SET", item: string, value: string): void;
};

type TimdefDefaultsSnapshot = {
  SYSTEM: string;
  CALENDAR: string;
  ZONE: string;
};

function snapshotTimdefDefaults(b: TimdefApi): TimdefDefaultsSnapshot {
  return {
    SYSTEM: b.timdef("GET", "SYSTEM"),
    CALENDAR: b.timdef("GET", "CALENDAR"),
    ZONE: b.timdef("GET", "ZONE"),
  };
}

function restoreTimdefDefaults(b: TimdefApi, snapshot: TimdefDefaultsSnapshot): void {
  b.timdef("SET", "CALENDAR", snapshot.CALENDAR);

  // `timdef_c` treats SYSTEM and ZONE as mutually exclusive state:
  // - setting SYSTEM blanks ZONE
  // - setting ZONE blanks SYSTEM
  //
  // Also, `timdef_c` does not allow setting an empty-string value.
  //
  // NOTE: Avoid `.trim()` for restore decisions; whitespace-only values are
  // meaningful and should be preserved.
  const systemIsSet = snapshot.SYSTEM.length > 0;
  const zoneIsSet = snapshot.ZONE.length > 0;

  if (systemIsSet && zoneIsSet) {
    throw new Error(
      "restoreTimdefDefaults(): invalid snapshot; SYSTEM and ZONE cannot both be set",
    );
  }

  if (zoneIsSet) {
    b.timdef("SET", "ZONE", snapshot.ZONE);
    return;
  }

  if (systemIsSet) {
    b.timdef("SET", "SYSTEM", snapshot.SYSTEM);
  }
}

function expectClose(
  a: number,
  b: number,
  { atol = 1e-6, rtol = 1e-12 } = {},
): void {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  expect(diff).toBeLessThanOrEqual(atol + rtol * scale);
}

describe("restoreTimdefDefaults()", () => {
  it("preserves whitespace-only ZONE snapshots", () => {
    const calls: Array<{ action: string; item: string; value: string }> = [];

    function timdef(action: "GET", item: string): string;
    function timdef(action: "SET", item: string, value: string): void;
    function timdef(action: "GET" | "SET", item: string, value?: string): string | void {
      if (action === "SET") {
        calls.push({ action, item, value: value ?? "" });
        return;
      }
      return "";
    }

    const fake: TimdefApi = { timdef };

    restoreTimdefDefaults(fake, {
      CALENDAR: "GREGORIAN",
      SYSTEM: "",
      ZONE: "   ",
    });

    expect(calls).toEqual([
      { action: "SET", item: "CALENDAR", value: "GREGORIAN" },
      { action: "SET", item: "ZONE", value: "   " },
    ]);
  });
});

describe("primitives parity (node vs wasm)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  // CI on Node 20 Linux can be slow to initialize the WASM backend.
  itNative("matches for str2et / et2utc / pxform / spkezr", async () => {
    const { lsk, spk } = await loadTestKernels();

    const node = createNodeBackend();
    const wasm = await createWasmBackend();

    // TIMDEF defaults are global (per backend implementation). Snapshot/restore
    // so this test is order-independent.
    const nodeTimdef0 = snapshotTimdefDefaults(node);
    const wasmTimdef0 = snapshotTimdefDefaults(wasm);

    try {
      // Ensure deterministic parsing defaults for `str2et`.
      node.timdef("SET", "SYSTEM", "UTC");
      wasm.timdef("SET", "SYSTEM", "UTC");
      node.timdef("SET", "CALENDAR", "GREGORIAN");
      wasm.timdef("SET", "CALENDAR", "GREGORIAN");

      node.furnsh({ path: "/kernels/naif0012.tls", bytes: lsk });
      node.furnsh({ path: "/kernels/de405s.bsp", bytes: spk });
      wasm.furnsh({ path: "/kernels/naif0012.tls", bytes: lsk });
      wasm.furnsh({ path: "/kernels/de405s.bsp", bytes: spk });

      const time = "2000 JAN 01 12:00:00";

      // `str2et` converts from the default TIMDEF system (UTC) to ET.
      const etNode = node.str2et(time);
      const etWasm = wasm.str2et(time);
      expectClose(etNode, etWasm);

      // `tparse` parses an ephemeris-time string and returns seconds past J2000.
      // For an ambiguous input like this, `tparse` will not generally agree with
      // `str2et` unless TIMDEF SYSTEM is set accordingly.
      const sp2000Node = node.tparse(time);
      const sp2000Wasm = wasm.tparse(time);
      expectClose(sp2000Node, sp2000Wasm);

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

      // TIMDEF is global state in CSPICE: verify GET/SET works, and restore.
      const calNode0 = node.timdef("GET", "CALENDAR");
      const calWasm0 = wasm.timdef("GET", "CALENDAR");
      expect(calNode0).toBe(calWasm0);

      const calAlt = calNode0 === "GREGORIAN" ? "JULIAN" : "GREGORIAN";

      node.timdef("SET", "CALENDAR", calAlt);
      wasm.timdef("SET", "CALENDAR", calAlt);
      expect(node.timdef("GET", "CALENDAR")).toBe(calAlt);
      expect(wasm.timdef("GET", "CALENDAR")).toBe(calAlt);

      // Restore so later operations in this test don't depend on ordering.
      node.timdef("SET", "CALENDAR", calNode0);
      wasm.timdef("SET", "CALENDAR", calWasm0);
      expect(node.timdef("GET", "CALENDAR")).toBe(calNode0);
      expect(wasm.timdef("GET", "CALENDAR")).toBe(calWasm0);

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
    } finally {
      // Best-effort cleanup.
      try {
        wasm.unload("/kernels/de405s.bsp");
        wasm.unload("/kernels/naif0012.tls");
      } catch {
        // ignore
      }
      try {
        node.unload("/kernels/de405s.bsp");
        node.unload("/kernels/naif0012.tls");
      } catch {
        // ignore
      }

      restoreTimdefDefaults(node, nodeTimdef0);
      restoreTimdefDefaults(wasm, wasmTimdef0);
    }
  }, 20_000);
});
