import type { SpiceHandle } from "./types.js";
import { SPICE_INT32_MAX, SPICE_INT32_MIN } from "./spice-int.js";
import { SpiceBackendContractError } from "./errors.js";

export type SpiceHandleKind = "DAF" | "DAS" | "DLA" | "SPK" | "EK";

export type SpiceHandleEntry = {
  kind: SpiceHandleKind;
  nativeHandle: number;
};

export type SpiceHandleRegistry = {
  register: (kind: SpiceHandleKind, nativeHandle: number) => SpiceHandle;
  lookup: (handle: SpiceHandle, expected: readonly SpiceHandleKind[], context: string) => SpiceHandleEntry;
  close: (
    handle: SpiceHandle,
    expected: readonly SpiceHandleKind[],
    closeNative: (entry: SpiceHandleEntry) => void,
    context: string,
  ) => void;
  size: () => number;

  // Internal hook used by some backends for best-effort cleanup.
  // Not part of the stable public API, but safe to ignore.
  __entries?: () => ReadonlyArray<readonly [SpiceHandle, SpiceHandleEntry]>;
};

function asHandleId(handle: SpiceHandle, context: string): number {
  const id = handle as unknown as number;
  if (typeof id !== "number" || !Number.isFinite(id) || !Number.isInteger(id)) {
    throw new TypeError(`${context}: expected a SpiceHandle to be an integer number`);
  }
  if (id <= 0) {
    throw new RangeError(`${context}: expected a SpiceHandle to be > 0 (got ${id})`);
  }
  if (!Number.isSafeInteger(id)) {
    throw new RangeError(`${context}: expected a SpiceHandle to be a safe integer (got ${id})`);
  }
  return id;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

/**
 * Create an in-memory registry for opaque {@link SpiceHandle} values.
 *
 * Used by backends to map stable JS handles to backend-native integer handles.
 */
export function createSpiceHandleRegistry(): SpiceHandleRegistry {
  let nextHandleId = 1;
  const handles = new Map<number, SpiceHandleEntry>();

  function register(kind: SpiceHandleKind, nativeHandle: number): SpiceHandle {
    if (
      typeof nativeHandle !== "number" ||
      !Number.isInteger(nativeHandle) ||
      nativeHandle < SPICE_INT32_MIN ||
      nativeHandle > SPICE_INT32_MAX
    ) {
      throw new SpiceBackendContractError(
        `backend contract violation: expected backend to return a 32-bit signed integer handle for ${kind} (got ${nativeHandle})`,
      );
    }

    if (nextHandleId >= Number.MAX_SAFE_INTEGER) {
      throw new SpiceBackendContractError(`backend contract violation: SpiceHandle ID overflow (nextHandleId=${nextHandleId})`);
    }

    // Defensive: never reuse/collide IDs even if `nextHandleId` gets out of sync.
    while (handles.has(nextHandleId)) {
      nextHandleId++;
      if (nextHandleId >= Number.MAX_SAFE_INTEGER) {
        throw new SpiceBackendContractError(
          `backend contract violation: SpiceHandle ID overflow (nextHandleId=${nextHandleId})`,
        );
      }
    }

    const handleId = nextHandleId++;
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle, expected: readonly SpiceHandleKind[], context: string): SpiceHandleEntry {
    const handleId = asHandleId(handle, `${context}: lookup(handle)`);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new RangeError(`${context}: invalid or closed SpiceHandle ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new TypeError(`${context}: SpiceHandle ${handleId} has kind ${entry.kind}, expected ${expected.join(" or ")}`);
    }
    return entry;
  }

  function close(
    handle: SpiceHandle,
    expected: readonly SpiceHandleKind[],
    closeNative: (entry: SpiceHandleEntry) => void,
    context: string,
  ): void {
    const handleId = asHandleId(handle, `${context}: close(handle)`);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new RangeError(`${context}: invalid or closed SpiceHandle ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new TypeError(`${context}: SpiceHandle ${handleId} has kind ${entry.kind}, expected ${expected.join(" or ")}`);
    }

    // Close-once semantics: only forget the handle after the native close succeeds.
    closeNative(entry);
    handles.delete(handleId);
  }

  return {
    register,
    lookup,
    close,
    size: () => handles.size,

    // Internal hook used by the Node backend to best-effort dispose all open handles.
    // Not part of the public backend contract.
    __entries: () => Array.from(handles.entries()).map(([handleId, entry]) => [asSpiceHandle(handleId), entry] as const),
  };
}
