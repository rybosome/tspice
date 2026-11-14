import type { Spice, SpiceAsync } from "@rybosome/tspice";
import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Verify state derivatives accept readonly six-component states and preserve sync/async results without DOM types. */
export function stateDerivativeTypes(sync: Spice, async: SpiceAsync): void {
  const a = [1, -2, 3, -4, 5, -6] as const;
  const b = [7, 11, -13, 17, -19, 23] as const;
  const unitCross: [number, number, number, number, number, number] =
    sync.raw.ducrss(a, b);
  const cross: Promise<[number, number, number, number, number, number]> =
    async.raw.dvcrss(a, b);
  const dot: number = sync.raw.dvdot(a, b);
  const unit: Promise<[number, number, number, number, number, number]> =
    async.raw.dvhat(a);
  const norm: number = sync.raw.dvnorm(a);
  const separation: Promise<number> = async.raw.dvsep(a, b);
  void [unitCross, cross, dot, unit, norm, separation];
}
