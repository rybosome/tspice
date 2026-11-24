// The raw WASM ERRDEV name belongs to MEMFS. Inspect it through the real
// generated module here; the public kit only authorizes registered writers.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createErrorApi } from "../../../backend-wasm/dist/domains/error.js";
import moduleFactory from "../../../backend-wasm/emscripten/tspice_backend_wasm.node.js";
const asset = new URL(
  "../../../backend-wasm/emscripten/tspice_backend_wasm.wasm",
  import.meta.url,
);
const m = await moduleFactory({
  wasmBinary: readFileSync(fileURLToPath(asset)),
});
const raw = createErrorApi(m);
raw.errdev("SET", "/owned-report.txt");
raw.errprt("SET", "NONE, SHORT, LONG");
for (let i = 0; i < 100; i++) {
  raw.setmsg("A B07 diagnostic with a second field.");
  try {
    raw.sigerr("SPICE(B07DISPOSITION)");
  } catch (e) {
    if (e.spiceShort !== "SPICE(B07DISPOSITION)") throw e;
  }
}
const bytes = m.FS.readFile("/owned-report.txt", { encoding: "binary" });
process.stdout.write(bytes);
