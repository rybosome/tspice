import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

import { getNodeBinding } from "./lowlevel/binding.js";
import { createKernelStager } from "./runtime/kernel-staging.js";
import { createVirtualOutputStager } from "./runtime/virtual-output-staging.js";
import { createSpiceHandleRegistry } from "./runtime/spice-handles.js";

import { createCoordsVectorsApi } from "./domains/coords-vectors.js";
import { createEphemerisApi } from "./domains/ephemeris.js";
import { createFramesApi } from "./domains/frames.js";
import { createGeometryApi } from "./domains/geometry.js";
import { createIdsNamesApi } from "./domains/ids-names.js";
import { createKernelsApi } from "./domains/kernels.js";
import { createKernelPoolApi } from "./domains/kernel-pool.js";
import { createTimeApi } from "./domains/time.js";
import { createFileIoApi } from "./domains/file-io.js";
import { createErrorApi } from "./domains/error.js";
import { createCellsWindowsApi } from "./domains/cells-windows.js";
import { createDskApi } from "./domains/dsk.js";

export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
  return version;
}

export function createNodeBackend(): SpiceBackend & { kind: "node" } {
  const native = getNodeBinding();
  const stager = createKernelStager();
  const spiceHandles = createSpiceHandleRegistry();
  const outputs = createVirtualOutputStager();

  const backend: SpiceBackend & { kind: "node" } = {
    kind: "node",
    ...createTimeApi(native),
    ...createKernelsApi(native, stager),
    ...createKernelPoolApi(native),
    ...createIdsNamesApi(native),
    ...createFramesApi(native),
    ...createEphemerisApi(native, spiceHandles, outputs),
    ...createGeometryApi(native),
    ...createCoordsVectorsApi(native),
    ...createFileIoApi(native, spiceHandles, outputs),
    ...createErrorApi(native),
    ...createCellsWindowsApi(native),
    ...createDskApi(native, spiceHandles),
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () => native.__ktotalAll();

  // Internal best-effort cleanup hook (not part of the public backend contract).
  // Closes all currently-registered DAF/DAS/DLA handles and throws an AggregateError if any closes fail.
  Object.defineProperty(backend, "disposeAll", {
    value: () => {
      const errors: unknown[] = [];
      const entries = (spiceHandles as unknown as { __entries?: () => ReadonlyArray<readonly [unknown, { kind: "DAF" | "DAS" | "DLA" | "SPK"; nativeHandle: number }]> }).__entries?.() ?? [];
      for (const [handle, entry] of entries) {
        try {
          if (entry.kind === "DAF") {
            spiceHandles.close(handle as any, ["DAF"], (e) => native.dafcls(e.nativeHandle), "disposeAll:dafcls");
          } else if (entry.kind === "SPK") {
            spiceHandles.close(handle as any, ["SPK"], (e) => native.spkcls(e.nativeHandle), "disposeAll:spkcls");
          } else {
            // In CSPICE, dascls_c closes both DAS and DLA handles (dlacls_c is an alias).
            spiceHandles.close(handle as any, ["DAS", "DLA"], (e) => native.dascls(e.nativeHandle), "disposeAll:dascls");
          }
        } catch (err) {
          errors.push(err);
        }
      }

      // Best-effort cleanup for any staged virtual outputs.
      try {
        outputs.dispose();
      } catch (err) {
        errors.push(err);
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, `disposeAll(): failed to close ${errors.length} handle(s)`);
      }
    },
    enumerable: false,
  });

  return backend;
}
