import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceTransport } from "../src/transport/types.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixture = new URL(
  "../../py-parity-checking/fixtures/kernels/audit-ephemeris.bsp",
  import.meta.url,
);
const littleEndian = new Uint8Array(Uint32Array.of(1).buffer)[0] === 1;
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " transports all packed DAF summary bytes through structured clone",
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      const { worker, scope } = createConnectedWorkerPair();
      worker.onPostMessage = (msg) =>
        scope.dispatchMessageFromMain(structuredClone(msg));
      scope.onPostMessage = (msg) =>
        worker.dispatch("message", { data: structuredClone(msg) });
      const server: SpiceTransport = {
        request: async (op, args) => {
          if (op === "raw.dafgh") return raw.dafgh();
          if (op === "raw.dafgs") return Reflect.apply(raw.dafgs, raw, args);
          throw Error("Unexpected DAF RPC operation");
        },
      };
      exposeTransportToWorker({
        transport: server,
        self: scope,
        closeOnDispose: false,
      });
      const transport = createWorkerTransport({ worker: () => worker });
      try {
        const id = "packed-rpc.bsp";
        raw.furnsh({ path: id, bytes: fs.readFileSync(fixture) });
        raw.unload(id);
        const h = raw.dafopr(id);
        try {
          raw.dafbbs(h);
          expect(raw.daffpa(h)).toBe(true);
          expect(raw.dafgn(h)).toBe("AUTHORED_NAN_DESCRIPTOR");
          const token = await transport.request("raw.dafgh", []);
          expect(token).toBe(h);
          const expected = raw.dafgs(h);
          const packed = await transport.request("raw.dafgs", [token]);
          if (!(packed instanceof Uint8Array))
            throw Error(
              "Packed DAF summary lost its byte-array representation",
            );
          expect(packed).toHaveLength(40);
          expect(packed).toEqual(expected);
          const view = new DataView(
            packed.buffer,
            packed.byteOffset,
            packed.byteLength,
          );
          expect(view.getInt32(16, littleEndian)).toBe(-100011);
          expect(view.getInt32(20, littleEndian)).toBe(-100010);
          if (littleEndian) expect(view.getFloat64(16, true)).toBeNaN();
          packed.fill(0);
          expect(await transport.request("raw.dafgs", [token])).toEqual(
            expected,
          );
        } finally {
          raw.dafcls(h);
        }
      } finally {
        try {
          transport.dispose();
          raw.kclear();
        } finally {
          await setup.dispose();
        }
      }
    },
  );
