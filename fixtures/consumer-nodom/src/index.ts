import type { Spice, SpiceAsync } from "@rybosome/tspice";

import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Verify fixed-matrix APIs preserve readonly layouts and sync/async results without DOM types. */
export function fixedMatrixTypes(sync: Spice, async: SpiceAsync): void {
  const m = sync.raw.ident();
  const det: number = sync.raw.det(m);
  const trace: Promise<number> = async.raw.trace(m);
  const rotation: boolean = sync.raw.isrot(m, 0, 0);
  const inverse: typeof m = sync.raw.invert(m);
  const scaledTranspose: Promise<typeof m> = async.raw.invort(m);
  const copy: typeof m = sync.raw.mequ(m);
  const leftTranspose: typeof m = sync.raw.mtxm(m, m);
  const rightTranspose: Promise<typeof m> = async.raw.mxmt(m, m);
  const transpose: typeof m = sync.raw.xpose(m);
  const input2 = [27, 5, 5, 3] as const;
  const eigensystem: {
    diag: [number, number, number, number];
    rotate: [number, number, number, number];
  } = sync.raw.diags2(input2);
  const asyncEigensystem: Promise<typeof eigensystem> =
    async.raw.diags2(input2);
  void [
    det,
    trace,
    rotation,
    inverse,
    scaledTranspose,
    copy,
    leftTranspose,
    rightTranspose,
    transpose,
    eigensystem,
    asyncEigensystem,
  ];
}

async function frameAlgebra(spice: Spice, asyncSpice: SpiceAsync) {
  const x = [1, 0, 0] as const,
    y = [0, 1, 0] as const;
  const ax = [1, 0, 0, 0, 0.25, 0] as const,
    pl = [0, 1, 0, -0.25, 0, 0] as const;
  const triad = spice.raw.frame(x);
  const rot = spice.raw.twovec(triad.x, 1, y, 2);
  const dynamic = await asyncSpice.raw.twovxf(ax, 1, pl, 2);
  const recovered = spice.raw.xf2eul(dynamic, 3, 1, 3);
  const { av } = await asyncSpice.raw.xf2rav(dynamic);
  const state = spice.raw.rav2xf(rot, av);
  const inverse = await asyncSpice.raw.invstm(state);
  return [
    spice.raw.xpose6(inverse),
    spice.raw.eul2xf(recovered.eulang, 3, 1, 3),
    recovered.unique,
  ];
}
void frameAlgebra;
