import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { Spice, SpiceAsync } from "@rybosome/tspice";
type SpiceVector3 = [number, number, number];
type SpiceStateVector = [...SpiceVector3, ...SpiceVector3];

/** Check typed correction inputs and complete results on both facades. */
export async function correctionsConsumer(
  spice: Spice,
  worker: SpiceAsync,
  state: Readonly<SpiceStateVector>,
  v: Readonly<SpiceVector3>,
) {
  const a = spice.raw.spkacs(1, 0, "J2000", "CN+S", 2);
  const b = spice.raw.spkapo(1, 0, "J2000", state, "XLT+S");
  const c = spice.raw.spkapp(1, 0, "J2000", state, "LT+S");
  const d = await worker.raw.spkaps(1, 0, "J2000", "XCN+S", state, v);
  const e = await worker.raw.spkltc(1, 0, "J2000", "LT", state);
  const f = spice.raw.stelab(b.pos, v);
  const g = await worker.raw.stlabx(f, v);
  const h = await worker.raw.ltime(0, 2, "->", 1);
  return [a.dlt, b.lt, c.state, d.state, e.dlt, f, g, h.ettarg, h.elapsd];
}
