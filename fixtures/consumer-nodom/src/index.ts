import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceAsync, SpiceSync } from "@rybosome/tspice";
type DskReadArgs = Parameters<SpiceSync["raw"]["dskz02"]>;
async function readDskPages(
  sync: SpiceSync,
  asyncSpice: SpiceAsync,
  h: DskReadArgs[0],
  d: DskReadArgs[1],
) {
  const { nv, np } = sync.raw.dskz02(h, d);
  const points = await asyncSpice.raw.dskv02(h, d, 1, nv),
    triangles = sync.raw.dskp02(h, d, 1, np);
  const normal = sync.raw.dskn02(h, d, 1),
    doubles = sync.raw.dskd02(h, d, 19, 0, 3),
    ints = sync.raw.dski02(h, d, 9, 0, 3);
  sync.raw.dskcls(h, false);
  return [points, triangles, normal, doubles, ints];
}
void readDskPages;
