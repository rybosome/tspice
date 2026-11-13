import fs from "node:fs";
import { spiceClients } from "@rybosome/tspice";
const [backend] = process.argv.slice(2);
if (backend !== "node" && backend !== "wasm") throw Error("Invalid backend");
const setup = await spiceClients.toSync({ backend });
const { raw, kit } = setup.spice;
const code = (fn) => {
  try {
    fn();
  } catch (error) {
    if (typeof error !== "object" || error === null) throw error;
    const short = Reflect.get(error, "spiceShort");
    if (typeof short !== "string") throw Error("Missing real SPICE short code");
    return short;
  }
  throw Error("Expected actual SPICE error");
};
const intervals = (window) =>
  Array.from({ length: raw.wncard(window) }, (_, i) => raw.wnfetd(window, i));
const cnfine = kit.newWindow(4),
  result = kit.newWindow(8);
const metrics = {
  initial: code(() => raw.gfstep(0)),
  steps: [],
  invalidStep: "",
  invalidTolerance: "",
  refinements: [],
  coarse: [],
  afterInvalid: [],
  afterClear: [],
  fine: [],
  confinement: [],
  stepAfterSearch: 0,
};
const loadKernels = () => {
  for (const name of ["audit-geometry.tf", "audit-geometry.bsp"])
    raw.furnsh({
      path: name,
      bytes: fs.readFileSync(
        new URL(`../../fixtures/kernels/${name}`, import.meta.url),
      ),
    });
};
try {
  raw.gfsstp(7.25);
  metrics.steps.push(raw.gfstep(-100), raw.gfstep(1e12));
  raw.kclear();
  metrics.steps.push(raw.gfstep(0));
  metrics.invalidStep = code(() => raw.gfsstp(0));
  metrics.steps.push(raw.gfstep(0));
  raw.gfsstp(123.5);
  metrics.steps.push(raw.gfstep(9));
  for (const s1 of [false, true])
    for (const s2 of [false, true])
      metrics.refinements.push(raw.gfrefn(-10.25, 17.75, s1, s2));
  metrics.refinements.push(
    raw.gfrefn(17.75, -10.25, true, true),
    raw.gfrefn(0.125, 0.125, false, false),
  );
  loadKernels();
  raw.wninsd(-2000, 0, cnfine);
  const search = () => {
    raw.gfdist("100101", "NONE", "100102", "<", 10, 0, 25, 100, cnfine, result);
    return intervals(result);
  };
  raw.gfstol(0.5);
  metrics.coarse = search();
  metrics.stepAfterSearch = raw.gfstep(0);
  metrics.invalidTolerance = code(() => raw.gfstol(0));
  metrics.afterInvalid = search();
  raw.kclear();
  loadKernels();
  metrics.afterClear = search();
  raw.gfstol(1e-12);
  metrics.fine = search();
  metrics.confinement = intervals(cnfine);
} finally {
  raw.gfstol(1e-6);
  kit.freeWindow(cnfine);
  kit.freeWindow(result);
  await setup.dispose();
}
process.stdout.write(JSON.stringify(metrics));
