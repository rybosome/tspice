import type {
  KernelPoolFoundNumbers,
  KernelPoolFoundStrings,
  StepKernelPoolCvpool,
  StepKernelPoolDtpool,
  StepKernelPoolExpool,
  StepKernelPoolGcpool,
  StepKernelPoolGdpool,
  StepKernelPoolGipool,
  StepKernelPoolGnpool,
  StepKernelPoolPcpool,
  StepKernelPoolPdpool,
  StepKernelPoolPipool,
  StepKernelPoolSwpool,
  StepOutput,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type KernelPoolStep =
  | StepKernelPoolGdpool
  | StepKernelPoolGipool
  | StepKernelPoolGcpool
  | StepKernelPoolGnpool
  | StepKernelPoolDtpool
  | StepKernelPoolPdpool
  | StepKernelPoolPipool
  | StepKernelPoolPcpool
  | StepKernelPoolSwpool
  | StepKernelPoolCvpool
  | StepKernelPoolExpool;

function normalizeFoundNumbers(out: { found: false } | { found: true; values: number[] }): KernelPoolFoundNumbers {
  if (!out.found) {
    return { found: false };
  }

  return { found: true, values: out.values };
}

function normalizeFoundStrings(out: { found: false } | { found: true; values: string[] }): KernelPoolFoundStrings {
  if (!out.found) {
    return { found: false };
  }

  return { found: true, values: out.values };
}

/** Execute one `kernel-pool.*` workflow step in tspice. */
export function runKernelPoolStep(
  context: RunTspiceContext,
  step: KernelPoolStep,
): StepOutput {
  switch (step.op) {
    case "kernel-pool.gdpool":
      return {
        op: step.op,
        value: normalizeFoundNumbers(context.spice.raw.gdpool(step.name, step.start, step.room)),
      };

    case "kernel-pool.gipool":
      return {
        op: step.op,
        value: normalizeFoundNumbers(context.spice.raw.gipool(step.name, step.start, step.room)),
      };

    case "kernel-pool.gcpool":
      return {
        op: step.op,
        value: normalizeFoundStrings(context.spice.raw.gcpool(step.name, step.start, step.room)),
      };

    case "kernel-pool.gnpool":
      return {
        op: step.op,
        value: normalizeFoundStrings(context.spice.raw.gnpool(step.template, step.start, step.room)),
      };

    case "kernel-pool.dtpool": {
      const out = context.spice.raw.dtpool(step.name);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return {
        op: step.op,
        value: {
          found: true,
          n: out.n,
          type: out.type,
        },
      };
    }

    case "kernel-pool.pdpool":
      context.spice.raw.pdpool(step.name, step.values);
      return { op: step.op, value: null };

    case "kernel-pool.pipool":
      context.spice.raw.pipool(step.name, step.values);
      return { op: step.op, value: null };

    case "kernel-pool.pcpool":
      context.spice.raw.pcpool(step.name, step.values);
      return { op: step.op, value: null };

    case "kernel-pool.swpool":
      context.spice.raw.swpool(step.agent, step.names);
      return { op: step.op, value: null };

    case "kernel-pool.cvpool":
      return { op: step.op, value: context.spice.raw.cvpool(step.agent) };

    case "kernel-pool.expool":
      return { op: step.op, value: context.spice.raw.expool(step.name) };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled kernel-pool step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
