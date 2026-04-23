import type { PathRef, WorkflowStep } from "../case-types.js";

export type NormalizeTarget = "sidecar" | "tspice";

export type AliasValue = PathRef | string;

export type PreCaseCleanupCandidate = {
  domain: "file-io";
  op: "file-io.dlaopn" | "file-io.dskopn";
  path: PathRef;
};

export type PostCaseCleanupScope = {
  domain: "file-io";
  scope: "open-handles";
};

export type RuntimePathCanonicalizationHint = {
  domain: "frames";
  op: "frames.cklpf" | "frames.ckobj" | "frames.ckcov";
  field: "ck";
  canonicalPath: PathRef;
};

export type WorkflowNormalizationMetadata = {
  preCase: {
    cleanupCandidates: PreCaseCleanupCandidate[];
  };
  postCase: {
    cleanupScopes: PostCaseCleanupScope[];
  };
  runtimePath: {
    canonicalizationHints: RuntimePathCanonicalizationHint[];
  };
};

export type NormalizedWorkflowResult = {
  workflow: WorkflowStep[];
  metadata: WorkflowNormalizationMetadata;
};

export type NormalizationContext = {
  target: NormalizeTarget;
  aliases: Map<string, AliasValue>;
};

export type DomainNormalizer = {
  name: string;
  publish?: (step: WorkflowStep, context: NormalizationContext) => void;
  normalize?: (step: WorkflowStep, context: NormalizationContext) => WorkflowStep;
  analyze?: (
    step: WorkflowStep,
    context: NormalizationContext,
    metadata: WorkflowNormalizationMetadata,
  ) => void;
};
