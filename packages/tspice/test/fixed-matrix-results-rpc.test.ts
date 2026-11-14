import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
import type { SpiceTransport } from "../src/transport/types.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: actual matrix results retain NaN, infinities, signed zero and diags2 fields through RPC`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      const hugeDiagonal = brandMat3RowMajor([
        1e200, 0, 0, 0, 1e200, 0, 0, 0, 1e200,
      ]);
      const huge = brandMat3RowMajor(Array(9).fill(Number.MAX_VALUE));
      const twice = brandMat3RowMajor(Array(9).fill(2));
      const signed = brandMat3RowMajor([1, -0, 2, 3, 4, -0, 5, 6, 7]);
      const symmetric = [
        Number.MAX_VALUE,
        Number.MAX_VALUE,
        Number.MAX_VALUE,
        Number.MAX_VALUE,
      ] as const;
      const probes = [
        {
          op: "raw.invert",
          args: [hugeDiagonal],
          run: () => raw.invert(hugeDiagonal),
        },
        {
          op: "raw.mtxm",
          args: [huge, twice],
          run: () => raw.mtxm(huge, twice),
        },
        { op: "raw.mequ", args: [signed], run: () => raw.mequ(signed) },
        {
          op: "raw.diags2",
          args: [symmetric],
          run: () => raw.diags2(symmetric),
        },
      ];
      const { worker, scope } = createConnectedWorkerPair();
      // Exercise actual backend results through the real RPC codec and clone
      // boundary. This does not claim browser asset delivery or worker startup.
      worker.onPostMessage = (message) =>
        scope.dispatchMessageFromMain(structuredClone(message));
      scope.onPostMessage = (message) =>
        worker.dispatch("message", { data: structuredClone(message) });
      const server: SpiceTransport = {
        request: async (op, args) => {
          const probe = probes.find((candidate) => candidate.op === op);
          if (!probe)
            throw new Error("Unexpected fixed-matrix RPC test operation");
          expect(args).toEqual(probe.args);
          return probe.run();
        },
      };
      exposeTransportToWorker({
        transport: server,
        self: scope,
        closeOnDispose: false,
      });
      const transport = createWorkerTransport({ worker: () => worker });
      try {
        for (const probe of probes) {
          const expected = probe.run();
          const actual = await transport.request(probe.op, probe.args);
          // Deep equality observes every component, including NaN and -0.
          expect(actual).toEqual(expected);
        }
        expect(raw.invert(hugeDiagonal).some(Number.isNaN)).toBe(true);
        expect(raw.mtxm(huge, twice).every((value) => value === Infinity)).toBe(
          true,
        );
        expect(Object.is(raw.mequ(signed)[1], -0)).toBe(true);
        expect(raw.failed()).toBe(false);
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
