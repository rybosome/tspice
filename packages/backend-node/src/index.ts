import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

import { getNodeBinding } from "./lowlevel/binding.js";
import { createKernelStager } from "./runtime/kernel-staging.js";

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
import { createEkApi } from "./domains/ek.js";

export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
  return version;
}

export function createNodeBackend(): SpiceBackend & { kind: "node" } {
  const native = getNodeBinding();
  const stager = createKernelStager();

  const ekApi = createEkApi(native, stager) as ReturnType<typeof createEkApi> & {
    __debugOpenHandleCount?: () => number;
    __debugCloseAllHandles?: () => void;
  };

  const backend: SpiceBackend & { kind: "node" } = {
    kind: "node",
    ...createTimeApi(native),
    ...createKernelsApi(native, stager),
    ...createKernelPoolApi(native),
    ...createIdsNamesApi(native),
    ...createFramesApi(native),
    ...createEphemerisApi(native),
    ...createGeometryApi(native),
    ...createCoordsVectorsApi(native),
    ...createFileIoApi(native),
    ...createErrorApi(native),
    ...createCellsWindowsApi(native),
    ...ekApi,
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () => native.__ktotalAll();

  // Internal EK handle cleanup hooks (not part of the public backend contract).
  // Note: these live on the EK domain wrapper, but that object is spread into
  // `backend`, which drops non-enumerable properties.
  if (ekApi.__debugOpenHandleCount) {
    Object.defineProperty(backend, "__debugEkOpenHandleCount", {
      value: ekApi.__debugOpenHandleCount,
      enumerable: false,
    });
  }
  if (ekApi.__debugCloseAllHandles) {
    Object.defineProperty(backend, "__debugEkCloseAllHandles", {
      value: ekApi.__debugCloseAllHandles,
      enumerable: false,
    });
  }

  return backend;
}
