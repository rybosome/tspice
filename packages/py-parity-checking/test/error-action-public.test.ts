import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend} keeps error controls available while blocking unsafe scientific calls`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const { raw, kit } = setup.spice;
      const window = kit.newWindow(2);
      let ownedWindow = true;
      try {
        for (const action of ["IGNORE", "REPORT"] as const) {
          raw.erract("SET", action);
          expect(raw.erract("GET")).toBe(action);
          expect(() => raw.str2et("invalid epoch")).toThrow(
            /can leave scientific outputs undefined/,
          );
          expect(() => raw.vnorm([3, 4, 0])).toThrow(
            /can leave scientific outputs undefined/,
          );
          expect(raw.failed()).toBe(false);
          raw.reset();
          expect(raw.erract("GET")).toBe(action);
        }
        kit.freeWindow(window);
        ownedWindow = false;
        kit.kclear();
        raw.erract("SET", "RETURN");
        expect(raw.vnorm([3, 4, 0])).toBe(5);
        expect(() => raw.erract("GET", 1)).toThrow(/at least two bytes/);
        expect(raw.erract("GET")).toBe("RETURN");
      } finally {
        raw.erract("SET", "RETURN");
        if (ownedWindow) kit.freeWindow(window);
        await setup.dispose();
      }
    },
  );
}
