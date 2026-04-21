import type {
  StepOutput,
  StepTimeEt2Utc,
  StepTimeStr2Et,
  StepTimeTimdefGet,
  StepTimeTimdefSet,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type TimeStep = StepTimeStr2Et | StepTimeEt2Utc | StepTimeTimdefGet | StepTimeTimdefSet;

/** Execute one `time.*` workflow step in tspice. */
export function runTimeStep(context: RunTspiceContext, step: TimeStep): StepOutput {
  switch (step.op) {
    case "time.str2et":
      return { op: step.op, value: context.spice.raw.str2et(step.time) };

    case "time.et2utc":
      return {
        op: step.op,
        value: context.spice.raw.et2utc(step.et, step.format, step.prec),
      };

    case "time.timdef":
      if (step.action === "GET") {
        return { op: step.op, value: context.spice.raw.timdef("GET", step.item) };
      }

      context.spice.raw.timdef("SET", step.item, step.value);
      return { op: step.op, value: null };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled time step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
