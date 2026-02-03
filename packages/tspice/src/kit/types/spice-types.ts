import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

import type {
  AberrationCorrection,
  FrameName,
  GetStateArgs,
  SpiceTime,
  StateVector,
} from "../../types.js";
import type { Mat3 } from "../math/mat3.js";

/**
 * Higher-level helpers and convenience APIs built on top of the raw backend.
 */
export type SpiceKit = {
  /** Load a SPICE kernel. */
  loadKernel(kernel: KernelSource): void;
  /** Unload a previously-loaded SPICE kernel. */
  unloadKernel(path: string): void;

  /** Convenience wrapper around `tkvrsn(\"TOOLKIT\")`. */
  toolkitVersion(): string;

  /** Convert UTC time string to ET seconds past J2000. */
  utcToEt(utc: string): SpiceTime;
  /** Convert ET seconds past J2000 to a formatted UTC string. */
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;

  /** Compute a 3x3 frame transformation matrix. */
  frameTransform(from: FrameName, to: FrameName, et: SpiceTime): Mat3;

  /** Convenience wrapper around `spkezr` that returns a structured state vector. */
  getState(args: GetStateArgs): StateVector;
};

/**
 * Top-level `createSpice()` return type.
 */
export type Spice = {
  /** Raw backend primitives (verbatim). */
  cspice: SpiceBackend;
  /** Higher-level helpers and typed conveniences. */
  kit: SpiceKit;
};
