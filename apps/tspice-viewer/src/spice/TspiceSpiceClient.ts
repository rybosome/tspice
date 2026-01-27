import type { Spice, SpiceTime } from "@rybosome/tspice";

import type {
  BodyRef,
  BodyState,
  EtSeconds,
  FrameId,
  GetBodyStateInput,
  GetFrameTransformInput,
  Mat3,
  SpiceClient,
} from "./SpiceClient.js";

function bodyRefToSpiceString(body: BodyRef): string {
  return typeof body === "number" ? String(body) : body;
}

/**
 * `SpiceClient` adapter around `@rybosome/tspice`.
 */
export class TspiceSpiceClient implements SpiceClient {
  constructor(private readonly spice: Spice) {}

  async getBodyState(input: GetBodyStateInput): Promise<BodyState> {
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

  async getFrameTransform(input: GetFrameTransformInput): Promise<Mat3> {
    return this.spice.frameTransform(
      input.from as FrameId,
      input.to as FrameId,
      input.et as unknown as SpiceTime,
    );
  }

  async etToUtc(et: EtSeconds): Promise<string> {
    return this.spice.etToUtc(et as unknown as SpiceTime, "ISOC", 0);
  }
}
