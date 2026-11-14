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

/** Exercise owned binary row and numeric DAS data shapes without DOM types. */
export async function typecheckDasData() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const h = raw.dasops();
    try {
      const bytes = new Uint8Array([0, 255]);
      const words = [2, -1] as const;
      raw.dasadc(h, 2, 0, 1, 2, bytes);
      raw.dasadd(h, 2, words);
      raw.dasadi(h, 2, words);
      raw.dasudc(h, 1, 2, 0, 1, 2, bytes);
      raw.dasudd(h, 1, 2, words);
      raw.dasudi(h, 1, 2, words);
      const chars: Uint8Array = raw.dasrdc(h, 1, 2, 0, 1, 2, bytes);
      return {
        chars,
        doubles: raw.dasrdd(h, 1, 2),
        integers: raw.dasrdi(h, 1, 2),
      };
    } finally {
      raw.dascls(h);
    }
  } finally {
    await dispose();
  }
}

/** Build and walk a DLA segment using the normal facade without DOM declarations. */
export async function typecheckDlaSegments() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    const handle = raw.dlaopn("segments.dla", "DLA", "generic data", 0);
    try {
      raw.dlabns(handle);
      raw.dasadi(handle, 2, [10, 20]);
      raw.dlaens(handle);
      const tail = raw.dlabbs(handle);
      return tail.found ? raw.dlafps(handle, tail.descr) : tail;
    } finally {
      raw.dascls(handle);
    }
  } finally {
    await dispose();
  }
}
