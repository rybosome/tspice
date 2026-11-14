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

/** Check sync and asynchronous field-of-view types with the ES-only library. */
export async function fieldOfViewConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
) {
  const bore = spice.raw.getfov(-817101, 4).bsight;
  const shape = (await asyncSpice.raw.getfvn("AUDIT_CIRCLE", 1)).shape;
  const ray: boolean = spice.raw.fovray(
    "AUDIT_CIRCLE",
    bore,
    "J2000",
    "NONE",
    "100103",
    0,
  );
  const target: boolean = await asyncSpice.raw.fovtrg(
    "AUDIT_CIRCLE",
    "100101",
    "POINT",
    "",
    "NONE",
    "100103",
    0,
  );
  return { shape, ray, target };
}

/** Consume all visibility searches through synchronous and asynchronous public raw clients. */
export async function visibilitySearchConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const c = spice.kit.newWindow(2),
    r = spice.kit.newWindow(2);
  try {
    spice.raw.gfrfov("CAMERA", [1, 0, 0], "J2000", "NONE", "EARTH", 2, c, r);
    spice.raw.gftfov("CAMERA", "SUN", "POINT", "", "NONE", "EARTH", 2, c, r);
    spice.raw.gfoclt(
      "ANY",
      "MOON",
      "ELLIPSOID",
      "IAU_MOON",
      "SUN",
      "POINT",
      "",
      "NONE",
      "EARTH",
      2,
      c,
      r,
    );
  } finally {
    spice.kit.freeWindow(r);
    spice.kit.freeWindow(c);
  }
  const input = await asyncSpice.kit.newWindow(2),
    output = await asyncSpice.kit.newWindow(2);
  try {
    await asyncSpice.raw.gfrfov(
      "CAMERA",
      [1, 0, 0],
      "J2000",
      "NONE",
      "EARTH",
      2,
      input,
      output,
    );
    await asyncSpice.raw.gftfov(
      "CAMERA",
      "SUN",
      "POINT",
      "",
      "NONE",
      "EARTH",
      2,
      input,
      output,
    );
    await asyncSpice.raw.gfoclt(
      "ANY",
      "MOON",
      "ELLIPSOID",
      "IAU_MOON",
      "SUN",
      "POINT",
      "",
      "NONE",
      "EARTH",
      2,
      input,
      output,
    );
  } finally {
    await asyncSpice.kit.freeWindow(output);
    await asyncSpice.kit.freeWindow(input);
  }
}

/** Callback searches and finite-difference utilities remain usable without DOM library types. */
export async function userSearchTypes(spice: Spice, asyncSpice: SpiceAsync) {
  const square = (et: number) => et * et,
    decreasing = (_f: typeof square, et: number) => et < 0;
  const c = spice.kit.newWindow(4),
    r = spice.kit.newWindow(4);
  try {
    spice.raw.gfudb(square, (f, t) => f(t) < 4, 0.25, c, r);
    spice.raw.gfuds(square, decreasing, "LOCMIN", 0, 0, 0.25, 16, c, r);
    const derivative: number = spice.raw.uddf(square, 1, 0.25),
      flag: boolean = spice.raw.uddc(square, -1, 0.125),
      dummy: number = spice.raw.udf(1, 2);
    void [derivative, flag, dummy];
  } finally {
    spice.kit.freeWindow(r);
    spice.kit.freeWindow(c);
  }
  const a = await asyncSpice.kit.newWindow(3),
    b = await asyncSpice.kit.newWindow(3);
  try {
    await asyncSpice.raw.gfudb(square, (f, t) => f(t) > 1, 0.25, a, b);
    await asyncSpice.raw.gfuds(square, decreasing, "=", 1, 0, 0.25, 16, a, b);
    const derivative: number = await asyncSpice.raw.uddf(square, 2, 0.125);
    const flag: boolean = await asyncSpice.raw.uddc(square, 0, 0.125);
    const dummy: number = await asyncSpice.raw.udf(1);
    void [derivative, flag, dummy];
  } finally {
    await asyncSpice.kit.freeWindow(b);
    await asyncSpice.kit.freeWindow(a);
  }
}

/** User functions can await a real non-callback measurement on the same Web Worker. */
export async function workerCallbackTypes() {
  const client = await spiceClients.toWebWorker();
  const { raw, kit } = client.spice;
  try {
    await raw.uddf(
      async (t) => t * (await raw.gfrefn(2, 4, true, false)),
      2,
      0.125,
    );
    const c = await kit.newWindow(3),
      r = await kit.newWindow(3);
    try {
      await raw.wninsd(-2, 3, c);
      await raw.gfudb(
        async (t) => t * t,
        async (f, t) => (await f(t)) > 1,
        0.25,
        c,
        r,
      );
      await raw.gfuds(
        (t) => t * t,
        async (f, t) => f(t - 0.125) > f(t + 0.125),
        "<",
        1,
        0,
        0.25,
        16,
        c,
        r,
      );
    } finally {
      await kit.freeWindow(r);
      await kit.freeWindow(c);
    }
  } finally {
    await client.dispose();
  }
}
