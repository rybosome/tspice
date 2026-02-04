export type {
  AbCorr,
  Found,
  IluminResult,
  KernelData,
  KernelKind,
  KernelSource,
  Mat3ColMajor,
  Mat3RowMajor,
  SpiceMatrix6x6,
  SpiceStateVector,
  SpiceVector3,
  SpkezrResult,
  SpkposResult,
  SubPointResult,
} from "./shared/types.js";

export type { BrandMat3Options } from "./shared/mat3.js";
export {
  assertMat3ArrayLike9,
  brandMat3ColMajor,
  brandMat3RowMajor,
  isMat3ColMajor,
  isMat3RowMajor,
} from "./shared/mat3.js";

export * from "./domains/kernels.js";
export * from "./domains/time.js";
export * from "./domains/ids-names.js";
export * from "./domains/frames.js";
export * from "./domains/ephemeris.js";
export * from "./domains/geometry.js";
export * from "./domains/coords-vectors.js";

import type { KernelsApi } from "./domains/kernels.js";
import type { TimeApi } from "./domains/time.js";
import type { IdsNamesApi } from "./domains/ids-names.js";
import type { FramesApi } from "./domains/frames.js";
import type { EphemerisApi } from "./domains/ephemeris.js";
import type { GeometryApi } from "./domains/geometry.js";
import type { CoordsVectorsApi } from "./domains/coords-vectors.js";

export type SpiceBackendKind = "node" | "wasm" | "fake";

export interface SpiceBackend
  extends TimeApi,
    KernelsApi,
    IdsNamesApi,
    FramesApi,
    EphemerisApi,
    GeometryApi,
    CoordsVectorsApi {
  /** Which backend implementation is in use. */
  readonly kind: SpiceBackendKind;
}

