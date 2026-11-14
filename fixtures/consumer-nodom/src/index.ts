import type { Spice, SpiceAsync } from "@rybosome/tspice";
import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Verify scalar operations accept readonly arrays and preserve sync/async results without DOM types. */
export function scalarMathTypes(sync: Spice, async: SpiceAsync): void {
  const values = [1, -2, 3] as const;
  const doubleBracket: number = sync.raw.brcktd(3.5, 8, -4);
  const intBracket: Promise<number> = async.raw.brckti(3, 8, -4);
  const conversion: Promise<number> = async.raw.convrt(3, "km", "meters");
  const doubleSum: number = sync.raw.sumad(values);
  const intSum: Promise<number> = async.raw.sumai(values);
  const doubleMaximum: number = sync.raw.maxd(values);
  const intMaximum: Promise<number> = async.raw.maxi(values);
  const doubleMinimum: Promise<number> = async.raw.mind(values);
  const intMinimum: number = sync.raw.mini(values);
  void [
    doubleBracket,
    intBracket,
    conversion,
    doubleSum,
    intSum,
    doubleMaximum,
    intMaximum,
    doubleMinimum,
    intMinimum,
  ];
}
