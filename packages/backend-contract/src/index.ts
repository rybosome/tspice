export type {
  AbCorr,
  FixedString,
  Found,
  FoundDouble,
  FoundInt,
  FoundPayload,
  FoundString,
  FoundValue,
  IluminResult,
  KernelData,
  KernelInfo,
  KernelKind,
  KernelSource,
  Mat6RowMajor,
  Mat3ColMajor,
  Mat3RowMajor,
  SpiceHandle,
  SpiceMatrix6x6,
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

export * from "./domains/kernels.js";
export * from "./domains/kernel-pool.js";
export * from "./domains/kernels-utils.js";
export * from "./domains/time.js";
export * from "./domains/ids-names.js";
export * from "./domains/ids-names-normalize.js";
export * from "./domains/frames.js";
export * from "./domains/ephemeris.js";
export * from "./domains/geometry.js";
export * from "./domains/coords-vectors.js";
export * from "./domains/file-io.js";
export * from "./domains/error.js";
export * from "./domains/cells-windows.js";

import type { KernelsApi } from "./domains/kernels.js";
import type { KernelPoolApi } from "./domains/kernel-pool.js";
import type { TimeApi } from "./domains/time.js";
import type { IdsNamesApi } from "./domains/ids-names.js";
import type { FramesApi } from "./domains/frames.js";
import type { EphemerisApi } from "./domains/ephemeris.js";
import type { GeometryApi } from "./domains/geometry.js";
import type { CoordsVectorsApi } from "./domains/coords-vectors.js";
import type { FileIoApi } from "./domains/file-io.js";
import type { ErrorApi } from "./domains/error.js";
import type { CellsWindowsApi } from "./domains/cells-windows.js";

export type SpiceBackendKind = "node" | "wasm" | "fake";

export interface SpiceBackend
  extends TimeApi,
    KernelsApi,
    KernelPoolApi,
    IdsNamesApi,
    FramesApi,
    EphemerisApi,
    GeometryApi,
    CoordsVectorsApi,
    FileIoApi,
    ErrorApi,
    CellsWindowsApi {
  /** Which backend implementation is in use. */
  readonly kind: SpiceBackendKind;
}
