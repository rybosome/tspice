import type { Spice, SpiceAsync } from "@rybosome/tspice";
import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Verify general-vector methods accept readonly arrays and preserve sync/async results without DOM types. */
export function generalVectorTypes(sync: Spice, async: SpiceAsync): void {
  const a = [1, -2, 3, -4, 5] as const;
  const b: readonly number[] = [2, 3, 4, 5, 6];
  const sum: number[] = sync.raw.vaddg(a, b);
  const distance: Promise<number> = async.raw.vdistg(a, b);
  const dot: number = sync.raw.vdotg(a, b);
  const copy: Promise<number[]> = async.raw.vequg(a);
  const normalized: number[] = sync.raw.vhatg(a);
  const combination: Promise<number[]> = async.raw.vlcomg(2, a, -3, b);
  const negative: number[] = sync.raw.vminug(a);
  const norm: Promise<number> = async.raw.vnormg(a);
  const projection: number[] = sync.raw.vprojg(a, b);
  const relative: Promise<number> = async.raw.vrelg(a, b);
  const scaled: number[] = sync.raw.vsclg(2, a);
  const separation: Promise<number> = async.raw.vsepg(a, b);
  const difference: number[] = sync.raw.vsubg(a, b);
  const zero: Promise<boolean> = async.raw.vzerog(a);
  const unitAndNorm: { unit: number[]; norm: number } = sync.raw.unormg(a);
  void [
    sum,
    distance,
    dot,
    copy,
    normalized,
    combination,
    negative,
    norm,
    projection,
    relative,
    scaled,
    separation,
    difference,
    zero,
    unitAndNorm,
  ];
}
