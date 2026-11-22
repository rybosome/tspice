import { spiceClients } from "../dist/index.js";

const report = document.querySelector("#result");
try {
  const session = await spiceClients.toWebWorker({
    wasmUrl: new URL("/tspice_backend_wasm.wasm", location.href),
    timeoutMs: 10000,
  });
  try {
    const { raw } = session.spice;
    const packed = await raw.vpack(3, 4, 0);
    const cylindrical = await raw.reccyl(packed);
    const angle = await raw.vsep([1, 0, 0], [0, 1, 0]);
    const halfPi = await raw.halfpi();
    if (packed.join(",") !== "3,4,0" || cylindrical.radius !== 5 ||
        Math.abs(cylindrical.lon - Math.atan2(4, 3)) > 1e-14 ||
        cylindrical.z !== 0 || Math.abs(angle - halfPi) > 1e-14 ||
        halfPi !== Math.PI / 2 || await raw.failed()) {
      throw new Error(JSON.stringify({ packed, cylindrical, angle, halfPi }));
    }
    report.textContent = "PASS " + JSON.stringify({ packed, cylindrical, angle, halfPi });
  } finally {
    await session.dispose();
  }
} catch (error) {
  report.textContent = `FAIL ${error.stack ?? error}`;
}
