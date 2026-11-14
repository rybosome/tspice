import { spiceClients, type Spice, type SpiceAsync } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Type-check the three scalar geometry quantities on each normal public facade. */
export async function geometryQuantitiesConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const spicephaseq: number = spice.raw.phaseq(
    0,
    "100101",
    "SUN",
    "100102",
    "NONE",
  );
  const spicelspcn: number = spice.raw.lspcn("100101", 0, "NONE");
  const spicetrgsep: number = spice.raw.trgsep(
    0,
    "100101",
    "SPHERE",
    "NULL",
    "100103",
    "POINT",
    "NULL",
    "100102",
    "NONE",
  );
  const asyncSpicephaseq: number = await asyncSpice.raw.phaseq(
    0,
    "100101",
    "SUN",
    "100102",
    "NONE",
  );
  const asyncSpicelspcn: number = await asyncSpice.raw.lspcn(
    "100101",
    0,
    "NONE",
  );
  const asyncSpicetrgsep: number = await asyncSpice.raw.trgsep(
    0,
    "100101",
    "SPHERE",
    "NULL",
    "100103",
    "POINT",
    "NULL",
    "100102",
    "NONE",
  );
  void [
    spicephaseq,
    spicelspcn,
    spicetrgsep,
    asyncSpicephaseq,
    asyncSpicelspcn,
    asyncSpicetrgsep,
  ];
}

/** Check discriminated surface derivatives and tangent results on synchronous and asynchronous clients. */
export async function surfaceDerivativeConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<number[]> {
  const state = [3, 4, 0, 1, 2, 3] as const,
    ray = [-1, 0, 0, 0, 0, 0] as const;
  const args = [
    "ELLIPSOID",
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "TANGENT POINT",
    "100102",
    "J2000",
    [-1, 0, 0],
  ] as const;
  const a = spice.raw.dnearp(state, 2, 2, 2),
    b = await asyncSpice.raw.dnearp(state, 2, 2, 2);
  const x = spice.raw.surfpv(state, ray, 2, 2, 2),
    y = await asyncSpice.raw.surfpv(state, ray, 2, 2, 2);
  const u = spice.raw.tangpt(...args),
    v = await asyncSpice.raw.tangpt(...args);
  return [
    a.found ? a.altitudeRate : a.altitude,
    b.found ? b.velocity[0] : b.position[0],
    x.found ? x.state[0] : 0,
    y.found ? y.state[3] : 0,
    u.alt,
    v.trgepc,
  ];
}
