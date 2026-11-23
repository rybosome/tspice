import { spiceClients } from "../dist/index.js";

const report = document.querySelector("#result");
try {
  const session = await spiceClients.toWebWorker({
    wasmUrl: new URL("/tspice_backend_wasm.wasm", location.href),
    timeoutMs: 10000,
  });
  try {
    const { raw } = session.spice;
    const surface = await raw.srfc2s(42, 399);
    const surfaceCode = await raw.srfscc("42", 399);
    const epoch = await raw.tparse("2000 JAN 01 12:00:00");
    const aMinuteLater = await raw.tparse("2000 JAN 01 12:01:00");
    const traceDepth = await raw.trcdep();
    const observation = { surface, surfaceCode, seconds: aMinuteLater - epoch, traceDepth };
    if (
      surface.surface !== "42" ||
      surface.isName ||
      !surfaceCode.found ||
      surfaceCode.code !== 42 ||
      observation.seconds !== 60 ||
      !Number.isInteger(traceDepth) ||
      traceDepth < 0 ||
      await raw.failed()
    ) {
      throw new Error(JSON.stringify(observation));
    }
    report.textContent = "PASS " + JSON.stringify(observation);
  } finally {
    await session.dispose();
  }
} catch (error) {
  report.textContent = `FAIL ${error.stack ?? error}`;
}
