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
