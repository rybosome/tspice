import {
  lookupGeneratedDispatchTableEntry,
  lookupGeneratedTsDispatchMethod,
} from "./generatedDispatchTable.generated.js";

import type { GeneratedDispatchTableEntry } from "./generatedDispatchTable.generated.js";

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
  rawBackend?: Record<string, unknown>;
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

function invalidRequest(message: string): never {
  const error = new TypeError(message) as TypeError & { code: string };
  error.code = "invalid_request";
  throw error;
}

function invalidArgs(message: string): never {
  const error = new TypeError(message) as TypeError & { code: string };
  error.code = "invalid_args";
  throw error;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidArgs(`${label} must be an object (got ${JSON.stringify(value)})`);
  }

  return value as Record<string, unknown>;
}

function resolveDispatchInput(entry: GeneratedDispatchTableEntry, input: unknown): unknown[] {
  if (!Array.isArray(input)) {
    invalidArgs(`generated dispatch for ${entry.key} expects input array`);
  }

  if (input.length !== entry.input.length) {
    invalidArgs(
      `generated dispatch for ${entry.key} expects ${entry.input.length} argument(s) but got ${input.length}`,
    );
  }

  return [...input];
}

function resolveOutSelector(rawResult: unknown, from: string, label: string): unknown {
  if (!from.startsWith("out.")) {
    invalidRequest(`${label} has unsupported selector ${JSON.stringify(from)}`);
  }

  const key = from.slice("out.".length);
  if (key.trim() === "") {
    invalidRequest(`${label} has invalid out selector ${JSON.stringify(from)}`);
  }

  const record = asRecord(rawResult, label);
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    invalidArgs(`${label} is missing output field ${JSON.stringify(key)}`);
  }

  return record[key];
}

function projectGeneratedDispatchOutput(entry: GeneratedDispatchTableEntry, rawResult: unknown): unknown {
  if (!entry.output) {
    return rawResult;
  }

  if ("value" in entry.output) {
    if (entry.output.value.from === "return") {
      return rawResult;
    }

    return resolveOutSelector(rawResult, entry.output.value.from, `${entry.key}.output.value.from`);
  }

  const payload: Record<string, unknown> = {};
  for (const [payloadKey, from] of Object.entries(entry.output.payload)) {
    if (from === "return") {
      payload[payloadKey] = rawResult;
      continue;
    }

    payload[payloadKey] = resolveOutSelector(rawResult, from, `${entry.key}.output.payload.${payloadKey}`);
  }

  return payload;
}

function invokeRawBackendMethod(
  rawBackend: Record<string, unknown>,
  methodName: string,
  fn: string,
  args: unknown[],
): unknown {
  const candidate = rawBackend[methodName];
  if (typeof candidate !== "function") {
    invalidRequest(
      `generated dispatch metadata for ${fn} points to missing raw backend method ${JSON.stringify(methodName)}`,
    );
  }

  return candidate(...args);
}

function invokeGeneratedCallableDispatch(
  request: GeneratedDispatchRequest,
  entry: GeneratedDispatchTableEntry,
): unknown {
  const rawBackend = request.rawBackend;
  if (!rawBackend) {
    invalidRequest(`generated dispatch for ${entry.key} requires an attached raw backend`);
  }

  const methodName = lookupGeneratedTsDispatchMethod(entry.key);
  if (!methodName) {
    invalidRequest(
      `generated dispatch metadata for ${entry.key} is missing executable.ts.method binding`,
    );
  }

  const args = resolveDispatchInput(entry, request.input);
  const rawResult = invokeRawBackendMethod(rawBackend, methodName, entry.key, args);

  return projectGeneratedDispatchOutput(entry, rawResult);
}

/**
 * Canonical generated-dispatch seam boundary.
 */
export function handoffToGeneratedDispatchSeam(request: GeneratedDispatchRequest): unknown {
  const entry = lookupGeneratedDispatchTableEntry(request.fn);

  if (entry !== null && entry.implemented && request.rawBackend !== undefined) {
    return invokeGeneratedCallableDispatch(request, entry);
  }

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
