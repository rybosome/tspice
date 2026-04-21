import type { StepIdsNamesBodn2c, StepOutput } from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

/** Execute one `ids-names.*` workflow step in tspice. */
export function runIdsNamesStep(
  context: RunTspiceContext,
  step: StepIdsNamesBodn2c,
): StepOutput {
  const out = context.spice.raw.bodn2c(step.name);

  if (!out.found) {
    return { op: step.op, value: { found: false } };
  }

  return { op: step.op, value: { found: true, code: out.code } };
}
