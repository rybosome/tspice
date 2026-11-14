import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceSync } from "@rybosome/tspice";

function inspectDaf(spice: SpiceSync, path: string): Uint8Array | undefined {
  const handle = spice.raw.dafopw(path);
  try {
    spice.raw.dafbbs(handle);
    spice.raw.dafcs(handle);
    if (!spice.raw.daffpa(handle)) return undefined;
    const current = spice.raw.dafgh();
    const name: string = spice.raw.dafgn(current);
    const { nd, ni } = spice.raw.dafhsf(current);
    void [name, nd, ni];
    return spice.raw.dafgs(current);
  } finally {
    spice.raw.dafcls(handle);
  }
}
void inspectDaf;
