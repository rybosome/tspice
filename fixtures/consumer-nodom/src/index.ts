import type {
  Spice,
  SpiceAsync,
  SpiceConicElements,
  SpiceEquinoctialElements,
  SpiceExtendedConicElements,
} from "@rybosome/tspice";
import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Exercise the public, named element tuples and propagated states on both facades. */
export async function orbitalElementsConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const conic: Readonly<SpiceConicElements> = [1, 0, 0, 0, 0, 0, 0, 1];
  const eq: Readonly<SpiceEquinoctialElements> = [1, 0, 0, 0, 0, 0, 0, 1, 0];
  const state = spice.raw.conics(conic, 0);
  const eqState = spice.raw.eqncpv(0, 0, eq, 0, 0);
  const elements: SpiceConicElements = spice.raw.oscelt(state, 0, 1);
  const extended: SpiceExtendedConicElements = spice.raw.oscltx(eqState, 0, 1);
  const propagated = spice.raw.prop2b(1, state, 0.1);
  const asyncState = await asyncSpice.raw.conics(elements, 0);
  const asyncEq = await asyncSpice.raw.eqncpv(0, 0, eq, 0, 0);
  const asyncConic: SpiceConicElements = await asyncSpice.raw.oscelt(
    asyncEq,
    0,
    1,
  );
  const asyncExtended: SpiceExtendedConicElements = await asyncSpice.raw.oscltx(
    asyncState,
    0,
    1,
  );
  const asyncPropagated = await asyncSpice.raw.prop2b(1, asyncState, 0.1);
  void [extended, propagated, asyncConic, asyncExtended, asyncPropagated];
}
