import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceTransport } from "../src/transport/types.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: real SPK descriptor survives both RPC clone directions`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const { worker, scope } = createConnectedWorkerPair();
      // The transport fixture uses actual structured clone in both directions;
      // the server executes actual production raw methods rather than fake results.
      worker.onPostMessage = (msg) =>
        scope.dispatchMessageFromMain(structuredClone(msg));
      scope.onPostMessage = (msg) =>
        worker.dispatch("message", { data: structuredClone(msg) });
      const server: SpiceTransport = {
        request: async (op, args) => {
          if (op === "raw.spkpds")
            return Reflect.apply(setup.spice.raw.spkpds, setup.spice.raw, args);
          if (op === "raw.spkuds")
            return Reflect.apply(setup.spice.raw.spkuds, setup.spice.raw, args);
          throw Error("Unexpected descriptor test operation");
        },
      };
      exposeTransportToWorker({
        transport: server,
        self: scope,
        closeOnDispose: false,
      });
      const transport = createWorkerTransport({ worker: () => worker });
      try {
        const descriptor = await transport.request("raw.spkpds", [
          -123456,
          -42,
          "ECLIPJ2000",
          8,
          -123.5,
          456.75,
        ]);
        expect(Array.isArray(descriptor)).toBe(true);
        const unpacked = await transport.request("raw.spkuds", [descriptor]);
        expect(unpacked).toEqual({
          body: -123456,
          center: -42,
          frame: 17,
          type: 8,
          first: -123.5,
          last: 456.75,
          baddr: 0,
          eaddr: 0,
        });
      } finally {
        transport.dispose();
        await setup.dispose();
      }
    },
  );
