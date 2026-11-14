import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Check DAS metadata, string widths, virtual outputs and opaque token signatures without DOM types. */
export async function typecheckDasLifecycle() {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" }),
    { raw, kit } = spice;
  const output = { kind: "virtual-output", path: "c04.das" } as const;
  try {
    const h = raw.dasonw(output, "Test", "name", 0);
    let name: string;
    try {
      name = raw.dashfn(h, 32);
      raw.daswbr(h);
    } finally {
      raw.dasllc(h);
    }
    const w = raw.dasopw(output);
    try {
      const { lastla } = raw.dashfs(w);
      const [character, double, integer] = lastla;
      void [character, double, integer];
    } finally {
      raw.dascls(w);
    }
    const scratch = raw.dasops();
    try {
      return {
        name,
        bytes: kit.readVirtualOutput(output),
        addresses: raw.daslla(scratch),
        record: raw.dasrfr(scratch, 9, 61),
      };
    } finally {
      raw.dascls(scratch);
    }
  } finally {
    await dispose();
  }
}
