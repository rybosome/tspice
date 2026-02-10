export type QueueMacrotaskOptions = {
  /**
   * When no macrotask scheduler exists (no `MessageChannel` and no `setTimeout`),
   * there is no way to create a real task boundary.
   *
   * - `true` (default): invoke `fn()` synchronously as a best-effort fallback.
   * - `false`: do not call `fn()` and return `false`.
   */
  allowSyncFallback?: boolean;
};

export function queueMacrotask(fn: () => void, opts?: QueueMacrotaskOptions): boolean {
  const allowSyncFallback = opts?.allowSyncFallback ?? true;

  // Prefer MessageChannel when available. This schedules a real task boundary
  // without relying on timers, which makes it friendlier to fake-timer test
  // environments.
  try {
    if (typeof MessageChannel !== "undefined") {
      const { port1, port2 } = new MessageChannel();

      port1.onmessage = () => {
        port1.onmessage = null;
        // Close ports so this doesn't keep the event loop alive in Node.
        // Be defensive: some polyfills/test environments may not implement
        // `close()`.
        try {
          port1.close?.();
        } catch {
          // ignore
        }
        try {
          port2.close?.();
        } catch {
          // ignore
        }

        fn();
      };

      port2.postMessage(undefined);
      return true;
    }
  } catch {
    // Ignore and fall back to setTimeout.
  }

  // Next preference: a real macrotask via setTimeout.
  if (typeof setTimeout === "function") {
    setTimeout(fn, 0);
    return true;
  }

  // No macrotask scheduler available in this runtime.
  if (allowSyncFallback) fn();
  return false;
}

export function nextMacrotask(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = queueMacrotask(resolve, { allowSyncFallback: false });
    if (!ok) {
      reject(
        new Error(
          "nextMacrotask(): no macrotask scheduler available (MessageChannel/setTimeout missing)",
        ),
      );
    }
  });
}
