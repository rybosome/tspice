export type {
  AbCorr,
  FixedString,
  Found,
  FoundDouble,
  FoundInt,
  FoundPayload,
  FoundString,
  FoundValue,
  IllumfResult,
  IllumgResult,
  IluminResult,
  KernelData,
  KernelInfo,
  KernelKind,
  KernelSource,
  VirtualOutput,
  Mat6RowMajor,
  Mat3ColMajor,
  Mat3RowMajor,
  Pl2nvcResult,
  SpiceHandle,
  SpiceMatrix6x6,
  SpicePlane,
  SpiceStateVector,
  SpiceVector3,
  SpkezrResult,
  SpkposResult,
  StringArrayResult,
  SubPointResult,
  Vec3,
  Vec6,
} from "./shared/types.js";

export type { AssertSpiceInt32Options } from "./shared/spice-int.js";
export {
  SPICE_INT32_MIN,
  SPICE_INT32_MAX,
} from "./shared/spice-int.js";

export type { SpiceHandleEntry, SpiceHandleKind, SpiceHandleRegistry } from "./shared/spice-handles.js";

// Explicit re-exports to ensure these types are always available from the package root.
// (Some TS build modes can be sensitive to type-only exports being pulled via `export *`.)
export type { KernelKindInput, KernelsApi } from "./domains/kernels.js";

export * from "./domains/kernels.js";
export * from "./domains/kernel-pool.js";
export * from "./domains/ek.js";
export * from "./domains/time.js";
export * from "./domains/ids-names.js";
export * from "./domains/frames.js";
export * from "./domains/ephemeris.js";
export * from "./domains/geometry.js";
export * from "./domains/geometry-gf.js";
export * from "./domains/coords-vectors.js";
export * from "./domains/file-io.js";
export * from "./domains/error.js";
export * from "./domains/cells-windows.js";
export * from "./domains/dsk.js";

import type { KernelsApi } from "./domains/kernels.js";
import type { KernelPoolApi } from "./domains/kernel-pool.js";
import type { EkApi } from "./domains/ek.js";
import type { TimeApi, TimeKitApi } from "./domains/time.js";
import type { IdsNamesApi } from "./domains/ids-names.js";
import type { FramesApi } from "./domains/frames.js";
import type { EphemerisApi } from "./domains/ephemeris.js";
import type { GeometryApi } from "./domains/geometry.js";
import type { GeometryGfApi } from "./domains/geometry-gf.js";
import type { CoordsVectorsApi } from "./domains/coords-vectors.js";
import type { FileIoApi, FileIoKitApi } from "./domains/file-io.js";
import type { ErrorApi } from "./domains/error.js";
import type { CellsWindowsApi, CellsWindowsKitApi } from "./domains/cells-windows.js";
import type { DskApi } from "./domains/dsk.js";

export type SpiceBackendKind = "node" | "wasm" | "fake";

/** Composition of all raw domain APIs.  */
export interface SpiceRawBackend
  extends TimeApi,
    KernelsApi,
    KernelPoolApi,
    EkApi,
    IdsNamesApi,
    FramesApi,
    EphemerisApi,
    GeometryApi,
    GeometryGfApi,
    CoordsVectorsApi,
    FileIoApi,
    ErrorApi,
    CellsWindowsApi,
    DskApi { }

/** Composition of all kit domain APIs.  */
export interface SpiceKitBackend
  extends CellsWindowsKitApi,
    TimeKitApi,
    FileIoKitApi { }

/** Unified backend contract */
export interface SpiceBackend {
  /** Low-level, CSPICE-analogous functions. */
  raw: SpiceRawBackend;

  /** Higher-level, tspice-defined functions. */
  kit: SpiceKitBackend;

  /** Which backend implementation is in use. */
  readonly kind: SpiceBackendKind;
}
