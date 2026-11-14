import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceTransport } from "../src/transport/types.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: actual general-vector results retain dimensions, nonfinite fields and signed zero through RPC`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      const huge = [Number.MAX_VALUE, Number.MAX_VALUE];
      const signed = [1, -0, 2, -3, 4, 5, 6];
      const probes = [
        {
          op: "raw.vaddg",
          args: [huge, huge],
          run: () => raw.vaddg(huge, huge),
        },
        {
          op: "raw.vprojg",
          args: [huge, huge],
          run: () => raw.vprojg(huge, huge),
        },
        { op: "raw.vequg", args: [signed], run: () => raw.vequg(signed) },
        { op: "raw.unormg", args: [[]], run: () => raw.unormg([]) },
      ];
      const { worker, scope } = createConnectedWorkerPair();
      // Actual backend results cross the real codec and structured-clone
      // boundary; this does not claim browser delivery or worker startup.
      worker.onPostMessage = (message) =>
        scope.dispatchMessageFromMain(structuredClone(message));
      scope.onPostMessage = (message) =>
        worker.dispatch("message", { data: structuredClone(message) });
      const server: SpiceTransport = {
        request: async (op, args) => {
          const probe = probes.find((candidate) => candidate.op === op);
          if (!probe)
            throw new Error("Unexpected general-vector RPC operation");
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
          const actual = await transport.request(probe.op, probe.args);
          // Deep equality retains every component, including NaN and -0.
          expect(actual).toEqual(probe.run());
        }
        expect(raw.vaddg(huge, huge)).toEqual([Infinity, Infinity]);
        expect(raw.vprojg(huge, huge).every(Number.isNaN)).toBe(true);
        expect(Object.is(raw.vequg(signed)[1], -0)).toBe(true);
        expect(raw.unormg([])).toEqual({ unit: [], norm: 0 });
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
