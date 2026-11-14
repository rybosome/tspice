import { spiceClients } from "@rybosome/tspice";
const [backend, mode] = process.argv.slice(2);
if (backend !== "node" && backend !== "wasm") throw Error("Invalid backend");
if (!["init", "finalize", "repeat", "without-init", "update"].includes(mode))
  throw Error("Invalid reporter mode");
const setup = await spiceClients.toSync({ backend });
const { raw, kit } = setup.spice;
const window = kit.newWindow(4);
try {
  raw.wninsd(-10, 10, window);
  raw.wninsd(20, 40, window);
  if (mode !== "without-init") raw.gfrepi(window, "audit begin", "audit end");
  if (mode === "update") {
    // N0067 checks the wall clock once per four calls and reports at most once per second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    for (const t of [-9, -8, -7, -5]) raw.gfrepu(-10, 10, t);
  }
  if (mode !== "init") raw.gfrepf();
  if (mode === "repeat") {
    raw.gfrepi(window, "second begin", "second end");
    raw.gfrepf();
  }
} finally {
  kit.freeWindow(window);
  await setup.dispose();
}
