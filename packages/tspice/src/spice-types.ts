import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

import type {
  AberrationCorrection,
  FrameName,
  GetStateArgs,
  Mat3,
  SpiceTime,
  StateVector,
} from "./types.js";

/**
* Low-level SPICE primitive surface.
*
* This is the raw backend contract (node addon, wasm backend, etc.).
*/
export type SpicePrimitive = SpiceBackend;

/**
* Higher-level helpers and convenience APIs built on top of {@link SpicePrimitive}.
*/
export type SpiceTools = {
  /** Load a SPICE kernel. */
  loadKernel(kernel: KernelSource): void;
  /** Unload a previously-loaded SPICE kernel. */
  unloadKernel(path: string): void;

  /** Convert UTC time string to ET seconds past J2000. */
  utcToEt(utc: string): SpiceTime;
  /** Convert ET seconds past J2000 to a formatted UTC string. */
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;

  /** Compute a 3x3 frame transformation matrix (row-major). */
  frameTransform(from: FrameName, to: FrameName, et: SpiceTime): Mat3;

  /** Convenience wrapper around `spkezr` that returns a structured state vector. */
  getState(args: GetStateArgs): StateVector;
};

/**
* Top-level `createSpice()` return type.
*/
export type Spice = {
  /** Raw backend primitives (verbatim). */
  primitive: SpicePrimitive;
  /** Higher-level helpers and typed conveniences. */
  tools: SpiceTools;
};
