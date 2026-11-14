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

/** Exercise ownership, typed entries and null cardinality through the public surface. */
export async function typecheckEkRecordEntries() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const handle = raw.ekops();
    try {
      const s = raw.ekbseg(
        handle,
        "SIGNALS",
        ["NAME", "VALUE", "ID"],
        [
          "DATATYPE=CHARACTER*(9)",
          "DATATYPE=DOUBLE PRECISION",
          "DATATYPE=INTEGER",
        ],
      );
      const r = raw.ekappr(handle, s);
      raw.ekacec(handle, s, r, "NAME", ["A"] as const, false);
      raw.ekaced(handle, s, r, "VALUE", [0.5], false);
      raw.ekacei(handle, s, r, "ID", [3], false);
      raw.ekucec(handle, s, r, "NAME", ["B"], false);
      raw.ekuced(handle, s, r, "VALUE", [-1.25], false);
      raw.ekucei(handle, s, r, "ID", [5], false);
      const name: string[] = raw.ekrcec(handle, s, r, "NAME", 10).values;
      const d: number[] = raw.ekrced(handle, s, r, "VALUE").values;
      const i: number[] = raw.ekrcei(handle, s, r, "ID").values;
      return { name, d, i };
    } finally {
      raw.ekcls(handle);
    }
  } finally {
    await dispose();
  }
}
