import { spiceClients } from "../../packages/tspice/dist/index.js";

const result = document.querySelector("#result");
const session = await spiceClients.toWebWorker({
  wasmUrl: new URL("/tspice_backend_wasm.wasm", location.href),
  timeoutMs: 10000,
});
try {
  const { raw, kit } = session.spice;
  for (const path of ["audit-geometry.bsp", "audit-geometry.tf", "audit-fov.ti"]) {
    const response = await fetch(`/kernels/${path}`);
    if (!response.ok) throw new Error(`Missing test kernel ${path}`);
    await raw.furnsh({ path, bytes: new Uint8Array(await response.arrayBuffer()) });
  }
  const confinement = await kit.newWindow(4);
  const window = await kit.newWindow(4);
  try {
    await raw.wninsd(-150, 150, confinement);
    const events = new Set();
    await raw.gffove({
      instrument: "AUDIT_CIRCLE", target: "100101", shape: "POINT",
      frame: "AUDIT_GEOMETRY_FIXED", ray: [1, 0, 0], aberration: "NONE",
      observer: "100103", tolerance: 1e-6, report: true, bail: true,
    }, confinement, window, async (event) => {
      const first = !events.has(event.kind);
      events.add(event.kind);
      switch (event.kind) {
        case "step": {
          if (first && await raw.vnorm([3, 4, 0]) !== 5)
            throw new Error("A measurement in the suspended worker returned an unexpected value");
          return 2;
        }
        case "refine": return (event.first + event.second) / 2;
        case "bail": return false;
        case "reportStart":
          if (event.confinementEndpoints.join(",") !== "-150,150")
            throw new Error(`Unexpected progress window ${event.confinementEndpoints}`);
          return;
        default: return;
      }
    });
    const [start, end] = await raw.wnfetd(window, 0);
    if (await raw.wncard(window) !== 1 || Math.abs(start + 50) > 1e-4 || Math.abs(end - 50) > 1e-4)
      throw new Error(`Unexpected result ${start}, ${end}`);
    for (const event of ["step", "refine", "reportStart", "reportUpdate", "reportEnd", "bail"])
      if (!events.has(event)) throw new Error(`The real worker did not observe ${event}`);
    result.textContent = `PASS configurable GF real web worker with all callbacks and a suspended measurement: ${start}, ${end}`;
  } finally {
    await kit.freeWindow(window);
    await kit.freeWindow(confinement);
  }
} catch (error) {
  result.textContent = `FAIL ${error.stack ?? error}`;
} finally {
  await session.dispose();
}
