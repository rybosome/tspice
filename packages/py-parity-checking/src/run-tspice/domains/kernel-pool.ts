import type { StepKernelPoolGcpool, StepOutput } from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

/** Execute one `kernel-pool.*` workflow step in tspice. */
export function runKernelPoolStep(
  context: RunTspiceContext,
  step: StepKernelPoolGcpool,
): StepOutput {
  const out = context.spice.raw.gcpool(step.name, step.start, step.room);

  if (!out.found) {
    return { op: step.op, value: { found: false } };
  }

  return { op: step.op, value: { found: true, values: out.values } };
}
