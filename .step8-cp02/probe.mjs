import { spiceClients } from "../dist/index.js";

const report = document.querySelector("#result");
try {
  const session = await spiceClients.toWebWorker({
    wasmUrl: new URL("/tspice_backend_wasm.wasm", location.href),
    timeoutMs: 10000,
  });
  try {
    const { raw, kit } = session.spice;
    const lower = await raw.lcase("aBC DeF");
    const position = await raw.cpos(lower, "d", 0);
    const index = await raw.bsrchd(5, [1, 3, 5, 8]);
    const left = await kit.newWindow(2);
    const right = await kit.newWindow(2);
    const result = await kit.newWindow(4);
    await raw.wninsd(1, 4, left);
    await raw.wninsd(3, 7, right);
    await raw.wnunid(left, right, result);
    const card = await raw.wncard(result);
    const { meas } = await raw.wnsumd(result);
    const observation = { lower, position, index, card, meas };
    if (lower !== "abc def" || position !== 4 || index !== 2 ||
        card !== 1 || meas !== 6 || await raw.failed()) {
      throw new Error(JSON.stringify(observation));
    }
    await kit.freeWindow(result);
    await kit.freeWindow(right);
    await kit.freeWindow(left);
    report.textContent = "PASS " + JSON.stringify(observation);
  } finally {
    await session.dispose();
  }
} catch (error) {
  report.textContent = `FAIL ${error.stack ?? error}`;
}
