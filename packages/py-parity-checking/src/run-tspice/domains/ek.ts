import type { StepEkEkgc, StepEkEkfind, StepOutput } from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type EkStep = StepEkEkfind | StepEkEkgc;

/** Execute one `ek.*` workflow step in tspice. */
export function runEkStep(context: RunTspiceContext, step: EkStep): StepOutput {
  switch (step.op) {
    case "ek.ekfind":
      return { op: step.op, value: context.spice.raw.ekfind(step.query) };

    case "ek.ekgc":
      return { op: step.op, value: context.spice.raw.ekgc(step.selidx, step.row, step.elment) };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled ek step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
