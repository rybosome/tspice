import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

async function writeChebyshevSpk(): Promise<void> {
  const c = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = c.spice.raw.spkopn(
      { kind: "virtual-output", path: "nodom-e04.bsp" },
      "NODOM",
      0,
    );
    const meta = [h, 195002, 0, "J2000", 0, 1, "NODOM"] as const;
    c.spice.raw.spkw02(...meta, 1, 1, 0, [1, 2, 3] as const, 0);
    c.spice.raw.spkw03(...meta, 1, 1, 0, new Float64Array(6), 0);
    c.spice.raw.spkw20(...meta, 1, 1, 0, [1, 2, 3, 4, 5, 6], 2, 3, 2451545, 0);
    c.spice.raw.spkcls(h);
  } finally {
    await c.dispose();
  }
}
void writeChebyshevSpk;

async function writeInterpolatedStates(): Promise<void> {
  const c = await spiceClients.toSync({ backend: "wasm" });
  try {
    const r = c.spice.raw,
      h = r.spkopn({ kind: "virtual-output", path: "nodom-e05.bsp" }, "T", 0);
    const fields = [198001, 0, "J2000", 0, 1, "T", 1] as const,
      states = new Float64Array(12),
      epochs = [0, 1] as const;
    r.spkw09(h, ...fields, states, epochs);
    r.spkw12(h, ...fields, states, 0, 1);
    r.spkw13(h, ...fields, states, epochs);
    r.spkw18(h, 1, ...fields, states, epochs);
    r.spkcls(h);
  } finally {
    await c.dispose();
  }
}
void writeInterpolatedStates;
