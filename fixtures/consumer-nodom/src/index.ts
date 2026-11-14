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

/** Exercise owned legacy geometry results through the public synchronous and asynchronous surfaces. */
export async function legacySurfaceConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const p = [1, 0, 0] as const;
  const angles = spice.raw.illum("499", 0, "NONE", "EARTH", p);
  const hit = spice.raw.srfxpt(
    "ELLIPSOID",
    "499",
    0,
    "NONE",
    "EARTH",
    "J2000",
    p,
  );
  const sub = await asyncSpice.raw.subpt(
    "Near point",
    "499",
    0,
    "NONE",
    "EARTH",
  );
  const sun = await asyncSpice.raw.subsol(
    "Intercept",
    "499",
    0,
    "NONE",
    "EARTH",
  );
  const terminator = await asyncSpice.raw.edterm(
    "UMBRAL",
    "SUN",
    "499",
    0,
    "IAU_MARS",
    "NONE",
    "EARTH",
    4,
  );
  void [
    angles.phase,
    hit.found ? hit.obspos : undefined,
    sub.alt,
    sun[2],
    terminator.trmpts,
  ];
}
