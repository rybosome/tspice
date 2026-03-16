import { lookupGeneratedDispatchTableEntry } from "./generatedDispatchTable.generated.js";

export type DispatchLane = "node" | "wasm" | "cspice";

export const GENERATED_DISPATCH_UNAVAILABLE_CODE = "generated_dispatch_unavailable" as const;
export const GENERATED_DISPATCH_UNAVAILABLE_REASON = "generated-dispatch-unavailable" as const;

export type GeneratedDispatchBoundaryErrorFields = {
  code: typeof GENERATED_DISPATCH_UNAVAILABLE_CODE;
  lane: DispatchLane;
  callId: string;
  reason: typeof GENERATED_DISPATCH_UNAVAILABLE_REASON;
  details?: Record<string, unknown>;
};

export type GeneratedDispatchProof = {
  dispatchHandoffAttempted: true;
  fallbackUsed: false;
  stopPoint: typeof GENERATED_DISPATCH_UNAVAILABLE_REASON;
  registryMatched: boolean;
};

/**
 * Normalized error emitted by the canonical generated-dispatch seam boundary.
 */
export class GeneratedDispatchBoundaryError extends Error {
  readonly code = GENERATED_DISPATCH_UNAVAILABLE_CODE;
  readonly lane: DispatchLane;
  readonly callId: string;
  readonly reason = GENERATED_DISPATCH_UNAVAILABLE_REASON;
  readonly details: Record<string, unknown> | undefined;

  constructor(fields: { lane: DispatchLane; callId: string; details?: Record<string, unknown> }) {
    super(
      `Generated dispatch is unavailable (lane=${fields.lane}, callId=${fields.callId}, reason=${GENERATED_DISPATCH_UNAVAILABLE_REASON})`,
    );
    this.name = "GeneratedDispatchBoundaryError";
    this.lane = fields.lane;
    this.callId = fields.callId;
    this.details = fields.details;
  }
}

export type GeneratedDispatchRequest = {
  lane: DispatchLane;
  callId: string;
  fn: string;
  input: unknown;
};

/**
 * Machine-readable proof marker describing fail-closed seam behavior.
 */
export function generatedDispatchProofMarker(registryMatched: boolean): GeneratedDispatchProof {
  return {
    dispatchHandoffAttempted: true,
    fallbackUsed: false,
    stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    registryMatched,
  };
}

/**
 * Canonical generated-dispatch seam boundary.
 *
 * In this phase, generated dispatch metadata is wired, but runtime handlers are
 * intentionally fail-closed until explicit function implementations are landed.
 */
export function handoffToGeneratedDispatchSeam(request: GeneratedDispatchRequest): unknown {
  const entry = lookupGeneratedDispatchTableEntry(request.fn);

  throw new GeneratedDispatchBoundaryError({
    lane: request.lane,
    callId: request.callId,
    details: {
      fn: request.fn,
      ...(entry === null
        ? {}
        : {
            behaviorClass: entry.behaviorClass,
            implemented: entry.implemented,
          }),
      ...generatedDispatchProofMarker(entry !== null),
    },
  });
}
