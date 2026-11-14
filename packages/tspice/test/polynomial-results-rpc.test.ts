import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceTransport } from "../src/transport/types.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: actual polynomial outputs retain complex pairs, derivative order and integral fields through RPC`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      const coefficients = [1, -2, 3];
      const transform = [2, 4] as const;
      const probes = [
        { op: "raw.rquad", args: [-1, 0, -1], run: () => raw.rquad(-1, 0, -1) },
        {
          op: "raw.chbder",
          args: [coefficients, transform, 3, 5],
          run: () => raw.chbder(coefficients, transform, 3, 5),
        },
        {
          op: "raw.chbigr",
          args: [coefficients, transform, 3],
          run: () => raw.chbigr(coefficients, transform, 3),
        },
        {
          op: "raw.polyds",
          args: [coefficients, -1, 3],
          run: () => raw.polyds(coefficients, -1, 3),
        },
      ];
      const { worker, scope } = createConnectedWorkerPair();
      // Exercise actual backend values through the production RPC codec and
      // clone boundary. Browser delivery and worker startup are separate checks.
      worker.onPostMessage = (message) =>
        scope.dispatchMessageFromMain(structuredClone(message));
      scope.onPostMessage = (message) =>
        worker.dispatch("message", { data: structuredClone(message) });
      const server: SpiceTransport = {
        request: async (op, args) => {
          const probe = probes.find((candidate) => candidate.op === op);
          if (!probe) throw new Error("Unexpected polynomial RPC operation");
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
          expect(await transport.request(probe.op, probe.args)).toEqual(
            probe.run(),
          );
        }
        const roots = raw.rquad(-1, 0, -1);
        expect(roots.root1[1]).toBe(-1);
        expect(roots.root2[1]).toBe(1);
        expect(raw.chbder(coefficients, transform, 3, 5)).toHaveLength(6);
        expect(raw.polyds(coefficients, -1, 3)).toEqual([]);
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
