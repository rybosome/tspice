import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import {
  J2000,
  type AberrationCorrection,
  type FrameName,
  type GetStateArgs,
  type StateVector,
  type Vec3,
} from "../../types.js";

const DEFAULT_FRAME: FrameName = J2000;
const DEFAULT_ABERRATION: AberrationCorrection = "NONE";

function splitState(state: readonly [number, number, number, number, number, number]): {
  position: Vec3;
  velocity: Vec3;
} {
  const position: Vec3 = [state[0], state[1], state[2]];
  const velocity: Vec3 = [state[3], state[4], state[5]];
  return { position, velocity };
}

export function createStateKit(cspice: SpiceBackend): {
  getState(args: GetStateArgs): StateVector;
} {
  return {
    getState: ({ target, observer, at, frame = DEFAULT_FRAME, aberration = DEFAULT_ABERRATION }) => {
      try {
        const targetStr = String(target);
        const observerStr = String(observer);

        const { state, lt } = cspice.spkezr(targetStr, at, frame, aberration, observerStr);
        const { position, velocity } = splitState(state);
        return {
          et: at,
          frame,
          target: targetStr,
          observer: observerStr,
          aberration,
          position,
          velocity,
          lightTime: lt,
        };
      } catch (error) {
        throw wrapSpiceError("getState", error);
      }
    },
  };
}
