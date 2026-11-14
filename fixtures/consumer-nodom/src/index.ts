import type { Spice, SpiceAsync } from "@rybosome/tspice";

import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Verify basic vector APIs accept readonly inputs without requiring DOM types. */
export function vectorBasicsTypes(sync: Spice, async: SpiceAsync): void {
  const input = [1, -2, 3] as const;
  const copy: [number, number, number] = sync.raw.vequ(input);
  const unpacked: { x: number; y: number; z: number } = sync.raw.vupack(input);
  const zero: boolean = sync.raw.vzero(input);
  const norm: Promise<{ unit: [number, number, number]; norm: number }> =
    async.raw.unorm(input);
  const separation: Promise<number> = async.raw.vsep(input, input);
  void [copy, unpacked, zero, norm, separation];
}
