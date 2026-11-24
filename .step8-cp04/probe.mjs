import { spiceClients } from "../dist/index.js";

const report = document.querySelector("#result");
try {
  const session = await spiceClients.toWebWorker({
    wasmUrl: new URL("/tspice_backend_wasm.wasm", location.href),
    timeoutMs: 10000,
  });
  try {
    const { raw } = session.spice;
    const state = await raw.conics([1, 0, 0, 0, 0, 0, 0, 1], 0);
    const propagated = await raw.prop2b(1, [1, 0, 0, 0, 1, 0], 0);
    const expected = [1, 0, 0, 0, 1, 0];
    const matches = (value) => value.length === expected.length &&
      expected.every((part, i) => Math.abs(value[i] - part) <= 1e-12);
    if (!matches(state) || !matches(propagated) || await raw.failed()) {
      throw new Error(JSON.stringify({ state, propagated }));
    }
    const output = { kind: "virtual-output", path: "checkpoint-04.bsp" };
    const states = [10000, -20000, 30000, 1, -2, 3, 10060, -20120, 30180, 1, -2, 3];
    const writer = await raw.spkopn(output, "CHECKPOINT 04", 0);
    await raw.spkw08(writer, 100001, 0, "J2000", 0, 60, "WORKER READBACK", 1, states, 0, 60);
    await raw.spkcls(writer);
    const bytes = await session.spice.kit.readVirtualOutput(output);
    if (new TextDecoder().decode(bytes.subarray(0, 8)) !== "DAF/SPK ") {
      throw new Error("Virtual output did not contain an SPK file");
    }
    await raw.furnsh({ path: "checkpoint-04-readback.bsp", bytes });
    const readback = await raw.spkezr("100001", 30, "J2000", "NONE", "0");
    const expectedReadback = [10030, -20060, 30090, 1, -2, 3];
    if (!expectedReadback.every((value, i) => Math.abs(readback.state[i] - value) <= 1e-9)) {
      throw new Error("Unexpected SPK state " + JSON.stringify(readback));
    }
    await raw.kclear();
    if ((await raw.spksfs(100001, 30)).found || await raw.failed()) {
      throw new Error("SPK remained loaded after kclear");
    }
    report.textContent = "PASS " + JSON.stringify({ state, propagated, readback: readback.state });
  } finally {
    await session.dispose();
  }
} catch (error) {
  report.textContent = `FAIL ${error.stack ?? error}`;
}
