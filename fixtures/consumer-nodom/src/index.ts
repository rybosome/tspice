import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceSync } from "@rybosome/tspice";
function planes(spice: SpiceSync) {
  const origin = [0, 0, 0] as const,
    z = [0, 0, 1] as const;
  const plane = spice.raw.nvp2pl(z, origin);
  const { point, span1, span2 } = spice.raw.pl2psv(plane);
  const other = spice.raw.psv2pl(point, span1, span2);
  const { normal } = spice.raw.pl2nvp(other);
  const { xpt, nxpts } = spice.raw.inrypl(origin, normal, other);
  const projected = spice.raw.vprjp(xpt, plane);
  const inverse = spice.raw.vprjpi(projected, plane, other);
  if (inverse.found) return spice.raw.nplnpt(origin, z, inverse.vout);
  return nxpts;
}
void planes;
