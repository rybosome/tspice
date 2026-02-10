export function queueMacrotask(fn: () => void): boolean {
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
  fn();
  return false;
}

export function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMacrotask(resolve);
  });
}
