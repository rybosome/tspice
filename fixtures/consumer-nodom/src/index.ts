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
    return spice.raw.dafgs(current);
  } finally {
    spice.raw.dafcls(handle);
  }
}
void inspectDaf;

function readCkRecords(
  spice: SpiceSync,
  path: string,
  inst: number,
  et: number,
) {
  const h = spice.raw.dafopr(path);
  try {
    spice.raw.dafbfs(h);
    if (!spice.raw.daffna(h)) return;
    const d = spice.raw.dafgs(h);
    const type = spice.raw.dafus(d, 2, 6).ic[2];
    if (type === 2) {
      spice.raw.cknr02(h, d);
      const rate: number = spice.raw.ckgr02(h, d, 1).rate;
      void rate;
    }
    if (type === 3) {
      spice.raw.cknr03(h, d);
      const av: [number, number, number] | null = spice.raw.ckgr03(h, d, 1).av;
      void av;
    }
    spice.raw.ckmeta(inst, "SCLK");
    const r = spice.raw.ckfrot(inst, et),
      x = spice.raw.ckfxfm(inst, et);
    if (r.found && x.found) return [r.rotate[8], x.xform[35], r.ref, x.ref];
  } finally {
    spice.raw.dafcls(h);
  }
}
void readCkRecords;
