import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

async function observeTrace() {
  const {
    spice: { raw },
    dispose,
  } = await spiceClients.toSync({ backend: "wasm" });
  try {
    raw.setmsg("value @ # !");
    raw.errch("@", "text");
    raw.errint("#", -2);
    raw.errdp("!", 0.5);
    raw.chkin("frame");
    try {
      const status: boolean = raw.return();
      const depth: number = raw.trcdep();
      const name: string = raw.trcnam(0, 8);
      const trace: string = raw.qcktrc();
      return { status, depth, name, trace };
    } finally {
      raw.chkout("frame");
    }
  } finally {
    await dispose();
  }
}
void observeTrace;
