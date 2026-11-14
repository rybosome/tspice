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
    case "strings.dp2hx":
      return { op: step.op, value: raw.dp2hx(step.value, step.lenout) };
    case "strings.hx2dp":
      return { op: step.op, value: raw.hx2dp(step.input, step.lenout) };
    case "strings.prsdp":
      return { op: step.op, value: raw.prsdp(step.input) };
    case "strings.prsint":
      return { op: step.op, value: raw.prsint(step.input) };
    case "strings.repmc":
      return {
        op: step.op,
        value: raw.repmc(step.input, step.marker, step.value, step.lenout),
      };
    case "strings.repmct":
      return {
        op: step.op,
        value: raw.repmct(
          step.input,
          step.marker,
          step.value,
          step.rtcase,
          step.lenout,
        ),
      };
    case "strings.repmd":
      return {
        op: step.op,
        value: raw.repmd(
          step.input,
          step.marker,
          step.value,
          step.sigdig,
          step.lenout,
        ),
      };
    case "strings.repmf":
      return {
        op: step.op,
        value: raw.repmf(
          step.input,
          step.marker,
          step.value,
          step.sigdig,
          step.format,
          step.lenout,
        ),
      };
    case "strings.repmi":
      return {
        op: step.op,
        value: raw.repmi(step.input, step.marker, step.value, step.lenout),
      };
    case "strings.repml":
      return {
        op: step.op,
        value: raw.repml(
          step.input,
          step.marker,
          step.value,
          step.rtcase,
          step.lenout,
        ),
      };
    case "strings.repmot":
      return {
        op: step.op,
        value: raw.repmot(
          step.input,
          step.marker,
          step.value,
          step.rtcase,
          step.lenout,
        ),
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
