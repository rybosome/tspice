import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceTransport } from "../src/transport/types.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const routines = [
  "b1900",
  "j1950",
  "j2100",
  "jyear",
  "tyear",
  "clight",
  "dpmax",
  "dpmin",
  "intmax",
  "intmin",
] as const;

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: scalar constants retain finite extrema and fractional values through RPC`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const { worker, scope } = createConnectedWorkerPair();
      // Exercise the real RPC codec with structured clone in both directions.
      // This is transport coverage, not browser packaging or worker startup.
      worker.onPostMessage = (message) =>
        scope.dispatchMessageFromMain(structuredClone(message));
      scope.onPostMessage = (message) =>
        worker.dispatch("message", { data: structuredClone(message) });
      const server: SpiceTransport = {
        request: async (op, args) => {
          const routine = routines.find((name) => op === `raw.${name}`);
          if (!routine || args.length !== 0)
            throw new Error("Unexpected scalar constant test operation");
          return setup.spice.raw[routine]();
        },
      };
      exposeTransportToWorker({
        transport: server,
        self: scope,
        closeOnDispose: false,
      });
      const transport = createWorkerTransport({ worker: () => worker });
      try {
        for (const routine of routines) {
          const expected = setup.spice.raw[routine]();
          const actual = await transport.request(`raw.${routine}`, []);
          expect(actual).toBe(expected);
          expect(Number.isFinite(actual)).toBe(true);
        }
      } finally {
        try {
          transport.dispose();
        } finally {
          await setup.dispose();
        }
      }
    },
  );
}
