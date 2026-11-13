import type {
  SpiceHandle,
  SpiceHandleEntry,
  SpiceHandleKind,
  SpiceHandleRegistry,
} from "./types.js";
import { SPICE_INT32_MAX, SPICE_INT32_MIN } from "./spice-int.js";
import { issueOpaqueSpiceHandle } from "./opaque-handles.js";
import { SpiceBackendContractError } from "./errors.js";

function asHandleId(handle: SpiceHandle, context: string): number {
  const id: number = handle;
  if (typeof id !== "number" || !Number.isFinite(id) || !Number.isInteger(id)) {
    throw new TypeError(
      `${context}: expected a SpiceHandle to be an integer number`,
    );
  }
  if (id <= 0) {
    throw new RangeError(
      `${context}: expected a SpiceHandle to be > 0 (got ${id})`,
    );
  }
  if (!Number.isSafeInteger(id)) {
    throw new RangeError(
      `${context}: expected a SpiceHandle to be a safe integer (got ${id})`,
    );
  }
  return id;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  // This is the one brand-construction boundary for an issued numeric token.
  return handleId as SpiceHandle;
}

type InternalSpiceHandleRegistry = SpiceHandleRegistry & {
  __entries: () => ReadonlyArray<
    readonly [SpiceHandle, Readonly<SpiceHandleEntry>]
  >;
};

function snapshotSpiceHandleEntry(
  entry: SpiceHandleEntry,
): Readonly<SpiceHandleEntry> {
  return Object.freeze({ kind: entry.kind, nativeHandle: entry.nativeHandle });
}

/**
 * Create an in-memory registry for opaque {@link SpiceHandle} values.
 *
 * Used by backends to map stable JS handles to backend-native integer handles.
 */
export function createSpiceHandleRegistry(): SpiceHandleRegistry {
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

    // A per-registry counter aliases the first handle in another backend.
    // Share the issuer with WASM cells/windows, but retain this owner-local map.
    const handleId = issueOpaqueSpiceHandle();
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(
    handle: SpiceHandle,
    expected: readonly SpiceHandleKind[],
    context: string,
  ): SpiceHandleEntry {
    const handleId = asHandleId(handle, `${context}: lookup(handle)`);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new RangeError(
        `${context}: invalid or closed SpiceHandle ${handleId}`,
      );
    }
    if (!expected.includes(entry.kind)) {
      throw new TypeError(
        `${context}: SpiceHandle ${handleId} has kind ${entry.kind}, expected ${expected.join(" or ")}`,
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
        `${context}: invalid or closed SpiceHandle ${handleId}`,
      );
    }
    if (!expected.includes(entry.kind)) {
      throw new TypeError(
        `${context}: SpiceHandle ${handleId} has kind ${entry.kind}, expected ${expected.join(" or ")}`,
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
      Array.from(
        handles.entries(),
        ([handleId, entry]) =>
          [asSpiceHandle(handleId), snapshotSpiceHandleEntry(entry)] as const,
      ),
  };

  return registry;
}
