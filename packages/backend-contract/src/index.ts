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

export type { BrandMat3Options } from "./shared/mat3.js";
export {
  assertMat3ArrayLike9,
  isMat3ArrayLike9,
  brandMat3ColMajor,
  brandMat3RowMajor,
  isBrandedMat3ColMajor,
  isBrandedMat3RowMajor,
} from "./shared/mat3.js";

export type { BrandVecOptions } from "./shared/vec.js";
export {
  assertVec3ArrayLike3,
  assertVec6ArrayLike6,
  isVec3ArrayLike3,
  isVec6ArrayLike6,
  brandVec3,
  brandVec6,
  isBrandedVec3,
  isBrandedVec6,
} from "./shared/vec.js";

export type { BrandMat6Options } from "./shared/mat6.js";
export {
  assertMat6ArrayLike36,
  isMat6ArrayLike36,
  brandMat6RowMajor,
  isBrandedMat6RowMajor,
} from "./shared/mat6.js";

export {
  SPICE_INT32_MIN,
  SPICE_INT32_MAX,
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
} from "./shared/spice-int.js";

export type { SpiceHandleEntry, SpiceHandleKind, SpiceHandleRegistry } from "./shared/spice-handles.js";
export { createSpiceHandleRegistry } from "./shared/spice-handles.js";
export { SpiceBackendContractError } from "./shared/errors.js";

export * from "./domains/kernels.js";
export * from "./domains/kernel-pool.js";
export * from "./domains/ek.js";
export * from "./domains/kernels-utils.js";
export * from "./domains/time.js";
export * from "./domains/ids-names.js";
export * from "./domains/ids-names-normalize.js";
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
import type { TimeApi } from "./domains/time.js";
import type { IdsNamesApi } from "./domains/ids-names.js";
import type { FramesApi } from "./domains/frames.js";
import type { EphemerisApi } from "./domains/ephemeris.js";
import type { GeometryApi } from "./domains/geometry.js";
import type { GeometryGfApi } from "./domains/geometry-gf.js";
import type { CoordsVectorsApi } from "./domains/coords-vectors.js";
import type { FileIoApi } from "./domains/file-io.js";
import type { ErrorApi } from "./domains/error.js";
import type { CellsWindowsApi } from "./domains/cells-windows.js";
import type { DskApi } from "./domains/dsk.js";

export type SpiceBackendKind = "node" | "wasm" | "fake";

/**
 * Unified backend contract (composition of all domain APIs).
 */
export interface SpiceBackend
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
    DskApi {
  /** Which backend implementation is in use. */
  readonly kind: SpiceBackendKind;
}
