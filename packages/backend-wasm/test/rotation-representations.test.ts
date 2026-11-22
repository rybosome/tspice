import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { isBrandedMat3RowMajor } from "@rybosome/tspice-core";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import {
  assertEmscriptenModule,
  type EmscriptenModule,
} from "../src/lowlevel/exports.js";
const matrix = [0, 0, 1, 1, 0, 0, 0, 1, 0];
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const cases = [
  { name: "eul2m", args: [0.3, -0.4, 0.5, 3, 2, 1], sizes: [2048, 72] },
  { name: "m2eul", args: [matrix, 3, 2, 1], sizes: [2048, 72, 8, 8, 8] },
  { name: "m2q", args: [matrix], sizes: [2048, 72, 32] },
  { name: "q2m", args: [[0.5, 0.5, 0.5, 0.5]], sizes: [2048, 32, 72] },
  {
    name: "qxq",
    args: [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
    ],
    sizes: [2048, 32, 32, 32],
  },
  {
    name: "qdq2av",
    args: [
      [1, 0, 0, 0],
      [0, 2, -3, 4],
    ],
    sizes: [2048, 32, 32, 24],
  },
  { name: "raxisa", args: [matrix], sizes: [2048, 72, 24, 8] },
] as const;
type Name = (typeof cases)[number]["name"];

function apply(
  api: Pick<CoordsVectorsApi, Name>,
  name: Name,
  args: readonly unknown[],
): unknown {
  return Reflect.apply(api[name], api, args);
}

// The values and lengths are constant. An unexpected second access stops
// before any changed shape or unexpected value could reach the toolkit.
function observedInput(values: readonly number[]) {
  const reads = new Set<PropertyKey>();
  const input = new Proxy([...values], {
    get(target, key, receiver) {
      if (key === Symbol.iterator || reads.has(key))
        throw new Error("Repeated caller input access");
      reads.add(key);
      return Reflect.get(target, key, receiver);
    },
  });
  return {
    input,
    check: () =>
      expect(reads).toEqual(
        new Set(["length", ...values.map((_, i) => String(i))]),
      ),
  };
}

function eachInvalid(
  name: Name,
  args: readonly unknown[],
  check: (attempt: readonly unknown[]) => void,
) {
  args.forEach((value, position) => {
    const replace = (next: unknown) =>
      check(args.map((v, i) => (i === position ? next : v)));
    if (Array.isArray(value)) {
      for (const shape of [
        null,
        {},
        [],
        new Array(value.length - 1).fill(0),
        new Array(value.length + 1).fill(0),
        new DataView(new ArrayBuffer(72)),
        new BigInt64Array(value.length),
      ])
        replace(shape);
      for (let i = 0; i < value.length; i++)
        for (const bad of [NaN, Infinity, -Infinity, undefined, "1"]) {
          const fields: unknown[] = [...value];
          fields[i] = bad;
          replace(fields);
        }
    } else {
      const axis = name === "m2eul" || (name === "eul2m" && position >= 3);
      for (const bad of [
        null,
        "1",
        undefined,
        NaN,
        Infinity,
        -Infinity,
        ...(axis ? [1.5, -2147483649, 2147483648] : []),
      ])
        replace(bad);
    }
  });
}

async function actualModule() {
  const assets = new URL("../emscripten/", import.meta.url);
  const imported: unknown = await import(
    new URL("tspice_backend_wasm.node.js", assets).href
  );
  if (typeof imported !== "object" || imported === null)
    throw new Error("Missing WASM module");
  const factory: unknown = Reflect.get(imported, "default");
  if (typeof factory !== "function")
    throw new Error("Missing WASM module factory");
  const module: unknown = await Reflect.apply(factory, undefined, [
    {
      wasmBinary: fs.readFileSync(new URL("tspice_backend_wasm.wasm", assets)),
      locateFile: (name: string) => fileURLToPath(new URL(name, assets)),
    },
  ]);
  assertEmscriptenModule(module);
  return module;
}

function tracked(module: EmscriptenModule, failAt: number, run: () => void) {
  const warm = module._malloc(8);
  module._free(warm);
  const sizes: number[] = [],
    live = new Set<number>();
  const malloc = module._malloc,
    free = module._free;
  module._malloc = (bytes: number) => {
    sizes.push(bytes);
    if (sizes.length === failAt) return 0;
    const ptr = malloc(bytes);
    if (ptr) live.add(ptr);
    return ptr;
  };
  module._free = (ptr: number) => {
    expect(live.delete(ptr)).toBe(true);
    free(ptr);
  };
  try {
    run();
    expect(live.size).toBe(0);
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
  }
  return sizes;
}

