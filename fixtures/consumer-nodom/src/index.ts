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

import type {
  SpiceAsync,
  SpiceEllipse,
  SpiceEllipseInput,
} from "@rybosome/tspice";
async function ellipseGeometry(spice: SpiceSync, asyncSpice: SpiceAsync) {
  const center = [1, 2, 3] as const,
    v1 = [4, 0, 0] as const,
    v2 = [0, 2, 0] as const;
  const e: SpiceEllipseInput = { center, semiMajor: v1, semiMinor: v2 };
  const plane = [0, 0, 1, 3] as const;
  const owned: SpiceEllipse = spice.raw.cgv2el(center, v1, v2);
  const axes = spice.raw.saelgv(v1, v2);
  const projected = spice.raw.pjelpl(e, plane);
  const parts = spice.raw.el2cgv(projected);
  const section = await asyncSpice.raw.inedpl(4, 3, 2, plane);
  if (section.found) return spice.raw.npelpt(parts.center, section.ellipse);
  const hits = await asyncSpice.raw.inelpl(owned, plane);
  if (hits.nxpts === 1 || hits.nxpts === 2) return [hits.xpt1, hits.xpt2, axes];
  return hits.nxpts;
}
void ellipseGeometry;
