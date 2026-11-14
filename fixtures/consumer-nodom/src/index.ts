import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Complete EK query and physical metadata through the typed public facade. */
export async function typecheckEkMetadata(path: string) {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = raw.eklef(path);
    try {
      const summary = raw.ekssum(h, 0),
        table = summary.tabnam;
      const n = raw.ekccnt(table),
        { column, attdsc } = raw.ekcii(table, 0);
      const query = "SELECT " + column + " FROM " + table;
      const select = raw.ekpsel(query),
        found = raw.ekfind(query);
      return {
        n,
        summary,
        attdsc,
        select,
        count: found.ok && found.nmrows ? raw.eknelt(0, 0) : 0,
      };
    } finally {
      raw.ekuef(h);
    }
  } finally {
    await dispose();
  }
}
