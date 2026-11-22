import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients, type GfControl, type GfFovSearch } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const configuration: GfFovSearch = {
  instrument: "AUDIT_CIRCLE",
  target: "100101",
  shape: "POINT",
  frame: "AUDIT_GEOMETRY_FIXED",
  ray: [1, 0, 0],
  aberration: "NONE",
  observer: "100103",
  tolerance: 1e-6,
};
const control: GfControl = (event) => {
  switch (event.kind) {
    case "step": return 2;
    case "refine": return (event.first + event.second) / 2;
    case "bail": return false;
    default: return undefined;
  }
};

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend} configurable search preserves exceptions, output ownership and recovery`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const { raw, kit } = setup.spice;
      const c = kit.newWindow(4);
      let r = kit.newWindow(4);
      try {
        for (const path of ["audit-geometry.bsp", "audit-geometry.tf", "audit-fov.ti"])
          raw.furnsh({ path, bytes: fs.readFileSync(new URL(`../fixtures/kernels/${path}`, import.meta.url)) });
        raw.wninsd(-150, 150, c);
        raw.wninsd(1000, 1010, r);
        const marker = new Error("configured callback failed");
        const broken: GfControl = (event) => {
          if (event.kind === "step") throw marker;
          return control(event);
        };
        expect(() => raw.gffove(configuration, c, r, broken)).toThrow(marker);
        expect(raw.wnfetd(r, 0)).toEqual([1000, 1010]);
        let replaced = false;
        const replace: GfControl = (event) => {
          if (event.kind === "step" && !replaced) {
            kit.freeWindow(r);
            r = kit.newWindow(4);
            raw.wninsd(2000, 2010, r);
            replaced = true;
          }
          return control(event);
        };
        expect(() => raw.gffove(configuration, c, r, replace)).toThrow(/Result window expired/);
        expect(raw.wnfetd(r, 0)).toEqual([2000, 2010]);
        raw.gffove(configuration, c, r, control);
        expect(raw.wncard(r)).toBe(1);
        const [start, end] = raw.wnfetd(r, 0);
        expect(start).toBeCloseTo(-50, 4);
        expect(end).toBeCloseTo(50, 4);
      } finally {
        kit.freeWindow(r);
        kit.freeWindow(c);
        await setup.dispose();
      }
    },
  );
}
