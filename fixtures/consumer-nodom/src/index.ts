import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Typecheck the owned scratch writer, inferred schema and zero-based record operations without DOM types. */
export async function typecheckEkRecords() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = raw.ekops();
    try {
      const s: number = raw.ekbseg(
        h,
        "RECORDS",
        ["ID"] as const,
        ["DATATYPE=INTEGER"] as const,
      );
      const row: number = raw.ekappr(h, s);
      raw.ekinsr(h, s, row);
      raw.ekdelr(h, s, row);
      raw.ekdelr(h, s, row);
      return s;
    } finally {
      raw.ekcls(h);
    }
  } finally {
    await dispose();
  }
}
