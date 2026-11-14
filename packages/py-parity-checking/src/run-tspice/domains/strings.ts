import type { StepOutput, WorkflowStep } from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type StringsStep = Extract<WorkflowStep, { op: `strings.${string}` }>;

/** Execute the public raw string operation and retain its complete output. */
export function runStringsStep(
  context: RunTspiceContext,
  step: StringsStep,
): StepOutput {
  const raw = context.spice.raw;
  switch (step.op) {
    case "strings.cmprss":
      return {
        op: step.op,
        value: raw.cmprss(step.delim, step.n, step.input, step.lenout),
      };
    case "strings.eqstr":
      return { op: step.op, value: raw.eqstr(step.a, step.b) };
    case "strings.iswhsp":
      return { op: step.op, value: raw.iswhsp(step.input) };
    case "strings.lastnb":
      return { op: step.op, value: raw.lastnb(step.input) };
    case "strings.lcase":
      return { op: step.op, value: raw.lcase(step.input, step.lenout) };
    case "strings.ucase":
      return { op: step.op, value: raw.ucase(step.input, step.lenout) };
    case "strings.matchi":
      return {
        op: step.op,
        value: raw.matchi(step.input, step.template, step.wstr, step.wchr),
      };
    case "strings.matchw":
      return {
        op: step.op,
        value: raw.matchw(step.input, step.template, step.wstr, step.wchr),
      };
  }
}
