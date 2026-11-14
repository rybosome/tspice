import { spiceClients, type Spice, type SpiceAsync } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Exercise owned array-storage results on the sync and async public surfaces without DOM types. */
export async function arrayStorageConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const input = Object.freeze([0, 17, 251]);
  const sync: number[][] = [
    spice.raw.clearc(1, 2, input),
    spice.raw.cleard(1, input),
    spice.raw.cleari(2, input),
    spice.raw.filld(-0.5, 2, input),
    spice.raw.filli(-7, 1, input),
    spice.raw.moved(input, 2, input),
  ];
  const asyncResults: number[][] = await Promise.all([
    asyncSpice.raw.clearc(1, 2, input),
    asyncSpice.raw.cleard(1, input),
    asyncSpice.raw.cleari(2, input),
    asyncSpice.raw.filld(-0.5, 2, input),
    asyncSpice.raw.filli(-7, 1, input),
    asyncSpice.raw.moved(input, 2, input),
  ]);
  void [sync, asyncResults];
}
