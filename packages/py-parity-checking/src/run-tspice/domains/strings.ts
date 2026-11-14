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
    case "strings.nextwd":
      return {
        op: step.op,
        value: raw.nextwd(step.input, step.nexlen, step.reslen),
      };
    case "strings.nthwd":
      return {
        op: step.op,
        value: raw.nthwd(step.input, step.nth, step.worlen),
      };
    case "strings.lparse":
      return {
        op: step.op,
        value: raw.lparse(step.list, step.delim, step.nmax, step.itemln),
      };
    case "strings.lparsm":
      return {
        op: step.op,
        value: raw.lparsm(step.list, step.delims, step.nmax, step.itemln),
      };
    case "strings.lx4dec":
      return { op: step.op, value: raw.lx4dec(step.input, step.first) };
    case "strings.lx4num":
      return { op: step.op, value: raw.lx4num(step.input, step.first) };
    case "strings.lx4sgn":
      return { op: step.op, value: raw.lx4sgn(step.input, step.first) };
    case "strings.lx4uns":
      return { op: step.op, value: raw.lx4uns(step.input, step.first) };
    case "strings.lxqstr":
      return {
        op: step.op,
        value: raw.lxqstr(step.input, step.qchar, step.first),
      };
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
