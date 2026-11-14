import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { Spice, SpiceAsync } from "@rybosome/tspice";

/** Check readonly interpolation inputs and result fields without DOM types. */
export async function interpolationConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const x = Object.freeze([0, 1, 2]);
  const y = Object.freeze([0, 1, 4]);
  const pairs = Object.freeze([0, 0, 1, 2, 4, 4]);
  const equallySpacedHermite: { f: number; df: number } = spice.raw.hrmesp(
    0,
    1,
    pairs,
    0.5,
  );
  const hermite: { f: number; df: number } = spice.raw.hrmint(x, pairs, 0.5);
  const equallySpacedLagrange: number = spice.raw.lgresp(0, 1, y, 0.5);
  const derivative: { p: number; dp: number } = spice.raw.lgrind(x, y, 0.5);
  const lagrange: number = spice.raw.lgrint(x, y, 0.5);
  const midpoint: number[] = spice.raw.qderiv(x, y, 0.5);
  const asyncEquallySpacedHermite: { f: number; df: number } =
    await asyncSpice.raw.hrmesp(0, 1, pairs, 0.5);
  const asyncHermite: { f: number; df: number } = await asyncSpice.raw.hrmint(
    x,
    pairs,
    0.5,
  );
  const asyncEquallySpacedLagrange: number = await asyncSpice.raw.lgresp(
    0,
    1,
    y,
    0.5,
  );
  const asyncDerivative: { p: number; dp: number } =
    await asyncSpice.raw.lgrind(x, y, 0.5);
  const asyncLagrange: number = await asyncSpice.raw.lgrint(x, y, 0.5);
  const asyncMidpoint: number[] = await asyncSpice.raw.qderiv(x, y, 0.5);
  void [
    equallySpacedHermite,
    hermite,
    equallySpacedLagrange,
    derivative,
    lagrange,
    midpoint,
    asyncEquallySpacedHermite,
    asyncHermite,
    asyncEquallySpacedLagrange,
    asyncDerivative,
    asyncLagrange,
    asyncMidpoint,
  ];
}
