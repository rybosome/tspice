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

/** Author and reopen a binary PCK through typed owned file, set and window handles. */
export function binaryPckConsumer(
  spice: Spice,
  coefficients: readonly number[],
): void {
  const file = { kind: "virtual-output", path: "orientation.bpc" } as const;
  const writer = spice.raw.pckopn(file, "ORIENTATION", 0);
  spice.raw.pckw02(
    writer,
    3000,
    "J2000",
    0,
    10,
    "ONE",
    10,
    1,
    1,
    coefficients,
    0,
  );
  spice.raw.pckcls(writer);
  const ids = spice.kit.newIntCell(4),
    coverage = spice.kit.newWindow(4);
  try {
    spice.raw.pckfrm(file, ids);
    spice.raw.pckcov(file, 3000, coverage);
    const loaded = spice.raw.pcklof(file);
    spice.raw.pckuof(loaded);
  } finally {
    spice.kit.freeCell(ids);
    spice.kit.freeWindow(coverage);
  }
}
