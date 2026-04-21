import path from "node:path";

import type {
  PathRef,
  PathRefLike,
  StepEphemerisSpkcov,
  StepEphemerisSpkobj,
  StepEphemerisSpkopa,
  StepEphemerisSpkopn,
  WorkflowStep,
} from "../../case-types.js";
import { toPathRef } from "../../fixtures.js";

import { publishGeneratedPath, readGeneratedPath } from "../context.js";
import type { DomainNormalizer, NormalizationContext } from "../types.js";

function generatedPathLookupKey(pathRefLike: PathRefLike): string {
  return toPathRef(pathRefLike).rel;
}

function nextGeneratedSpkSuffix(context: NormalizationContext): number {
  let maxSuffix = -1;

  for (const value of context.generatedPaths.values()) {
    const match = /\.py-parity-(\d+)(\.[^./]+)?$/.exec(value.rel);
    if (match == null) {
      continue;
    }

    const suffix = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(suffix)) {
      maxSuffix = Math.max(maxSuffix, suffix);
    }
  }

  return maxSuffix + 1;
}

function createWritableSpkPath(
  pathRefLike: PathRefLike,
  context: NormalizationContext,
): PathRef {
  const normalized = toPathRef(pathRefLike);
  if (normalized.kind === "scratch") {
    return normalized;
  }

  const basename = path.posix.basename(normalized.rel);
  const ext = path.posix.extname(basename);
  const stem = ext.length > 0 ? basename.slice(0, -ext.length) : basename;

  return {
    kind: "scratch",
    rel: `${stem}.py-parity-${nextGeneratedSpkSuffix(context)}${ext}`,
  };
}

function ensurePublishedGeneratedSpkPath(
  context: NormalizationContext,
  pathRefLike: PathRefLike,
): PathRef {
  const lookupKey = generatedPathLookupKey(pathRefLike);
  const existing = readGeneratedPath(context, lookupKey);
  if (existing != null) {
    return existing;
  }

  const writablePath = createWritableSpkPath(pathRefLike, context);
  publishGeneratedPath(context, lookupKey, writablePath);
  return writablePath;
}

function resolveMappedSpkPath(context: NormalizationContext, pathRefLike: PathRefLike): PathRef {
  const lookupKey = generatedPathLookupKey(pathRefLike);
  return readGeneratedPath(context, lookupKey) ?? toPathRef(pathRefLike);
}

function normalizeSpkReadStep(
  context: NormalizationContext,
  step: StepEphemerisSpkcov | StepEphemerisSpkobj,
): StepEphemerisSpkcov | StepEphemerisSpkobj {
  return {
    ...step,
    spk: resolveMappedSpkPath(context, step.spk),
  };
}

function normalizeSpkFileStep(
  context: NormalizationContext,
  step: StepEphemerisSpkopa,
): StepEphemerisSpkopa {
  return {
    ...step,
    file: resolveMappedSpkPath(context, step.file),
  };
}

export const ephemerisNormalizer: DomainNormalizer = {
  name: "ephemeris",

  publish(step, context) {
    if (step.op !== "ephemeris.spkopn") {
      return;
    }

    ensurePublishedGeneratedSpkPath(context, step.file);
  },

  normalize(step: WorkflowStep, context) {
    switch (step.op) {
      case "ephemeris.spkopn":
        return {
          ...step,
          file: ensurePublishedGeneratedSpkPath(context, step.file),
        };

      case "ephemeris.spkopa":
        return normalizeSpkFileStep(context, step);

      case "ephemeris.spkcov":
      case "ephemeris.spkobj":
        return normalizeSpkReadStep(context, step);

      default:
        return step;
    }
  },
};
