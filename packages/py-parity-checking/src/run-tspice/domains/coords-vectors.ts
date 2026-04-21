import type { StepCoordsVectorsMxm, StepCoordsVectorsRecgeo, StepOutput } from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";
import { flattenMatrix, unflattenMatrix } from "../utils/matrix.js";

type CoordsVectorsStep = StepCoordsVectorsMxm | StepCoordsVectorsRecgeo;

/** Execute one `coords-vectors.*` workflow step in tspice. */
export function runCoordsVectorsStep(
  context: RunTspiceContext,
  step: CoordsVectorsStep,
): StepOutput {
  switch (step.op) {
    case "coords-vectors.mxm": {
      const out = context.spice.raw.mxm(flattenMatrix(step.m1), flattenMatrix(step.m2));
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.recgeo": {
      const out = context.spice.raw.recgeo(step.rectan, step.re, step.f);
      return { op: step.op, value: out };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled coords-vectors step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
