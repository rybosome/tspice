import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

async function tleTypes() {
  const client = await spiceClients.toSync({ backend: "wasm" });
  try {
    const { epoch, elems } = client.spice.raw.getelm(1957, ["", ""]);
    const state = client.spice.raw.evsgp4(
      epoch,
      [1, 2, 3, 4, 5, 6, 7, 8],
      elems,
    );
    const vz: number = state[5];
    void vz;
  } finally {
    await client.dispose();
  }
}
void tleTypes;
