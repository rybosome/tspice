import { describe, expect, it } from "vitest";
import type { FileIoApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";
const calls: {
  name: string;
  allocations: number;
  run(api: FileIoApi, daf: SpiceHandle, das: SpiceHandle): unknown;
}[] = [
  { name: "dafopr", allocations: 3, run: (api) => api.dafopr("input.bsp") },
  { name: "dasopr", allocations: 3, run: (api) => api.dasopr("input.bds") },
  { name: "dafbfs", allocations: 1, run: (api, daf) => api.dafbfs(daf) },
  { name: "daffna", allocations: 2, run: (api, daf) => api.daffna(daf) },
  { name: "dafcls", allocations: 1, run: (api, daf) => api.dafcls(daf) },
  { name: "dascls", allocations: 1, run: (api, _daf, das) => api.dascls(das) },
  { name: "dlacls", allocations: 1, run: (api, _daf, das) => api.dlacls(das) },
  { name: "dlabfs", allocations: 3, run: (api, _daf, das) => api.dlabfs(das) },
];
describe("file reader allocation rollback and close retry", () => {
  for (const call of calls)
    for (let failAt = 1; failAt <= call.allocations; failAt++)
      it(`${call.name}: failure at allocation ${failAt}`, () => {
        const handles = createSpiceHandleRegistry();
        const daf = handles.register("DAF", 17);
        const das = handles.register("DAS", 19);
        let allocations = 0;
        const live = new Set<number>();
        const stub = {
          HEAPU8: new Uint8Array(8192),
          _malloc: () => {
            const ptr = ++allocations * 64;
            if (allocations === failAt) return 0;
            live.add(ptr);
            return ptr;
          },
          _free: (ptr: number) => {
            expect(live.delete(ptr)).toBe(true);
          },
        };
        // Only allocation and string-writing behavior is stubbed; compiled calls
        // cannot run or return a synthetic scientific result in this fixture.
        const module = new Proxy(stub, {
          get(target, key) {
            if (key === "HEAPU8" || key === "_malloc" || key === "_free")
              return target[key];
            if (typeof key === "string" && key.startsWith("_tspice_"))
              return () => {
                throw new Error("Unexpected compiled call");
              };
            throw new Error(`Unexpected module access: ${String(key)}`);
          },
        }) as EmscriptenModule;
        expect(() =>
          call.run(createFileIoApi(module, handles), daf, das),
        ).toThrow(/WASM malloc failed/);
        expect(live.size).toBe(0);
        expect(handles.size()).toBe(2);
        expect(handles.lookup(daf, ["DAF"], "retry").nativeHandle).toBe(17);
        expect(handles.lookup(das, ["DAS"], "retry").nativeHandle).toBe(19);
      });
});
