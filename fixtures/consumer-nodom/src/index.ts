import { spiceClients, type Spice, type SpiceAsync } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Check the six readonly sorted-bound operations on both public facades without DOM types. */
export async function sortedBoundsConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const strings = Object.freeze(["", "A", "A "]);
  const numbers = Object.freeze([-1, 0, 1]);
  const sync: number[] = [
    spice.raw.lstlec("A", strings),
    spice.raw.lstltc("A", strings),
    spice.raw.lstled(0, numbers),
    spice.raw.lstltd(0, numbers),
    spice.raw.lstlei(0, numbers),
    spice.raw.lstlti(0, numbers),
  ];
  const asyncResults: number[] = await Promise.all([
    asyncSpice.raw.lstlec("A", strings),
    asyncSpice.raw.lstltc("A", strings),
    asyncSpice.raw.lstled(0, numbers),
    asyncSpice.raw.lstltd(0, numbers),
    asyncSpice.raw.lstlei(0, numbers),
    asyncSpice.raw.lstlti(0, numbers),
  ]);
  void [sync, asyncResults];
}
