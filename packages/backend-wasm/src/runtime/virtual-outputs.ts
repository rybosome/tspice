export type VirtualOutputRegistry = {
  /** Mark an output path as opened for write by a native handle. */
  markOpen(resolvedPath: string): void;

  /** Mark an output path as closed (writer handle closed). */
  markClosed(resolvedPath: string): void;

  /**
   * Assert that a VirtualOutput is readable.
   *
   * This is used to ensure `readVirtualOutput()` does not become a generic
   * filesystem read primitive.
   */
  assertReadable(resolvedPath: string, virtualPath: string): void;
};

export function createVirtualOutputRegistry(): VirtualOutputRegistry {
  const known = new Set<string>();
  const openRefCount = new Map<string, number>();

  return {
    markOpen: (resolvedPath) => {
      known.add(resolvedPath);
      openRefCount.set(resolvedPath, (openRefCount.get(resolvedPath) ?? 0) + 1);
    },

    markClosed: (resolvedPath) => {
      const next = (openRefCount.get(resolvedPath) ?? 0) - 1;
      if (next <= 0) {
        openRefCount.delete(resolvedPath);
      } else {
        openRefCount.set(resolvedPath, next);
      }

      // Even if the counts get out of sync, preserve `known` so reads remain
      // namespace-restricted to outputs created via writer APIs.
      known.add(resolvedPath);
    },

    assertReadable: (resolvedPath, virtualPath) => {
      if (!known.has(resolvedPath)) {
        throw new Error(
          `readVirtualOutput(): VirtualOutput ${JSON.stringify(virtualPath)} is not a known virtual output for this backend instance. ` +
            "Only outputs created via writer APIs (e.g. spkopn(...VirtualOutput...)) can be read back.",
        );
      }

      const open = openRefCount.get(resolvedPath) ?? 0;
      if (open > 0) {
        throw new Error(
          `readVirtualOutput(): VirtualOutput ${JSON.stringify(virtualPath)} is still open. ` +
            "Close the writer handle first (e.g. spkcls(handle)) before reading bytes.",
        );
      }
    },
  } satisfies VirtualOutputRegistry;
}
