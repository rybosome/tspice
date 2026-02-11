import type { SpiceHandle } from "./types.js";
import { SPICE_INT32_MAX, SPICE_INT32_MIN } from "./spice-int.js";

export type SpiceHandleKind = "DAF" | "DAS" | "DLA";

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
};

function asHandleId(handle: SpiceHandle, context: string): number {
  const id = handle as unknown as number;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError(`${context}: expected a positive safe integer SpiceHandle`);
  }
  return id;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

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
      throw new Error(`Expected backend to return a 32-bit signed integer handle for ${kind}`);
    }

    if (nextHandleId >= Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `SpiceHandle ID overflow: too many handles allocated (nextHandleId=${nextHandleId})`,
      );
    }

    const handleId = nextHandleId++;
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle, expected: readonly SpiceHandleKind[], context: string): SpiceHandleEntry {
    const handleId = asHandleId(handle, `${context}: lookup(handle)`);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new Error(
        `Invalid SpiceHandle kind: ${handleId} is ${entry.kind}, expected ${expected.join(" or ")}`,
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
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new Error(
        `Invalid SpiceHandle kind: ${handleId} is ${entry.kind}, expected ${expected.join(" or ")}`,
      );
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
  };
}
