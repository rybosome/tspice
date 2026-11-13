import { describe, expect, it } from "vitest";
import type { FileIoApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";
const vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const plates = [1, 2, 3];
const descriptor = {
  bwdptr: -1,
  fwdptr: -1,
  ibase: 0,
  isize: 0,
  dbase: 0,
  dsize: 0,
  cbase: 0,
  csize: 0,
};
const calls: {
  name: string;
  allocations: number;
  run(api: FileIoApi, daf: SpiceHandle, das: SpiceHandle): unknown;
}[] = [
  { name: "exists", allocations: 3, run: (api) => api.exists("missing.bds") },
  { name: "getfat", allocations: 4, run: (api) => api.getfat("input.bds") },
  {
    name: "dlaopn",
    allocations: 5,
    run: (api) => api.dlaopn("new.dla", "DLA", "AUTHORED", 0),
  },
  {
    name: "dskopn",
    allocations: 4,
    run: (api) => api.dskopn("new.bds", "AUTHORED", 0),
  },
  {
    name: "dlafns",
    allocations: 4,
    run: (api, _daf, das) => api.dlafns(das, descriptor),
  },
  {
    name: "dskmi2",
    allocations: 5,
    run: (api) =>
      api.dskmi2(
        3,
        vertices,
        1,
        plates,
        0.2,
        5,
        100000,
        5000,
        5000,
        true,
        200000,
      ),
  },
  {
    name: "dskw02",
    allocations: 7,
    run: (api, _daf, das) =>
      api.dskw02(
        das,
        399,
        71,
        2,
        "J2000",
        3,
        new Array<number>(10).fill(0),
        0,
        1,
        0,
        1,
        0,
        1,
        -10,
        10,
        3,
        vertices,
        1,
        plates,
        new Array<number>(10).fill(0),
        new Array<number>(100020).fill(0),
      ),
  },
];
describe("file writer allocation rollback", () => {
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
          FS: { mkdirTree: () => undefined },
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
            if (
              key === "HEAPU8" ||
              key === "_malloc" ||
              key === "_free" ||
              key === "FS"
            )
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
