import type {
  StepErrorChkin,
  StepErrorChkout,
  StepErrorFailed,
  StepErrorGetmsg,
  StepErrorReset,
  StepErrorSetmsg,
  StepErrorSigerr,
  StepOutput,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type ErrorStep =
  | StepErrorFailed
  | StepErrorReset
  | StepErrorGetmsg
  | StepErrorSetmsg
  | StepErrorSigerr
  | StepErrorChkin
  | StepErrorChkout;

/** Execute one `error.*` workflow step in tspice. */
export function runErrorStep(context: RunTspiceContext, step: ErrorStep): StepOutput {
  switch (step.op) {
    case "error.failed":
      return { op: step.op, value: context.spice.raw.failed() };

    case "error.reset":
      context.spice.raw.reset();
      return { op: step.op, value: null };

    case "error.getmsg":
      return { op: step.op, value: context.spice.raw.getmsg(step.which) };

    case "error.setmsg":
      context.spice.raw.setmsg(step.message);
      return { op: step.op, value: null };

    case "error.sigerr":
      context.spice.raw.sigerr(step.short);
      return { op: step.op, value: null };

    case "error.chkin":
      context.spice.raw.chkin(step.name);
      return { op: step.op, value: null };

    case "error.chkout":
      context.spice.raw.chkout(step.name);
      return { op: step.op, value: null };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled error step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
