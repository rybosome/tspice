import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

async function gfInterruptAndProgressTypes() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const interrupted: boolean = spice.raw.gfbail();
    if (!interrupted) spice.raw.gfinth(2);
    spice.raw.gfclrh();
    spice.raw.gfrepu(1, 2, 1.5);
  } finally {
    await dispose();
  }
}
void gfInterruptAndProgressTypes;
