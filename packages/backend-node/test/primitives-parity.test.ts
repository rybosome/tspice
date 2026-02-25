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

function restoreTimdefDefaults(
  b: TimdefApi,
  snapshot: TimdefDefaultsSnapshot,
  label: string,
): void {
  function timdefSet(item: string, value: string): void {
    try {
      b.timdef("SET", item, value);
    } catch (err) {
      throw new Error(
        `restoreTimdefDefaults(${label}): timdef("SET", ${JSON.stringify(item)}, ${JSON.stringify(value)}) failed`,
        { cause: err },
      );
    }
  }

  timdefSet("CALENDAR", snapshot.CALENDAR);

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
      `restoreTimdefDefaults(${label}): invalid snapshot; SYSTEM and ZONE cannot both be set`,
    );
  }

  if (zoneIsSet) {
    timdefSet("ZONE", snapshot.ZONE);
    return;
  }

  if (systemIsSet) {
    timdefSet("SYSTEM", snapshot.SYSTEM);
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
    }, "fake");

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
    const nodeTimdef0 = snapshotTimdefDefaults(node.raw);
    const wasmTimdef0 = snapshotTimdefDefaults(wasm.raw);

    let primaryErr: unknown = undefined;
    let hasPrimaryErr = false;
    const cleanupErrors: unknown[] = [];

    try {
      // Ensure deterministic parsing defaults for `str2et`.
      node.raw.timdef("SET", "SYSTEM", "UTC");
      wasm.raw.timdef("SET", "SYSTEM", "UTC");
      node.raw.timdef("SET", "CALENDAR", "GREGORIAN");
      wasm.raw.timdef("SET", "CALENDAR", "GREGORIAN");

      node.raw.furnsh({ path: "/kernels/naif0012.tls", bytes: lsk });
      node.raw.furnsh({ path: "/kernels/de405s.bsp", bytes: spk });
      wasm.raw.furnsh({ path: "/kernels/naif0012.tls", bytes: lsk });
      wasm.raw.furnsh({ path: "/kernels/de405s.bsp", bytes: spk });

      const time = "2000 JAN 01 12:00:00";

      // `str2et` converts from the default TIMDEF system (UTC) to ET.
      const etNode = node.raw.str2et(time);
      const etWasm = wasm.raw.str2et(time);
      expectClose(etNode, etWasm);

      // Leading whitespace in time pictures is meaningful; preserve it (no `.trim()`).
      const timoutLeadingPicture = "::UTC  YYYY-MON-DD HR:MN:SC.###";
      const timoutLeadingNode = node.raw.timout(etNode, timoutLeadingPicture);
      const timoutLeadingWasm = wasm.raw.timout(etWasm, timoutLeadingPicture);
      expect(timoutLeadingNode).toBe(timoutLeadingWasm);
      expect(timoutLeadingNode.startsWith("  ")).toBe(true);
      expect(timoutLeadingWasm.startsWith("  ")).toBe(true);

      // `tparse` parses a UTC time string and returns UTC seconds past J2000 on a
      // formal calendar (fixed 86400-second days; no leap seconds). It is
      // UTC-only and does not consult TIMDEF SYSTEM/ZONE.
      const sp2000Node = node.raw.tparse(time);
      const sp2000Wasm = wasm.raw.tparse(time);
      expectClose(sp2000Node, sp2000Wasm);

      // `tparse_c` is UTC-only and rejects time systems/zones in the input string.
      for (const bad of [
        "2000-01-01T12:00:00 TDB",
        "2000-01-01T12:00:00 PDT",
        "2000-01-01T12:00:00+05:00",
      ]) {
        expect(() => node.raw.tparse(bad)).toThrow();
        expect(() => wasm.raw.tparse(bad)).toThrow();
      }

      const deltaNode = node.raw.deltet(etNode, "ET");
      const deltaWasm = wasm.raw.deltet(etWasm, "ET");
      expectClose(deltaNode, deltaWasm);

      const taiNode = node.raw.unitim(etNode, "ET", "TAI");
      const taiWasm = wasm.raw.unitim(etWasm, "ET", "TAI");
      expectClose(taiNode, taiWasm);

      const etNodeRound = node.raw.unitim(taiNode, "TAI", "ET");
      const etWasmRound = wasm.raw.unitim(taiWasm, "TAI", "ET");
      expectClose(etNodeRound, etWasmRound);
      expectClose(etNodeRound, etNode);

      // Samples from NAIF `tpictr_c` docs.
      const tpictrSampleA = "Thu Oct 01 11:11:11 PDT 1111";
      const expectedPicturA = "Wkd Mon DD HR:MN:SC PDT YYYY ::UTC-7";

      const tpictrSampleB = "24 Mar 2018  16:23:00 UTC";
      const expectedPicturB = "DD Mon YYYY  HR:MN:SC UTC ::UTC";

      const longTemplate = " ".repeat(80);
      const shortTemplate = "X";

      expect(() => node.raw.tpictr("", shortTemplate)).toThrow(RangeError);
      expect(() => wasm.raw.tpictr("", shortTemplate)).toThrow(RangeError);
      expect(() => node.raw.tpictr(tpictrSampleA, "")).toThrow(RangeError);
      expect(() => wasm.raw.tpictr(tpictrSampleA, "")).toThrow(RangeError);

      const pictNodeALong = node.raw.tpictr(tpictrSampleA, longTemplate);
      const pictWasmALong = wasm.raw.tpictr(tpictrSampleA, longTemplate);
      expect(pictNodeALong).toBe(pictWasmALong);
      expect(pictNodeALong).toBe(expectedPicturA);

      const pictNodeAShort = node.raw.tpictr(tpictrSampleA, shortTemplate);
      const pictWasmAShort = wasm.raw.tpictr(tpictrSampleA, shortTemplate);
      expect(pictNodeAShort).toBe(pictWasmAShort);
      expect(pictNodeAShort).toBe(expectedPicturA);
      expect(pictNodeAShort).toBe(pictNodeALong);

      const pictNodeBShort = node.raw.tpictr(tpictrSampleB, shortTemplate);
      const pictWasmBShort = wasm.raw.tpictr(tpictrSampleB, shortTemplate);
      expect(pictNodeBShort).toBe(pictWasmBShort);
      expect(pictNodeBShort).toBe(expectedPicturB);

      const pictNodeBLong = node.raw.tpictr(tpictrSampleB, longTemplate);
      const pictWasmBLong = wasm.raw.tpictr(tpictrSampleB, longTemplate);
      expect(pictNodeBLong).toBe(pictWasmBLong);
      expect(pictNodeBLong).toBe(expectedPicturB);

      expect(pictNodeBLong).not.toBe(pictNodeALong);

      // TIMDEF is global state in CSPICE: verify GET/SET works, and restore.
      const calNode0 = node.raw.timdef("GET", "CALENDAR");
      const calWasm0 = wasm.raw.timdef("GET", "CALENDAR");
      expect(calNode0).toBe(calWasm0);

      const calAlt = calNode0 === "GREGORIAN" ? "JULIAN" : "GREGORIAN";

      node.raw.timdef("SET", "CALENDAR", calAlt);
      wasm.raw.timdef("SET", "CALENDAR", calAlt);
      expect(node.raw.timdef("GET", "CALENDAR")).toBe(calAlt);
      expect(wasm.raw.timdef("GET", "CALENDAR")).toBe(calAlt);

      // Restore so later operations in this test don't depend on ordering.
      node.raw.timdef("SET", "CALENDAR", calNode0);
      wasm.raw.timdef("SET", "CALENDAR", calWasm0);
      expect(node.raw.timdef("GET", "CALENDAR")).toBe(calNode0);
      expect(wasm.raw.timdef("GET", "CALENDAR")).toBe(calWasm0);

      const utcNode = node.raw.et2utc(etNode, "C", 3);
      const utcWasm = wasm.raw.et2utc(etWasm, "C", 3);
      expect(utcNode).toBe(utcWasm);

      const mNode = node.raw.pxform("J2000", "J2000", etNode);
      const mWasm = wasm.raw.pxform("J2000", "J2000", etWasm);
      expect(mNode).toHaveLength(9);
      expect(mWasm).toHaveLength(9);
      for (let i = 0; i < 9; i++) {
        expectClose(mNode[i]!, mWasm[i]!);
      }
      // Basic sanity check: J2000->J2000 should be identity.
      expectClose(mNode[0]!, 1);
      expectClose(mNode[4]!, 1);
      expectClose(mNode[8]!, 1);

      const spkNode = node.raw.spkezr("EARTH", etNode, "J2000", "NONE", "SUN");
      const spkWasm = wasm.raw.spkezr("EARTH", etWasm, "J2000", "NONE", "SUN");
      expectClose(spkNode.lt, spkWasm.lt);
      for (let i = 0; i < 6; i++) {
        expectClose(spkNode.state[i]!, spkWasm.state[i]!);
      }
    } catch (err) {
      primaryErr = err;
      hasPrimaryErr = true;
    }

    // Best-effort cleanup.
    try {
      wasm.raw.unload("/kernels/de405s.bsp");
      wasm.raw.unload("/kernels/naif0012.tls");
    } catch {
      // ignore
    }
    try {
      node.raw.unload("/kernels/de405s.bsp");
      node.raw.unload("/kernels/naif0012.tls");
    } catch {
      // ignore
    }

    try {
      restoreTimdefDefaults(node.raw, nodeTimdef0, "node");
    } catch (err) {
      cleanupErrors.push(err);
    }
    try {
      restoreTimdefDefaults(wasm.raw, wasmTimdef0, "wasm");
    } catch (err) {
      cleanupErrors.push(err);
    }

    if (hasPrimaryErr) {
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [primaryErr, ...cleanupErrors],
          "Test failed and cleanup also failed",
        );
      }
      throw primaryErr;
    }

    if (cleanupErrors.length === 1) {
      throw cleanupErrors[0];
    }
    if (cleanupErrors.length > 1) {
      throw new AggregateError(cleanupErrors, "Cleanup failed");
    }
  }, 20_000);
});
