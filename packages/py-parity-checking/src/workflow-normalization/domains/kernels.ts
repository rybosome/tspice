import type {
  StepKernelsFurnsh,
  StepKernelsKinfo,
  StepKernelsUnload,
  WorkflowStep,
} from "../../case-types.js";
import { toPathRef } from "../../fixtures.js";

import { publishAlias, readGeneratedPath } from "../context.js";
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

function normalizeKernelFurnshFile(
  step: StepKernelsFurnsh,
  context: NormalizationContext,
): StepKernelsFurnsh["file"] {
  if (typeof step.file !== "string") {
    return toPathRef(step.file);
  }

  const generatedPath = readGeneratedPath(context, step.file);
  if (generatedPath != null) {
    return generatedPath;
  }

  return toPathRef(step.file);
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
          file: normalizeKernelFurnshFile(step, context),
        };

      case "kernels.kinfo":
      case "kernels.unload":
        return normalizeKernelPathConsumer(step, context);

      default:
        return step;
    }
  },
};
