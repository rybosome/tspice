import { expect, it, vi } from "vitest";
import { isBrandedMat3RowMajor } from "@rybosome/tspice-core";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNodeBinding } from "../src/lowlevel/binding.js";
import type { NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const matrix = [0, 0, 1, 1, 0, 0, 0, 1, 0];
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const cases = [
  { name: "eul2m", args: [0.3, -0.4, 0.5, 3, 2, 1] },
  { name: "m2eul", args: [matrix, 3, 2, 1] },
  { name: "m2q", args: [matrix] },
  { name: "q2m", args: [[0.5, 0.5, 0.5, 0.5]] },
  {
    name: "qxq",
    args: [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
    ],
  },
  {
    name: "qdq2av",
    args: [
      [1, 0, 0, 0],
      [0, 2, -3, 4],
    ],
  },
  { name: "raxisa", args: [matrix] },
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

function mockAdapter(binding: Partial<NativeAddon>) {
  // Only the configured method is invoked on this partial native test double.
  return createCoordsVectorsApi(binding as NativeAddon);
}

function mockOutput(name: Name) {
  switch (name) {
    case "eul2m":
    case "q2m":
      return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    case "m2eul":
      return { angle3: -3, angle2: 2, angle1: 1 };
    case "m2q":
    case "qxq":
      return [7, -3, 2, 1];
    case "qdq2av":
      return [11, -2, 7];
    case "raxisa":
      return { axis: [3, 2, 1], angle: 1.25 };
  }
}

function invalidOutputs(name: Name): unknown[] {
  if (name === "raxisa")
    return [
      null,
      {},
      { axis: [1, 0], angle: 1 },
      { axis: [0, 1, "0"], angle: 1 },
      { axis: [0, 1, 0], angle: "1" },
    ];
  if (name === "m2eul")
    return [
      null,
      {},
      ...["angle1", "angle2", "angle3"].map((key) => ({
        angle1: 1,
        angle2: 2,
        angle3: 3,
        [key]: "1",
      })),
    ];
  const length =
    name === "qdq2av" ? 3 : name === "m2q" || name === "qxq" ? 4 : 9;
  return [
    null,
    {},
    Array(length - 1).fill(1),
    Array(length + 1).fill(1),
    ...Array.from({ length }, (_, bad) =>
      Array.from({ length }, (_, i) => (i === bad ? "1" : 1)),
    ),
  ];
}

for (const { name, args } of cases) {
  it(`${name} forwards scalar positions and owned, once-read component snapshots`, () => {
    const result = mockOutput(name);
    const native = vi.fn().mockReturnValue(result);
    const api = mockAdapter({ [name]: native });
    const arrays = args.map((arg) =>
      Array.isArray(arg) ? observedInput(arg) : undefined,
    );
    const passed = args.map((arg, i) => arrays[i]?.input ?? arg);
    const actual = apply(api, name, passed);
    expect(native).toHaveBeenCalledOnce();
    const delegated = native.mock.calls[0]!;
    arrays.forEach((item, i) => {
      if (item) {
        item.check();
        // Compare identity before passing anything to the assertion formatter,
        // which otherwise inspects the already consumed caller proxy.
        expect(Object.is(delegated[i], item.input)).toBe(false);
      }
      expect(delegated[i]).toEqual(args[i]);
    });
    expect(actual).toEqual(result);
    expect(actual).not.toBe(result);
    const expected = structuredClone(result);
    if (Array.isArray(result)) result.fill(13);
    else if ("axis" in result) {
      result.axis.fill(13);
      result.angle = -1;
    } else result.angle3 = 13;
    expect(actual).toEqual(expected);
    if (name === "q2m" || name === "eul2m")
      expect(isBrandedMat3RowMajor(actual)).toBe(true);
  });

  it(`${name} validates every argument before forwarding and every native output before return`, () => {
    const native = vi.fn();
    const api = mockAdapter({ [name]: native });
    eachInvalid(name, args, (attempt) =>
      expect(() => apply(api, name, attempt)).toThrow(),
    );
    expect(native).not.toHaveBeenCalled();
    for (const bad of invalidOutputs(name)) {
      native.mockReturnValueOnce(bad);
      expect(() => apply(api, name, args)).toThrow();
    }
    native.mockReturnValueOnce(mockOutput(name));
    expect(apply(api, name, args)).toEqual(mockOutput(name));
  });

  it.runIf(nodeAddonAvailable())(
    `${name} enforces native arity, shape and numeric boundaries outside TypeScript`,
    () => {
      const binding = getNodeBinding();
      const direct = (a: readonly unknown[]) =>
        Reflect.apply(binding[name], binding, a);
      expect(() => direct(args.slice(0, -1))).toThrow(/argument count/);
      expect(() => direct([...args, 0])).toThrow(/argument count/);
      eachInvalid(name, args, (attempt) =>
        expect(() => direct(attempt)).toThrow(),
      );
      // Native N-API reads each input entry into its own fixed buffer. Use
      // ordinary finite accessors whose values stay constant on every read.
      const counts = args.map((arg) =>
        Array.isArray(arg) ? arg.map(() => 0) : undefined,
      );
      const accessorArgs = args.map((arg, position) => {
        if (!Array.isArray(arg)) return arg;
        const input = [...arg];
        arg.forEach((value, index) =>
          Object.defineProperty(input, index, {
            get() {
              counts[position]![index]! += 1;
              return value;
            },
          }),
        );
        return input;
      });
      expect(direct(accessorArgs)).toEqual(direct(args));
      counts.forEach((entries) => {
        if (entries) expect(entries).toEqual(entries.map(() => 1));
      });
      const api = createCoordsVectorsApi(binding);
      const retained = apply(api, name, args);
      const reference = structuredClone(retained);
      expect(direct(args)).toEqual(reference);
      expect(apply(api, name, args)).not.toBe(retained);
      if (name === "m2eul" || name === "m2q" || name === "raxisa") {
        expect(
          apply(api, name, [new Float64Array(matrix), ...args.slice(1)]),
        ).toEqual(reference);
      }
      expect(retained).toEqual(reference);
      if (name === "q2m" || name === "eul2m")
        expect(isBrandedMat3RowMajor(retained)).toBe(true);
    },
  );
}

it.runIf(nodeAddonAvailable())(
  "signed32 Euler axes reach the toolkit; invalid rotations leave the Node addon reusable",
  () => {
    const native = getNodeBinding(),
      api = createCoordsVectorsApi(native);
    const badMatrix = [1, 0, 0, 0, 1, 0, 0, 0, -1];
    for (const [name, args, expected] of [
      ["eul2m", [0.1, 0.2, 0.3, -2147483648, 2, 1], "BADAXISNUMBERS"],
      ["eul2m", [0.1, 0.2, 0.3, 3, 2, 2147483647], "BADAXISNUMBERS"],
      ["m2eul", [matrix, 2147483647, 2, 1], "BADAXISNUMBERS"],
      ["m2eul", [matrix, 3, -2147483648, 1], "BADAXISNUMBERS"],
      ["m2eul", [badMatrix, 3, 2, 1], "NOTAROTATION"],
      ["m2q", [badMatrix], "NOTAROTATION"],
      ["raxisa", [badMatrix], "NOTAROTATION"],
    ] as const) {
      for (const target of [native, api]) {
        expect(() => Reflect.apply(target[name], target, args)).toThrow(
          expect.objectContaining({ spiceShort: `SPICE(${expected})` }),
        );
        expect(native.failed()).toBe(false);
        expect(native.m2q(identity)).toEqual([1, 0, 0, 0]);
      }
    }
  },
);
