import type { PathRef, WorkflowStep } from "../case-types.js";

export type NormalizeTarget = "sidecar" | "tspice";

export type AliasValue = PathRef | string;

export type NormalizationContext = {
  target: NormalizeTarget;
  aliases: Map<string, AliasValue>;
};

export type DomainNormalizer = {
  name: string;
  publish?: (step: WorkflowStep, context: NormalizationContext) => void;
  normalize?: (step: WorkflowStep, context: NormalizationContext) => WorkflowStep;
};
