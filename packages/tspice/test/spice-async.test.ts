import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";

type OwnKey = string | symbol;

const stableOwnKey = (key: OwnKey): string =>
  typeof key === "symbol" ? `symbol:${key.toString()}` : `string:${key}`;

// NOTE: We use `Reflect.ownKeys` (not `Object.keys`) so runtime checks include
// non-enumerable and symbol keys.
const sortedOwnKeys = (value: object): OwnKey[] =>
  Reflect.ownKeys(value).sort((a, b) => {
    const aStable = stableOwnKey(a);
    const bStable = stableOwnKey(b);
    return aStable < bStable ? -1 : aStable > bStable ? 1 : 0;
  });

describe("spiceClients.toAsync()", () => {
  it("returns exactly { raw, kit } and makes methods awaitable", async () => {
    const { spice, dispose } = await spiceClients.toAsync({ backend: "wasm" });
    try {
      // Tight runtime assertion: prevent accidental extra top-level exports like
      // `{ raw, kit, version }`.
      expect(sortedOwnKeys(spice)).toEqual(["kit", "raw"]);

      // Non-function properties should pass through.
      expect(spice.raw.kind).toBe("wasm");

      // Raw methods are awaitable.
      await spice.raw.kclear();
      expect(await spice.raw.ktotal("ALL")).toBe(0);

      // Kit methods are awaitable.
      const version = await spice.kit.toolkitVersion();
      expect(version).toBeTypeOf("string");
      expect(version).not.toBe("");
    } finally {
      await dispose();
    }
  });
});
