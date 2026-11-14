import { spiceClients, type Spice, type SpiceAsync } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Check raw clock tick, string and owned partition outputs on both public facades without DOM types. */
export async function clockDetailConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const ticks: number = spice.raw.sce2t(-123, 0);
  const text: string = spice.raw.scfmt(-123, ticks);
  const rawTicks: number = spice.raw.sctiks(-123, text);
  const partitions: { pstart: number[]; pstop: number[] } =
    spice.raw.scpart(-123);
  const asyncTicks: number = await asyncSpice.raw.sce2t(-123, 0);
  const asyncText: string = await asyncSpice.raw.scfmt(-123, asyncTicks, 37);
  const asyncRawTicks: number = await asyncSpice.raw.sctiks(-123, asyncText);
  const asyncPartitions: { pstart: number[]; pstop: number[] } =
    await asyncSpice.raw.scpart(-123);
  void [rawTicks, partitions, asyncRawTicks, asyncPartitions];
}
