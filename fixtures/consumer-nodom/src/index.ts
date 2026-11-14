import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceSync } from "@rybosome/tspice";

function localClock(spice: SpiceSync, utc: string): string {
  spice.raw.tparch("YES");
  spice.raw.tsetyr(1969);
  const epoch = spice.raw.utc2et(utc);
  const calendar: string = spice.raw.etcal(epoch, 181);
  const { hr, mn, sc, time, ampm } = spice.raw.et2lst(
    epoch,
    10,
    0,
    "PLANETOCENTRIC",
  );
  return `${calendar} ${hr} ${mn} ${sc} ${time} ${ampm}`;
}
void localClock;
