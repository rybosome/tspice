import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceSync, SpiceAsync } from "@rybosome/tspice";
async function plateGeometry(sync: SpiceSync, asyncSpice: SpiceAsync) {
  const v = [0, 0, 0, 2, 0, 0, 0, 3, 0] as const,
    p = [1, 2, 3] as const,
    a = [0, 0, 0] as const,
    b = [2, 0, 0] as const,
    c = [0, 3, 0] as const;
  const area: number = sync.raw.pltar(v, p);
  const expanded = sync.raw.pltexp(v, 0.5);
  const { pnear, dist } = sync.raw.pltnp(c, a, b, c);
  const normal = sync.raw.pltnrm(a, b, c);
  const bounds = await asyncSpice.raw.dskrb2(v, p, 3);
  return [
    area,
    expanded[8],
    pnear,
    dist,
    normal,
    bounds,
    asyncSpice.raw.pltvol,
  ];
}
void plateGeometry;
