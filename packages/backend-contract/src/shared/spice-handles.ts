import type { SpiceHandle } from "./types.js";

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
