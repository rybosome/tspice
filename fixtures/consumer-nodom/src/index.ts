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

/** Check sync and async coordinate Jacobians against the branded matrix result without DOM types. */
export function coordinateJacobianTypes(sync: Spice, async: SpiceAsync): void {
  type Jacobian = ReturnType<Spice["raw"]["ident"]>;
  const dazldr: Jacobian = sync.raw.dazldr(3, 4, -2, true, false);
  const dcyldr: Promise<Jacobian> = async.raw.dcyldr(3, 4, -2);
  const dgeodr: Jacobian = sync.raw.dgeodr(3, 4, -2, 3, 0.125);
  const dlatdr: Promise<Jacobian> = async.raw.dlatdr(3, 4, -2);
  const dpgrdr: Jacobian = sync.raw.dpgrdr("Earth", 3, 4, -2, 3, 0.125);
  const drdazl: Promise<Jacobian> = async.raw.drdazl(5, 0.7, -0.4, true, false);
  const drdcyl: Jacobian = sync.raw.drdcyl(5, 0.7, -2);
  const drdgeo: Promise<Jacobian> = async.raw.drdgeo(0.7, -0.4, 2, 3, 0.125);
  const drdlat: Jacobian = sync.raw.drdlat(5, 0.7, -0.4);
  const drdpgr: Promise<Jacobian> = async.raw.drdpgr(
    "Earth",
    0.7,
    -0.4,
    2,
    3,
    0.125,
  );
  const drdsph: Jacobian = sync.raw.drdsph(5, 1.1, 0.7);
  const dsphdr: Promise<Jacobian> = async.raw.dsphdr(3, 4, -2);
  void [
    dazldr,
    dcyldr,
    dgeodr,
    dlatdr,
    dpgrdr,
    drdazl,
    drdcyl,
    drdgeo,
    drdlat,
    drdpgr,
    drdsph,
    dsphdr,
  ];
}
