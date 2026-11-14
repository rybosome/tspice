import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

async function surfaceTranslations() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const text: string = spice.raw.srfc2s(-3, 399).surface;
    const flag: boolean = spice.raw.srfcss(-3, "EARTH").isName;
    const result = spice.raw.srfscc(text, 399);
    if (result.found) spice.raw.srfs2c(String(result.code), "EARTH");
    return flag;
  } finally {
    await dispose();
  }
}
void surfaceTranslations;
