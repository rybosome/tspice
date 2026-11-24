import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { createTimeApi } from "../src/domains/time.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

function setup() {
  const mock = {
    etcal: vi.fn((..._args: unknown[]) => "calendar"),
    utc2et: vi.fn((..._args: unknown[]) => 0),
    tparch: vi.fn(),
    tsetyr: vi.fn(),
    et2lst: vi.fn((..._args: unknown[]) => ({
      hr: 1,
      mn: 2,
      sc: 3,
      time: "01:02:03",
      ampm: "01:02:03 A.M.",
    })),
  };
  return { api: createTimeApi(mock as unknown as NativeAddon), mock };
}
it("passes full and truncated capacities and returns owned local time fields", () => {
  const { api, mock } = setup();
  expect(api.etcal(0)).toBe("calendar");
  api.etcal(1, 0x7fffffff);
  api.etcal(2, -1);
  expect(mock.etcal.mock.calls).toEqual([
    [0, 181],
    [1, 181],
    [2, -1],
  ]);
  api.utc2et("  2000 JAN 1  ");
  api.tparch("anything");
  api.tsetyr(-2147483648);
  expect(mock.utc2et).toHaveBeenCalledWith("  2000 JAN 1  ");
  expect(mock.tparch).toHaveBeenCalledWith("anything");
  expect(mock.tsetyr).toHaveBeenCalledWith(-2147483648);
  const result = api.et2lst(
    0,
    10,
    -0,
    "planetocentric",
    2147483647,
    2147483647,
  );
  expect(mock.et2lst.mock.calls[0]).toEqual([
    0,
    10,
    -0,
    "planetocentric",
    9,
    14,
  ]);
  result.hr = 23;
  expect(mock.et2lst.mock.results[0]?.value.hr).toBe(1);
});
const badInputs = [
  ["finite ET", (api: ReturnType<typeof createTimeApi>) => api.etcal(Infinity)],
  [
    "fractional length",
    (api: ReturnType<typeof createTimeApi>) => api.etcal(0, 2.5),
  ],
  [
    "UTC NUL",
    (api: ReturnType<typeof createTimeApi>) => api.utc2et("2000 JAN 01\0UTC"),
  ],
  [
    "UTC surrogate",
    (api: ReturnType<typeof createTimeApi>) => api.utc2et("\ud800"),
  ],
  ["mode NUL", (api: ReturnType<typeof createTimeApi>) => api.tparch("Y\0ES")],
  [
    "year window capacity",
    (api: ReturnType<typeof createTimeApi>) => api.tsetyr(5851356),
  ],
  [
    "year signed32",
    (api: ReturnType<typeof createTimeApi>) => api.tsetyr(-2147483649),
  ],
  [
    "body signed32",
    (api: ReturnType<typeof createTimeApi>) =>
      api.et2lst(0, 2147483648, 0, "X"),
  ],
  [
    "finite longitude",
    (api: ReturnType<typeof createTimeApi>) => api.et2lst(0, 10, NaN, "X"),
  ],
  [
    "type surrogate",
    (api: ReturnType<typeof createTimeApi>) => api.et2lst(0, 10, 0, "\udc00"),
  ],
  [
    "AM/PM signed32",
    (api: ReturnType<typeof createTimeApi>) =>
      api.et2lst(0, 10, 0, "X", 9, NaN),
  ],
] as const;
for (const [name, run] of badInputs)
  it("rejects before dispatch: " + name, () => {
    const { api, mock } = setup();
    expect(() => run(api)).toThrow();
    for (const call of Object.values(mock)) expect(call).not.toHaveBeenCalled();
  });
