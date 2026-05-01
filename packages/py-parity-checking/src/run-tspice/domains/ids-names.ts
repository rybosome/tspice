import type {
  StepIdsNamesBodc2n,
  StepIdsNamesBodc2s,
  StepIdsNamesBoddef,
  StepIdsNamesBodfnd,
  StepIdsNamesBodn2c,
  StepIdsNamesBods2c,
  StepIdsNamesBodvar,
  StepOutput,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type IdsNamesStep =
  | StepIdsNamesBodn2c
  | StepIdsNamesBodc2n
  | StepIdsNamesBodc2s
  | StepIdsNamesBoddef
  | StepIdsNamesBodfnd
  | StepIdsNamesBods2c
  | StepIdsNamesBodvar;

/** Execute one `ids-names.*` workflow step in tspice. */
export function runIdsNamesStep(
  context: RunTspiceContext,
  step: IdsNamesStep,
): StepOutput {
  switch (step.op) {
    case "ids-names.bodn2c": {
      const out = context.spice.raw.bodn2c(step.name);

      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return { op: step.op, value: { found: true, code: out.code } };
    }

    case "ids-names.bodc2n": {
      const out = context.spice.raw.bodc2n(step.code);

      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return { op: step.op, value: { found: true, name: out.name } };
    }

    case "ids-names.bodc2s":
      return { op: step.op, value: context.spice.raw.bodc2s(step.code) };

    case "ids-names.boddef":
      context.spice.raw.boddef(step.name, step.code);
      return { op: step.op, value: null };

    case "ids-names.bodfnd":
      return { op: step.op, value: context.spice.raw.bodfnd(step.body, step.item) };

    case "ids-names.bods2c": {
      const out = context.spice.raw.bods2c(step.name);

      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return { op: step.op, value: { found: true, code: out.code } };
    }

    case "ids-names.bodvar":
      return { op: step.op, value: context.spice.raw.bodvar(step.body, step.item) };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled ids-names step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
