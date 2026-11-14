import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Compile the six raw frame signatures and their owned fixed-length results without DOM declarations. */
export async function typecheckFrameMetadata() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" }),
    { raw, kit } = spice;
  const ids = kit.newIntCell(145);
  try {
    raw.bltfrm(1, ids);
    const rotations = [
      raw.pxfrm2("J2000", "B1950", 0, 1),
      raw.tipbod("J2000", 399, 0),
    ];
    const fixed = raw.tkfram(1800201);
    if (fixed.found) rotations.push(fixed.rot);
    const state = [1, 2, 3, 4, 5, 6] as const;
    return [
      rotations,
      raw.tisbod("J2000", 399, 0),
      raw.xfmsta(state, "RECTANGULAR", "CYLINDRICAL", " "),
    ];
  } finally {
    kit.freeCell(ids);
    await dispose();
  }
}
