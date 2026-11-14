import { spiceClients, type Spice } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Compile the binary CK writer contract with readonly samples and an owned virtual output. */
export function ckWriterConsumer(
  spice: Spice,
  ticks: readonly number[],
  quats: readonly number[],
  av: readonly number[],
): void {
  const file = { kind: "virtual-output", path: "attitude.bc" } as const;
  const w = spice.raw.ckopn(file, "EXAMPLE", 0);
  spice.raw.ckw01(w, 1, 2, -123000, "J2000", true, "ONE", ticks, quats, av);
  spice.raw.ckw02(
    w,
    1,
    2,
    -123000,
    "J2000",
    "TWO",
    [1],
    [2],
    [1, 0, 0, 0],
    [0, 0, 0.1],
    [0.5],
  );
  spice.raw.ckw03(
    w,
    1,
    2,
    -123000,
    "J2000",
    true,
    "THREE",
    ticks,
    quats,
    av,
    [1],
  );
  spice.raw.ckw05(
    w,
    1,
    1,
    1,
    2,
    -123000,
    "J2000",
    true,
    "FIVE",
    ticks,
    quats,
    0.5,
    [1],
  );
  spice.raw.ckcls(w);
}