for (const { name, args, sizes } of cases) {
  for (let failAt = 0; failAt <= sizes.length; failAt++) {
    it(`${name} releases actual buffers at ${failAt ? "allocation " + failAt : "success"} and recovers`, async () => {
      const module = await actualModule(),
        api = createCoordsVectorsApi(module);
      const expected = structuredClone(apply(api, name, args));
      const observed = tracked(module, failAt, () => {
        if (failAt)
          expect(() => apply(api, name, args)).toThrow(/WASM malloc failed/);
        else expect(apply(api, name, args)).toEqual(expected);
      });
      expect(observed).toEqual(sizes.slice(0, failAt || sizes.length));
      expect(apply(api, name, args)).toEqual(expected);
    });
  }
  it(`${name} checks every argument before allocation, consumes inputs once and retains results after heap reuse`, async () => {
    const module = await actualModule(),
      api = createCoordsVectorsApi(module);
    const allocated = tracked(module, 0, () => {
      eachInvalid(name, args, (attempt) =>
        expect(() => apply(api, name, attempt)).toThrow(),
      );
    });
    expect(allocated).toEqual([]);
    const expected = structuredClone(apply(api, name, args));
    const trackedInputs = args.map((arg) =>
      Array.isArray(arg) ? observedInput(arg) : undefined,
    );
    const actual = apply(
      api,
      name,
      args.map((arg, i) => trackedInputs[i]?.input ?? arg),
    );
    for (const item of trackedInputs) item?.check();
    expect(actual).toEqual(expected);
    if (name === "eul2m" || name === "q2m")
      expect(isBrandedMat3RowMajor(actual)).toBe(true);
    if (name === "m2eul" || name === "m2q" || name === "raxisa")
      expect(
        apply(api, name, [new Float64Array(matrix), ...args.slice(1)]),
      ).toEqual(expected);
    // Successive operations reuse the temporary matrix, vector and angle storage.
    for (const other of cases) apply(api, other.name, other.args);
    api.eul2m(0, 0, 0, 3, 2, 1);
    api.m2q(api.q2m([1, 0, 0, 0]));
    expect(actual).toEqual(expected);
    expect(apply(api, name, args)).not.toBe(actual);
  });
}

const reflection = [1, 0, 0, 0, 1, 0, 0, 0, -1];
for (const { name, bad, code, count } of [
  {
    name: "eul2m",
    bad: [0.1, 0.2, 0.3, -2147483648, 2, 1],
    code: "BADAXISNUMBERS",
    count: 2,
  },
  {
    name: "m2eul",
    bad: [identity, 3, 2, 2147483647],
    code: "BADAXISNUMBERS",
    count: 5,
  },
  { name: "m2q", bad: [reflection], code: "NOTAROTATION", count: 3 },
  { name: "raxisa", bad: [reflection], code: "NOTAROTATION", count: 4 },
] as const) {
  // These four toolkit errors populate short, long and trace diagnostics.
  // Inject acquisition failures in those buffers as well as in normal calls.
  for (let diagnostic = 0; diagnostic <= 3; diagnostic++) {
    it(`${name} releases status buffers at ${diagnostic ? "diagnostic allocation " + diagnostic : "toolkit error"}`, async () => {
      const module = await actualModule(),
        api = createCoordsVectorsApi(module);
      const failAt = diagnostic ? count + diagnostic : 0;
      const acquired = tracked(module, failAt, () => {
        const call = () => apply(api, name, bad);
        if (diagnostic) expect(call).toThrow(/WASM malloc failed/);
        else
          expect(call).toThrow(
            expect.objectContaining({ spiceShort: `SPICE(${code})` }),
          );
      });
      expect(acquired).toHaveLength(failAt || count + 3);
      const good = cases.find((test) => test.name === name)!;
      expect(() => apply(api, name, good.args)).not.toThrow();
    });
  }
}

// These quaternion routines have no scientific error on valid supplied
// storage. Inject only a transport status to exercise their wrapper branches.
for (const name of ["q2m", "qxq", "qdq2av"] as const) {
  it(`${name} propagates a shim status and releases temporaries before genuine retry`, async () => {
    const module = await actualModule(),
      api = createCoordsVectorsApi(module);
    const test = cases.find((entry) => entry.name === name)!;
    const accepted = structuredClone(apply(api, name, test.args));
    const key = `_tspice_${name}` as const;
    const original = module[key];
    try {
      module[key] = (...args: number[]) => {
        const err = args[args.length - 2]!;
        module.HEAPU8[err >>> 0] = 0;
        return 1;
      };
      const sizes = tracked(module, 0, () =>
        expect(() => apply(api, name, test.args)).toThrow(
          /CSPICE call failed with code 1/,
        ),
      );
      // The fresh module has no prior CSPICE error to populate long or trace.
      expect(sizes).toEqual([...test.sizes, 2048]);
    } finally {
      // Restore only the specific transport stub installed above.
      Reflect.set(module, key, original);
    }
    expect(apply(api, name, test.args)).toEqual(accepted);
  });
}
