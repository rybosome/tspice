import type { Spice, SpiceAsync } from "@rybosome/tspice";
import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Check the kernel pool’s owned values, found text, direct load and control methods on both facades. */
export async function kernelPoolConsumer(
  spice: Spice,
  client: SpiceAsync,
  lines: readonly string[],
): Promise<void> {
  spice.raw.lmpool(lines);
  spice.raw.ldpool({ path: "pool.tpc", bytes: new Uint8Array() });
  const bad: boolean = spice.raw.badkpv(
    "consumer",
    "BODY399_X",
    "=",
    1,
    1,
    "N",
  );
  const body = spice.raw.bodvcd(399, "X", 1);
  const named = await client.raw.bodvrd("earth", "X", 1);
  const text = await client.raw.stpool("TEXT", 0, "//", 16);
  const limit = spice.raw.szpool("MAXVAL");
  const size: number = text.found ? text.size : 0;
  const output: string = text.found ? text.nthstr : "";
  await client.raw.dvpool("BODY399_X");
  await client.raw.clpool();
  void [bad, body.dim, named.values, limit.found && limit.n, size, output];
}
