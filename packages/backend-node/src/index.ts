import type {
  SpiceBackend,
  SpiceHandle,
  SpiceHandleEntry,
} from "@rybosome/tspice-backend-contract";
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
import { createGeometryGfApi } from "./domains/geometry-gf.js";
import { createIdsNamesApi } from "./domains/ids-names.js";
import { createKernelsApi } from "./domains/kernels.js";
import { createKernelPoolApi } from "./domains/kernel-pool.js";
import { createTimeApi, createTimeKitApi } from "./domains/time.js";
import { createFileIoApi, createFileIoKitApi } from "./domains/file-io.js";
import { createErrorApi } from "./domains/error.js";
import {
  createCellsWindowsApi,
  createCellsWindowsKitApi,
} from "./domains/cells-windows.js";
import { createDskApi } from "./domains/dsk.js";
import { createEkApi } from "./domains/ek.js";

/** Return the SPICE toolkit version exposed by the native Node addon. */
export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(
    typeof version === "string",
    "Expected native backend spiceVersion() to return a string",
  );
  return version;
}

/** Create a {@link SpiceBackend} implementation backed by the native Node addon. */
export function createNodeBackend(): SpiceBackend & { kind: "node" } {
  const native = getNodeBinding();
  const stager = createKernelStager();
  const spiceHandles = createSpiceHandleRegistry();
  const outputs = createVirtualOutputStager();
  const timeApi = createTimeApi(native);
  const fileIoApi = createFileIoApi(native, spiceHandles, stager, outputs);

  const backend: SpiceBackend & { kind: "node" } = {
    kind: "node",
    raw: {
      ...timeApi,
      ...createKernelsApi(native, stager),
      ...createKernelPoolApi(native),
      ...createIdsNamesApi(native),
      ...createFramesApi(native, stager),
      ...createEphemerisApi(native, spiceHandles, stager, outputs),
      ...createGeometryApi(native),
      ...createGeometryGfApi(native),
      ...createCoordsVectorsApi(native),
      ...fileIoApi,
      ...createErrorApi(native),
      ...createCellsWindowsApi(native),
      ...createEkApi(native, spiceHandles, stager),
      ...createDskApi(native, spiceHandles, stager),
    },
    kit: {
      ...createTimeKitApi(native),
      ...createFileIoKitApi(outputs),
      ...createCellsWindowsKitApi(native),
    },
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () =>
    native.__ktotalAll();

  // Internal best-effort cleanup hook (not part of the public backend contract).
  // Closes all currently-registered DAF/DAS/DLA/EK/SPK handles and throws an AggregateError if any closes fail.
  Object.defineProperty(backend, "disposeAll", {
    value: () => {
      const errors: unknown[] = [];
      const entries =
        (
          spiceHandles as typeof spiceHandles & {
            __entries?: () => ReadonlyArray<
              readonly [SpiceHandle, Readonly<SpiceHandleEntry>]
            >;
          }
        ).__entries?.() ?? [];

      for (const [handle, entry] of entries) {
        try {
          if (entry.kind === "SPK") {
            // Ensure VirtualOutputStager bookkeeping stays consistent.
            try {
              backend.raw.spkcls(handle);
            } catch (error) {
              if (
                typeof error !== "object" ||
                error === null ||
                !("spiceShort" in error) ||
                error.spiceShort !== "SPICE(NOSEGMENTSFOUND)"
              ) {
                throw error;
              }
              // Raw SPKCLS intentionally retains an empty writer after this
              // error so callers can recover by writing data. Disposal must
              // still release its underlying DAF without manufacturing data.
              spiceHandles.close(
                handle,
                ["SPK"],
                (e) => native.dafcls(e.nativeHandle),
                "disposeAll:dafcls-empty-spk",
              );
            }
            continue;
          }

          if (entry.kind === "DAF") {
            spiceHandles.close(
              handle,
              ["DAF"],
              (e) => native.dafcls(e.nativeHandle),
              "disposeAll:dafcls",
            );
          } else if (entry.kind === "EK") {
            spiceHandles.close(
              handle,
              ["EK"],
              (e) => native.ekcls(e.nativeHandle),
              "disposeAll:ekcls",
            );
          } else {
            // In CSPICE, dascls_c closes both DAS and DLA handles (dlacls_c is an alias).
            spiceHandles.close(
              handle,
              ["DAS", "DLA"],
              (e) => native.dascls(e.nativeHandle),
              "disposeAll:dascls",
            );
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
        throw new AggregateError(
          errors,
          `disposeAll(): failed to close ${errors.length} handle(s)`,
        );
      }
    },
    enumerable: false,
  });

  return backend;
}
