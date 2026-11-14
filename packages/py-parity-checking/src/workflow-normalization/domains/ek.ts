import path from "node:path";

import type {
  StepEkEkopn,
  StepEkEkopr,
  StepEkEkopw,
  WorkflowStep,
} from "../../case-types.js";
import { normalizePathRefRelativePath } from "../../runtime/path-ref.js";

import { publishGeneratedPath } from "../context.js";
import type { DomainNormalizer, NormalizationContext } from "../types.js";

type EkPathPublisherStep = StepEkEkopn | StepEkEkopr | StepEkEkopw;

function publishGeneratedEkPath(
  step: EkPathPublisherStep,
  context: NormalizationContext,
): void {
  if (typeof step.path !== "string") {
    if (step.path.kind === "scratch") {
      const rel = normalizePathRefRelativePath(step.path.rel);
      publishGeneratedPath(context, step.path.rel, { kind: "scratch", rel });
    }
    return;
  }
  if (path.isAbsolute(step.path)) {
    return;
  }

  try {
    const normalizedRel = normalizePathRefRelativePath(step.path);
    publishGeneratedPath(context, step.path, {
      kind: "scratch",
      rel: normalizedRel,
    });
  } catch {
    // Ignore un-normalizable paths here; runtime path handling still validates at execution time.
  }
}

export const ekNormalizer: DomainNormalizer = {
  name: "ek",

  publish(step: WorkflowStep, context) {
    switch (step.op) {
      case "ek.ekopn":
      case "ek.ekopr":
      case "ek.ekopw":
        publishGeneratedEkPath(step, context);
        return;

      default:
        return;
    }
  },
};
