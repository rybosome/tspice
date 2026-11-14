import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceSync } from "@rybosome/tspice";

function inspectDaf(spice: SpiceSync, path: string): Uint8Array | undefined {
  const handle = spice.raw.dafopw(path);
  try {
    const bytes = spice.raw.dafps(1, 1, [1] as const, [-3] as const);
    const components = spice.raw.dafus(bytes, 1, 1);
    const record = spice.raw.dafrfr(handle);
    const summary = spice.raw.dafgsr(handle, record.fward, 1, 128);
    const physical: Uint8Array = spice.raw.dafrda(handle, 1, 1);
    const numeric: number[] = spice.raw.dafgda(
      handle,
      record.free,
      record.free,
    );
    if (summary.found) {
      const data: Uint8Array = summary.data;
      void data;
    }
    void [components.dc, components.ic, physical, numeric];
    spice.raw.dafbbs(handle);
    spice.raw.dafcs(handle);
    if (!spice.raw.daffpa(handle)) return undefined;
    const current = spice.raw.dafgh();
    const name: string = spice.raw.dafgn(current);
    const { nd, ni } = spice.raw.dafhsf(current);
    void [name, nd, ni];
    const summaryBytes = spice.raw.dafgs(current);
    spice.raw.dafrs(current, summaryBytes);
    spice.raw.dafac(handle, ["  first", ""] as const);
    const page: { n: number; lines: string[]; done: boolean } = spice.raw.dafec(
      handle,
      2,
    );
    if (page.done) spice.raw.dafdc(handle);
    return summaryBytes;
  } finally {
    spice.raw.dafcls(handle);
  }
}
void inspectDaf;
