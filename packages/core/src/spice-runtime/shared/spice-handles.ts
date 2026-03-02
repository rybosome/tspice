import type {
  SpiceHandle,
  SpiceHandleEntry,
  SpiceHandleKind,
  SpiceHandleRegistry,
} from "./types.js";
import { SPICE_INT32_MAX, SPICE_INT32_MIN } from "./spice-int.js";
import { SpiceBackendContractError } from "./errors.js";

function formatGot(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function formatExpectedGot(context: string, expected: string, got: unknown): string {
  return `${context}: Expected: ${expected}. Got: ${formatGot(got)}`;
}

function asHandleId(handle: SpiceHandle, context: string): number {
  const id = handle as unknown as number;
  if (typeof id !== "number" || !Number.isFinite(id) || !Number.isInteger(id)) {
    throw new TypeError(formatExpectedGot(context, "a SpiceHandle represented by a finite integer", handle));
  }
  if (id <= 0) {
    throw new RangeError(formatExpectedGot(context, "a SpiceHandle > 0", id));
  }
  if (!Number.isSafeInteger(id)) {
    throw new RangeError(formatExpectedGot(context, "a safe-integer SpiceHandle", id));
  }
  return id;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

type InternalSpiceHandleRegistry = SpiceHandleRegistry & {
  __entries: () => ReadonlyArray<readonly [SpiceHandle, Readonly<SpiceHandleEntry>]>;
};

function snapshotSpiceHandleEntry(entry: SpiceHandleEntry): Readonly<SpiceHandleEntry> {
  return Object.freeze({ kind: entry.kind, nativeHandle: entry.nativeHandle });
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
        `backend contract violation (${kind}): Expected: a signed 32-bit integer handle. Got: ${formatGot(nativeHandle)}`,
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
      throw new RangeError(
        formatExpectedGot(context, "an open SpiceHandle (not invalid or closed)", handleId),
      );
    }
    if (!expected.includes(entry.kind)) {
      throw new TypeError(
        `${context}: Expected: SpiceHandle kind ${expected.join(" or ")}. Got: ${entry.kind} (handle ${handleId})`,
      );
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
      throw new RangeError(
        formatExpectedGot(context, "an open SpiceHandle (not invalid or closed)", handleId),
      );
    }
    if (!expected.includes(entry.kind)) {
      throw new TypeError(
        `${context}: Expected: SpiceHandle kind ${expected.join(" or ")}. Got: ${entry.kind} (handle ${handleId})`,
      );
    }

    // Close-once semantics: only forget the handle after the native close succeeds.
    closeNative(entry);
    handles.delete(handleId);
  }

  const registry: InternalSpiceHandleRegistry = {
    register,
    lookup,
    close,
    size: () => handles.size,

    // Internal hook used by the Node backend to best-effort dispose all open handles.
    // Not part of the public backend contract.
    __entries: () =>
      Array.from(handles.entries(), ([handleId, entry]) =>
        [asSpiceHandle(handleId), snapshotSpiceHandleEntry(entry)] as const,
      ),
  };

  return registry;
}