const lsk = fileURLToPath(
  new URL(
    "../../py-parity-checking/fixtures/kernels/naif0012.tls",
    import.meta.url,
  ),
);
it.skipIf(!nodeAddonAvailable())(
  "enforces defined calendar intermediates without changing parser state or canonical error precedence",
  () => {
    const native = getNativeAddon(),
      api = createTimeApi(native);
    native.kclear();
    try {
      api.tparch("NO");
      api.tsetyr(1969);
      expect(() => api.utc2et("JD 99999999999")).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(NOLEAPSECONDS)" }),
      );
      native.furnsh(lsk);
      expect(() => api.utc2et("JD 99999999999")).toThrow(
        /calendar integer arithmetic/,
      );
      expect(() => api.utc2et("10000000 JAN 1")).toThrow(
        /calendar integer arithmetic/,
      );
      expect(() => api.utc2et("10000000 JAN 1 12:00 TDB")).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(INVALIDTIMESTRING)" }),
      );
      api.tparch("YES");
      expect(() => api.utc2et("2000 FEB 31")).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(INVALIDTIMESTRING)" }),
      );
      api.tparch("anything");
      expect(api.utc2et("2000 FEB 31")).toBe(api.utc2et("2000 MAR 02"));
      api.tsetyr(5851355);
      expect(Number.isFinite(api.utc2et("54 JAN 1"))).toBe(true);
      expect(() => native.tsetyr(5851356)).toThrow(/calendar integer range/);
      native.pdpool("DELTET/DELTA_AT", [10, Number.MAX_VALUE]);
      expect(() => api.utc2et("2000 JAN 01")).toThrow(
        /calendar integer arithmetic/,
      );
    } finally {
      api.tparch("NO");
      api.tsetyr(1969);
      native.kclear();
    }
  },
);
it.skipIf(!nodeAddonAvailable())(
  "keeps raw local-time error order and recovers after guarded failures",
  () => {
    const native = getNativeAddon(),
      api = createTimeApi(native);
    native.kclear();
    try {
      expect(() => api.et2lst(0, -2147483648, 0, "", 0, 0)).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(EMPTYSTRING)" }),
      );
      expect(() => api.et2lst(0, -2147483648, 0, "X", 1, 1)).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(STRINGTOOSHORT)" }),
      );
      expect(() => api.et2lst(0, -2147483648, 0, "X")).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(UNKNOWNSYSTEM)" }),
      );
      expect(() => api.et2lst(0, -2147483648, 0, "PLANETOGRAPHIC")).toThrow(
        /body hash/,
      );
      expect(() => api.et2lst(0, 10, 0, "PLANETOGRAPHIC")).toThrow(
        expect.objectContaining({
          spiceShort: "SPICE(MISSINGDATA)",
          spiceTrace: expect.stringContaining("ET2LST --> PGRREC"),
        }),
      );
      expect(() => api.et2lst(0, 399, 0, "PLANETOCENTRIC")).toThrow(
        expect.objectContaining({
          spiceTrace: expect.stringContaining("ET2LST --> SPKEZ"),
        }),
      );
      expect(
        api.et2lst(Number.MAX_VALUE, 10, Number.MAX_VALUE, "planetocentric"),
      ).toEqual({
        hr: 12,
        mn: 0,
        sc: 0,
        time: "12:00:00",
        ampm: "12:00:00 P.M.",
      });
      expect(api.etcal(-Number.MAX_VALUE)).toMatch(/^Epoch before /);
      expect(() => native.utc2et("2000\0TDB")).toThrow();
      expect(() => native.tparch("\ud800")).toThrow();
      native.pcpool("NAIF_BODY_NAME", ["D01 TEST BODY"]);
      native.pdpool("NAIF_BODY_CODE", [-2147483647.6]);
      expect(() => api.et2lst(0, 10, 0, "PLANETOGRAPHIC")).toThrow(/body hash/);
      expect(api.et2lst(0, 10, 0, "PLANETOCENTRIC").hr).toBe(12);
      native.pdpool("NAIF_BODY_CODE", [100101]);
      expect(() => api.et2lst(0, 10, 0, "PLANETOGRAPHIC")).toThrow(
        expect.objectContaining({ spiceShort: "SPICE(MISSINGDATA)" }),
      );
    } finally {
      native.kclear();
    }
  },
);
