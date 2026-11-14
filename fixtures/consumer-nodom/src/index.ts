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

/** Static contract coverage through public sync/async clients in a DOM-free project. */
export async function setAlgebraConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  {
    const a = spice.kit.newIntCell(4);
    const b = spice.kit.newIntCell(4);
    const out = spice.kit.newIntCell(8);
    const d = spice.kit.newDoubleCell(4);
    const c = spice.kit.newCharCell(4, 12);
    try {
      spice.raw.diff(a, b, out);
      spice.raw.inter(a, b, out);
      spice.raw.sdiff(a, b, out);
      spice.raw.union(a, b, out);
      const related: boolean = spice.raw.set(a, "=", b);
      spice.raw.removc("x", c);
      spice.raw.removd(0.5, d);
      spice.raw.removi(2, a);
      const ordc: number = spice.raw.ordc("x", c);
      const ordd: number = spice.raw.ordd(0.5, d);
      const ordi: number = spice.raw.ordi(2, a);
      void [related, ordc, ordd, ordi];
    } finally {
      spice.kit.freeCell(c);
      spice.kit.freeCell(d);
      spice.kit.freeCell(out);
      spice.kit.freeCell(b);
      spice.kit.freeCell(a);
    }
  }
  {
    const a = await asyncSpice.kit.newIntCell(4);
    const b = await asyncSpice.kit.newIntCell(4);
    const out = await asyncSpice.kit.newIntCell(8);
    const d = await asyncSpice.kit.newDoubleCell(4);
    const c = await asyncSpice.kit.newCharCell(4, 12);
    try {
      await asyncSpice.raw.diff(a, b, out);
      await asyncSpice.raw.inter(a, b, out);
      await asyncSpice.raw.sdiff(a, b, out);
      await asyncSpice.raw.union(a, b, out);
      const related: boolean = await asyncSpice.raw.set(a, "=", b);
      await asyncSpice.raw.removc("x", c);
      await asyncSpice.raw.removd(0.5, d);
      await asyncSpice.raw.removi(2, a);
      const ordc: number = await asyncSpice.raw.ordc("x", c);
      const ordd: number = await asyncSpice.raw.ordd(0.5, d);
      const ordi: number = await asyncSpice.raw.ordi(2, a);
      void [related, ordc, ordd, ordi];
    } finally {
      await asyncSpice.kit.freeCell(c);
      await asyncSpice.kit.freeCell(d);
      await asyncSpice.kit.freeCell(out);
      await asyncSpice.kit.freeCell(b);
      await asyncSpice.kit.freeCell(a);
    }
  }
}
