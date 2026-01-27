import type { KernelSource } from "@rybosome/tspice";

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type TspiceWorkerApi = {
  /** Initialize the worker (creates the WASM backend). */
  init(): Promise<void>;

  /** Load a kernel into the worker's in-memory filesystem. */
  loadKernel(kernel: KernelSource): Promise<void>;

  /** Unload a previously loaded kernel by filesystem path. */
  unloadKernel(path: string): Promise<void>;

  /** Convert UTC string => ephemeris time (seconds past J2000). */
  utcToEt(utc: string): Promise<number>;

  /** Convert ephemeris time (seconds past J2000) => UTC string. */
  etToUtc(et: number): Promise<string>;

  /** Get state vector (position/velocity) of `target` relative to `observer`. */
  getBodyState(input: {
    target: number | string;
    observer: number | string;
    frame: string;
    abcorr?: string;
    et: number;
  }): Promise<{ positionKm: Vec3; velocityKmPerSec: Vec3 }>;

  /** Frame rotation matrix from `from` to `to` (column-major). */
  getFrameTransform(input: {
    from: string;
    to: string;
    et: number;
  }): Promise<Mat3>;
};
