import { spiceClients, type Spice, type SpiceAsync } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Exercise caller-owned window handles, mutation, predicates and summary fields on both facades. */
export async function windowAlgebraConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  {
    const a = spice.kit.newWindow(4);
    const b = spice.kit.newWindow(4);
    const result = spice.kit.newWindow(8);
    try {
      spice.raw.wncomd(0, 1, a, result);
      spice.raw.wncond(0, 1, a);
      spice.raw.wndifd(a, b, result);
      const wnelmd: boolean = spice.raw.wnelmd(0, a);
      spice.raw.wnexpd(0, 1, a);
      spice.raw.wnextd("L", a);
      spice.raw.wnfild(0, a);
      spice.raw.wnfltd(0, a);
      const wnincd: boolean = spice.raw.wnincd(0, 1, a);
      spice.raw.wnintd(a, b, result);
      const wnreld: boolean = spice.raw.wnreld(a, "<=", b);
      const summary = spice.raw.wnsumd(a);
      spice.raw.wnunid(a, b, result);
      const measures: number[] = [
        summary.meas,
        summary.avg,
        summary.stddev,
        summary.shortest,
        summary.longest,
      ];
      void [wnincd, wnelmd, wnreld, measures];
    } finally {
      spice.kit.freeWindow(result);
      spice.kit.freeWindow(b);
      spice.kit.freeWindow(a);
    }
  }
  {
    const a = await asyncSpice.kit.newWindow(4);
    const b = await asyncSpice.kit.newWindow(4);
    const result = await asyncSpice.kit.newWindow(8);
    try {
      await asyncSpice.raw.wncomd(0, 1, a, result);
      await asyncSpice.raw.wncond(0, 1, a);
      await asyncSpice.raw.wndifd(a, b, result);
      const wnelmd: boolean = await asyncSpice.raw.wnelmd(0, a);
      await asyncSpice.raw.wnexpd(0, 1, a);
      await asyncSpice.raw.wnextd("L", a);
      await asyncSpice.raw.wnfild(0, a);
      await asyncSpice.raw.wnfltd(0, a);
      const wnincd: boolean = await asyncSpice.raw.wnincd(0, 1, a);
      await asyncSpice.raw.wnintd(a, b, result);
      const wnreld: boolean = await asyncSpice.raw.wnreld(a, "<=", b);
      const summary = await asyncSpice.raw.wnsumd(a);
      await asyncSpice.raw.wnunid(a, b, result);
      const measures: number[] = [
        summary.meas,
        summary.avg,
        summary.stddev,
        summary.shortest,
        summary.longest,
      ];
      void [wnincd, wnelmd, wnreld, measures];
    } finally {
      await asyncSpice.kit.freeWindow(result);
      await asyncSpice.kit.freeWindow(b);
      await asyncSpice.kit.freeWindow(a);
    }
  }
}

/** Exercise ordinary cell mutation, same-kind copies and membership on both public facades. */
export async function cellArrayConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  {
    const c = spice.kit.newCharCell(2, 8);
    const i = spice.kit.newIntCell(2);
    const d = spice.kit.newDoubleCell(2);
    try {
      spice.raw.appndc("x", c);
      spice.raw.copy(c, c);
      const hasC: boolean = spice.raw.elemc("x", c);
      spice.raw.appndi(-2, i);
      spice.raw.copy(i, i);
      const hasI: boolean = spice.raw.elemi(-2, i);
      spice.raw.appndd(0.5, d);
      spice.raw.copy(d, d);
      const hasD: boolean = spice.raw.elemd(0.5, d);
      void [hasC, hasI, hasD];
    } finally {
      spice.kit.freeCell(d);
      spice.kit.freeCell(i);
      spice.kit.freeCell(c);
    }
  }
  {
    const c = await asyncSpice.kit.newCharCell(2, 8);
    const i = await asyncSpice.kit.newIntCell(2);
    const d = await asyncSpice.kit.newDoubleCell(2);
    try {
      await asyncSpice.raw.appndc("x", c);
      await asyncSpice.raw.copy(c, c);
      const hasC: boolean = await asyncSpice.raw.elemc("x", c);
      await asyncSpice.raw.appndi(-2, i);
      await asyncSpice.raw.copy(i, i);
      const hasI: boolean = await asyncSpice.raw.elemi(-2, i);
      await asyncSpice.raw.appndd(0.5, d);
      await asyncSpice.raw.copy(d, d);
      const hasD: boolean = await asyncSpice.raw.elemd(0.5, d);
      void [hasC, hasI, hasD];
    } finally {
      await asyncSpice.kit.freeCell(d);
      await asyncSpice.kit.freeCell(i);
      await asyncSpice.kit.freeCell(c);
    }
  }
}
