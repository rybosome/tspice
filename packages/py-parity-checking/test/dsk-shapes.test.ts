import { describe, expect, it } from "vitest";
import type { Spice } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const cases: {
  name: string;
  run(raw: Spice["raw"], remember: (handle: SpiceHandle) => void): void;
}[] = [
  {
    name: "large declared vertex count with tiny supplied array",
    run: (raw) => {
      raw.dskmi2(
        100000000,
        vertices,
        1,
        [1, 2, 3],
        0.2,
        5,
        100000,
        5000,
        5000,
        true,
        200000,
      );
    },
  },
  {
    name: "large declared plate count with tiny supplied array",
    run: (raw) => {
      raw.dskmi2(
        3,
        vertices,
        100000000,
        [1, 2, 3],
        0.2,
        5,
        100000,
        5000,
        5000,
        true,
        200000,
      );
    },
  },
  {
    name: "string vertices",
    run: (raw) => {
      raw.dskmi2(
        3,
        "000100010" as never,
        1,
        [1, 2, 3],
        0.2,
        5,
        100000,
        5000,
        5000,
        true,
        200000,
      );
    },
  },
  {
    name: "numeric boolean",
    run: (raw) => {
      raw.dskmi2(
        3,
        vertices,
        1,
        [1, 2, 3],
        0.2,
        5,
        100000,
        5000,
        5000,
        1 as never,
        200000,
      );
    },
  },
  {
    name: "string scale",
    run: (raw) => {
      raw.dskmi2(
        3,
        vertices,
        1,
        [1, 2, 3],
        "0.2" as never,
        5,
        100000,
        5000,
        5000,
        true,
        200000,
      );
    },
  },
  {
    name: "DLA numeric type",
    run: (raw, remember) => {
      remember(raw.dlaopn("shape.dla", 19 as never, "AUTHORED", 0));
    },
  },
  {
    name: "DLA numeric name",
    run: (raw, remember) => {
      remember(raw.dlaopn("shape.dla", "DLA", 19 as never, 0));
    },
  },
  {
    name: "DSK numeric name",
    run: (raw, remember) => {
      remember(raw.dskopn("shape.bds", 19 as never, 0));
    },
  },
];
describe("DSK/DLA runtime input shapes", () => {
  for (const backend of ["wasm", "node"] as const)
    for (const c of cases)
      it.runIf(backend === "wasm" || nodeBackendAvailable)(
        `${backend}: ${c.name}`,
        async () => {
          const setup = await spiceClients.toSync({ backend });
          let handle: SpiceHandle | undefined;
          try {
            expect(() =>
              c.run(setup.spice.raw, (h) => {
                handle = h;
              }),
            ).toThrow();
          } finally {
            if (handle !== undefined) setup.spice.raw.dascls(handle);
            setup.spice.raw.kclear();
            await setup.dispose();
          }
        },
      );
});
