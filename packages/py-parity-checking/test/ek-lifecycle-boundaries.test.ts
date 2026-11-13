import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
import {
  createRunTspiceContext,
  registerEkHandle,
  clearKernelState,
  cleanupContext,
} from "../src/run-tspice/context.js";
describe("actual EK ownership and cleanup boundaries", () => {
  for (const backend of ["wasm", "node"] as const) {
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      `${backend}: foreign and expired claims recover`,
      async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ek-owner-"));
        const a = await spiceClients.toSync({ backend }),
          b = await spiceClients.toSync({ backend });
        const raw = a.spice.raw;
        const file =
          backend === "node" ? path.join(root, "a.ek") : "owner-a.ek";
        let local: SpiceHandle | undefined, foreign: SpiceHandle | undefined;
        try {
          local = raw.ekopn(file, "AUTHORED_A", 0);
          foreign = b.spice.raw.ekopn(
            backend === "node" ? path.join(root, "b.ek") : "owner-b.ek",
            "AUTHORED_B",
            0,
          );
          for (const attempt of [
            () => raw.eknseg(foreign!),
            () => raw.ekcls(foreign!),
            () =>
              raw.ekifld(foreign!, "AUDIT", 1, ["ID"], ["DATATYPE=INTEGER"]),
          ])
            expect(attempt).toThrow(/invalid or closed SpiceHandle/);
          expect(raw.eknseg(local)).toBe(0);
          expect(b.spice.raw.eknseg(foreign)).toBe(0);
          const expired = local;
          raw.ekcls(local);
          local = undefined;
          local = raw.ekopw(file);
          expect(() => raw.eknseg(expired)).toThrow(
            /invalid or closed SpiceHandle/,
          );
          const segment = raw.ekifld(
            local,
            "AUDIT",
            1,
            ["ID"],
            ["DATATYPE=INTEGER"],
          );
          raw.ekacli(
            local,
            segment.segno,
            "ID",
            [7],
            [1],
            [false],
            segment.rcptrs,
          );
          raw.ekffld(local, segment.segno, segment.rcptrs);
          raw.ekcls(local);
          local = raw.ekopr(file);
          expect(raw.eknseg(local)).toBe(1);
        } finally {
          if (local !== undefined) raw.ekcls(local);
          if (foreign !== undefined) b.spice.raw.ekcls(foreign);
          await b.dispose();
          await a.dispose();
          fs.rmSync(root, { recursive: true, force: true });
        }
      },
    );
    for (const retry of [false, true])
      it.runIf(backend === "wasm" || nodeBackendAvailable)(
        `${backend}: tracked close ${retry ? "retry" : "before scratch"}`,
        async () => {
          const setup = await spiceClients.toSync({ backend });
          const raw = setup.spice.raw;
          let attempts = 0,
            shouldFail = retry;
          let h: SpiceHandle | undefined;
          const wrapped = {
            ...setup.spice,
            kit: setup.spice.kit,
            raw: {
              ...raw,
              kclear: () => raw.kclear(),
              reset: () => raw.reset(),
              ekcls: (handle: SpiceHandle): void => {
                attempts++;
                if (shouldFail) {
                  shouldFail = false;
                  throw new Error("Authored close failure before native call");
                }
                expect(fs.existsSync(context.paths.scratchRoot)).toBe(true);
                raw.ekcls(handle);
              },
            },
          };
          const context = createRunTspiceContext(
            wrapped,
            os.tmpdir(),
            "actual-ek-cleanup",
          );
          try {
            clearKernelState(context);
            h = raw.ekopn(
              backend === "node"
                ? path.join(context.paths.scratchRoot, "pending.ek")
                : "py-parity/scratch/pending.ek",
              "AUTHORED_PENDING",
              0,
            );
            registerEkHandle(context, "w", h);
            if (retry) {
              const finalizer = context.lifecycle.finalizers.find(
                (entry) => entry.label === "ek.closeHandle:w",
              );
              if (!finalizer)
                throw new Error("Missing actual EK close finalizer");
              finalizer.run();
              expect(context.state.ek.handles.get("w")).toBe(h);
              finalizer.run();
              expect(context.state.ek.handles.size).toBe(0);
              h = undefined;
            }
            cleanupContext(context);
            h = undefined;
            expect(attempts).toBe(retry ? 2 : 1);
            expect(context.state.ek.handles.size).toBe(0);
            expect(fs.existsSync(context.paths.scratchRoot)).toBe(false);
          } finally {
            if (h !== undefined)
              try {
                raw.ekcls(h);
              } catch {
                // Best-effort cleanup preserves the original test failure.
              }
            await setup.dispose();
            fs.rmSync(context.paths.scratchRoot, {
              recursive: true,
              force: true,
            });
          }
        },
      );
  }
});
