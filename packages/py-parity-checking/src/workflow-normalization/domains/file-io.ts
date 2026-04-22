import type {
  StepFileIoDafopr,
  StepFileIoDasopr,
  StepFileIoDlaopn,
  StepFileIoDskopn,
  StepFileIoExists,
  StepFileIoGetfat,
  WorkflowStep,
} from "../../case-types.js";
import { toPathRef } from "../../fixtures.js";

import { publishAlias, readAlias } from "../context.js";
import type { DomainNormalizer, NormalizationContext } from "../types.js";

type FileIoPathStep =
  | StepFileIoExists
  | StepFileIoGetfat
  | StepFileIoDafopr
  | StepFileIoDasopr
  | StepFileIoDlaopn
  | StepFileIoDskopn;

type FileIoAliasPublisher = StepFileIoDlaopn | StepFileIoDskopn;

function publishFileIoAlias(step: FileIoAliasPublisher): [string, ReturnType<typeof toPathRef>] | null {
  if (step.alias == null) {
    return null;
  }

  return [step.alias, toPathRef(step.path)];
}

function normalizeFileIoPath(
  step: FileIoPathStep,
  context: NormalizationContext,
): FileIoPathStep {
  if (step.alias == null) {
    return {
      ...step,
      path: toPathRef(step.path),
    };
  }

  return {
    ...step,
    path: toPathRef(readAlias(context, step.alias)),
  };
}

export const fileIoNormalizer: DomainNormalizer = {
  name: "file-io",

  publish(step, context) {
    switch (step.op) {
      case "file-io.dlaopn":
      case "file-io.dskopn": {
        const aliasEntry = publishFileIoAlias(step);
        if (aliasEntry == null) {
          return;
        }

        const [aliasName, value] = aliasEntry;
        publishAlias(context, aliasName, value);
        return;
      }

      default:
        return;
    }
  },

  normalize(step: WorkflowStep, context) {
    switch (step.op) {
      case "file-io.exists":
      case "file-io.getfat":
      case "file-io.dafopr":
      case "file-io.dasopr":
      case "file-io.dlaopn":
      case "file-io.dskopn":
        return normalizeFileIoPath(step, context);

      default:
        return step;
    }
  },
};
