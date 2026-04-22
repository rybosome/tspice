import type {
  StepKernelsFurnsh,
  StepKernelsKinfo,
  StepKernelsUnload,
  WorkflowStep,
} from "../../case-types.js";
import { toPathRef } from "../../fixtures.js";

import { publishAlias } from "../context.js";
import { resolvePathWithOptionalAlias } from "../helpers.js";
import type { DomainNormalizer, NormalizationContext } from "../types.js";

function publishKernelAlias(step: StepKernelsFurnsh): [string, ReturnType<typeof toPathRef>] | null {
  if (step.alias == null) {
    return null;
  }

  return [step.alias, toPathRef(step.file)];
}

function normalizeKernelPathConsumer(
  step: StepKernelsKinfo | StepKernelsUnload,
  context: NormalizationContext,
): StepKernelsKinfo | StepKernelsUnload {
  return {
    ...step,
    path: resolvePathWithOptionalAlias(step.path, step.alias, context),
  };
}

export const kernelsNormalizer: DomainNormalizer = {
  name: "kernels",

  publish(step, context) {
    if (step.op !== "kernels.furnsh") {
      return;
    }

    const aliasEntry = publishKernelAlias(step);
    if (aliasEntry == null) {
      return;
    }

    const [aliasName, value] = aliasEntry;
    publishAlias(context, aliasName, value);
  },

  normalize(step: WorkflowStep, context) {
    switch (step.op) {
      case "kernels.furnsh":
        return {
          ...step,
          file: toPathRef(step.file),
        };

      case "kernels.kinfo":
      case "kernels.unload":
        return normalizeKernelPathConsumer(step, context);

      default:
        return step;
    }
  },
};
