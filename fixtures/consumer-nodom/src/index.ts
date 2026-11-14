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

/** Check the readonly array-search signatures on the synchronous and transported facades. */
export async function arraySearchConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const strings = Object.freeze(["A", "B"]);
  const numbers = Object.freeze([1, 2]);
  const order = Object.freeze([0, 1]);
  const sync: number[] = [
    spice.raw.bschoc("B", strings, order),
    spice.raw.bschoi(2, numbers, order),
    spice.raw.bsrchc("B", strings),
    spice.raw.bsrchd(2, numbers),
    spice.raw.bsrchi(2, numbers),
    spice.raw.isrchc("B", strings),
    spice.raw.isrchd(2, numbers),
    spice.raw.isrchi(2, numbers),
  ];
  const asyncResults: number[] = await Promise.all([
    asyncSpice.raw.bschoc("B", strings, order),
    asyncSpice.raw.bschoi(2, numbers, order),
    asyncSpice.raw.bsrchc("B", strings),
    asyncSpice.raw.bsrchd(2, numbers),
    asyncSpice.raw.bsrchi(2, numbers),
    asyncSpice.raw.isrchc("B", strings),
    asyncSpice.raw.isrchd(2, numbers),
    asyncSpice.raw.isrchi(2, numbers),
  ]);
  void [sync, asyncResults];
}
