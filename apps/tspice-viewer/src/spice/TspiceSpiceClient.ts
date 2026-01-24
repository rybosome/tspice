import type { Spice, SpiceTime } from "@rybosome/tspice";

import type {
  BodyRef,
  BodyState,
  FrameId,
  GetBodyStateInput,
  GetFrameTransformInput,
  Mat3,
  SpiceClient,
} from "./SpiceClient.js";

function bodyRefToSpiceString(body: BodyRef): string {
  return typeof body === "number" ? String(body) : body;
}

function transposeMat3RowMajorToColumnMajor(m: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]): Mat3 {
  // row-major => column-major
  // [
  //   m00 m01 m02
  //   m10 m11 m12
  //   m20 m21 m22
  // ]
  // becomes
  // [
  //   m00 m10 m20
  //   m01 m11 m21
  //   m02 m12 m22
  // ]
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/**
 * `SpiceClient` adapter around `@rybosome/tspice`.
 *
 * Note: the viewer expects column-major matrices; tspice/backends use row-major.
 */
export class TspiceSpiceClient implements SpiceClient {
  constructor(private readonly spice: Spice) {}

  getBodyState(input: GetBodyStateInput): BodyState {
    const state = this.spice.getState({
      target: bodyRefToSpiceString(input.target),
      observer: bodyRefToSpiceString(input.observer),
      at: input.et as unknown as SpiceTime,
      frame: input.frame,
      aberration: input.abcorr,
    });

    return {
      positionKm: state.position,
      velocityKmPerSec: state.velocity,
    };
  }

  getFrameTransform(input: GetFrameTransformInput): Mat3 {
    const m = this.spice.frameTransform(
      input.from as FrameId,
      input.to as FrameId,
      input.et as unknown as SpiceTime,
    );

    return transposeMat3RowMajorToColumnMajor(m);
  }
}
