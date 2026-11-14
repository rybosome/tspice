import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { Spice, SpiceAsync } from "@rybosome/tspice";

/** Check readonly polynomial inputs and every result field without DOM types. */
export async function polynomialConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const coefficients = Object.freeze([1, 2, 3]);
  const transform = Object.freeze([0, 2] as const);
  const derivatives: number[] = spice.raw.chbder(coefficients, transform, 1, 4);
  const integral: { p: number; itgrlp: number } = spice.raw.chbigr(
    coefficients,
    transform,
    1,
  );
  const derivative: { p: number; dpdx: number } = spice.raw.chbint(
    coefficients,
    transform,
    1,
  );
  const value: number = spice.raw.chbval(coefficients, transform, 1);
  const ordinary: number[] = spice.raw.polyds(coefficients, 4, 1);
  const roots: { root1: [number, number]; root2: [number, number] } =
    spice.raw.rquad(1, 2, 3);
  const asyncDerivatives: number[] = await asyncSpice.raw.chbder(
    coefficients,
    transform,
    1,
    4,
  );
  const asyncIntegral: { p: number; itgrlp: number } =
    await asyncSpice.raw.chbigr(coefficients, transform, 1);
  const asyncDerivative: { p: number; dpdx: number } =
    await asyncSpice.raw.chbint(coefficients, transform, 1);
  const asyncValue: number = await asyncSpice.raw.chbval(
    coefficients,
    transform,
    1,
  );
  const asyncOrdinary: number[] = await asyncSpice.raw.polyds(
    coefficients,
    4,
    1,
  );
  const asyncRoots: { root1: [number, number]; root2: [number, number] } =
    await asyncSpice.raw.rquad(1, 2, 3);
  void [
    derivatives,
    integral,
    derivative,
    value,
    ordinary,
    roots,
    asyncDerivatives,
    asyncIntegral,
    asyncDerivative,
    asyncValue,
    asyncOrdinary,
    asyncRoots,
  ];
}
