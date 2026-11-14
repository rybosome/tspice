import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  Found,
  KernelData,
  KernelInfo,
} from "@rybosome/tspice-backend-contract";
import type { ParityCase } from "../src/case-types.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/kernels",
);
function meta(children: string[]): Uint8Array {
  // Kernel-pool string literals are limited to 80 characters. Expand a path
  // symbol instead of truncating longer absolute child filenames on macOS.
  const root = path.dirname(children[0]!);
  expect(root.length).toBeLessThanOrEqual(80);
  return new TextEncoder().encode(
    `KPL/MK\n\\begindata\nPATH_SYMBOLS = ( 'AUDIT_ROOT' )\nPATH_VALUES = ( '${root}' )\nKERNELS_TO_LOAD = (\n${children.map((p) => `'$AUDIT_ROOT/${path.basename(p)}'`).join("\n")}\n)\n\\begintext\n`,
  );
}
function infoView(value: Found<KernelInfo>): unknown {
  return value.found
    ? {
        found: true,
        filtyp: value.filtyp,
        source: path.basename(value.source),
        handleIsZero: value.handle === 0,
      }
    : value;
}
function dataView(value: Found<KernelData>): unknown {
  return value.found
    ? {
        found: true,
        file: path.basename(value.file),
        filtyp: value.filtyp,
        source: path.basename(value.source),
        handleIsZero: value.handle === 0,
      }
    : value;
}
describe("meta-kernel source and cache live parity", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      backend,
      async () => {
        const root = fs.realpathSync(
          fs.mkdtempSync(path.join(os.tmpdir(), "m-")),
        );
        const setup = await spiceClients.toSync({ backend });
        const raw = setup.spice.raw;
        const names = ["naif0012.tls", "file-io-minimal.bsp"];
        try {
          for (const name of names)
            fs.copyFileSync(path.join(fixtures, name), path.join(root, name));
          fs.writeFileSync(
            path.join(root, "audit.tm"),
            meta(names.map((n) => path.join(root, n))),
          );
          const parityCase: ParityCase = {
            caseId: "kernels-meta-sources-cache-live",
            description:
              "Actual meta children, duplicate source lookup, unload and cache invalidation",
            expectation: { kind: "success" },
            workflow: [
              { op: "kernels.furnsh", file: "audit.tm" },
              { op: "kernels.ktotal", kind: "ALL" },
              ...[0, 1, 2].map((which) => ({
                op: "kernels.kdata" as const,
                which,
                kind: "ALL",
              })),
              { op: "kernels.kinfo", path: names[0]! },
              { op: "kernels.kinfo", path: names[1]! },
              { op: "kernels.furnsh", file: names[0]! },
              { op: "kernels.kinfo", path: names[0]! },
              { op: "kernels.unload", path: "audit.tm" },
              { op: "kernels.ktotal", kind: "ALL" },
              { op: "kernels.kinfo", path: names[0]! },
              { op: "kernels.kinfo", path: names[1]! },
              { op: "kernels.kclear" },
              { op: "kernels.kinfo", path: names[0]! },
            ],
          };
          const oracle = await runCaseInSidecar(parityCase, root);
          if (!oracle.ok) throw new Error(JSON.stringify(oracle));
          expect(
            oracle.outputs.find((o) => o.op === "kernels.ktotal")?.value,
          ).toBe(3);
          const expected = oracle.outputs
            .filter((o) => o.value !== null)
            .map((o) => {
              if (o.op === "kernels.ktotal") return o.value;
              if (o.op === "kernels.kdata" && o.value.found)
                return {
                  ...o.value,
                  file: path.basename(o.value.file),
                  source: path.basename(o.value.source),
                };
              if (o.op === "kernels.kinfo" && o.value.found) {
                const { handleMatchesEntry, ...v } = o.value;
                expect(handleMatchesEntry).toBe(true);
                return { ...v, source: path.basename(v.source) };
              }
              return o.value;
            });
          const childPaths = names.map((n) =>
            backend === "node" ? path.join(root, n) : `/kernels/${n}`,
          );
          raw.kclear();
          if (backend === "wasm") {
            for (const name of names)
              raw.furnsh({
                path: name,
                bytes: fs.readFileSync(path.join(root, name)),
              });
            raw.kclear(); // Keep WASM files as fixture preparation, with no loaded state.
          }
          const actual: unknown[] = [];
          raw.furnsh({ path: "audit.tm", bytes: meta(childPaths) });
          actual.push(raw.ktotal("ALL"));
          for (const i of [0, 1, 2]) actual.push(dataView(raw.kdata(i, "ALL")));
          for (const child of childPaths)
            actual.push(infoView(raw.kinfo(child)));
          raw.furnsh(childPaths[0]!);
          actual.push(infoView(raw.kinfo(childPaths[0]!)));
          raw.unload("audit.tm");
          actual.push(raw.ktotal("ALL"));
          for (const child of childPaths)
            actual.push(infoView(raw.kinfo(child)));
          raw.kclear();
          actual.push(infoView(raw.kinfo(childPaths[0]!)));
          expect(actual).toEqual(expected);
        } finally {
          raw.kclear();
          await setup.dispose();
          fs.rmSync(root, { recursive: true, force: true });
        }
      },
      20000,
    );
});
