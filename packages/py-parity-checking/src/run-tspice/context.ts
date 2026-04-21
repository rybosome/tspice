import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import type { Spice } from "@rybosome/tspice";

export type RunTspiceContext = {
  spice: Spice;
  fixturesRoot: string;
  windows: Map<string, SpiceWindow>;
};

/** Create per-case execution context for run-tspice dispatching. */
export function createRunTspiceContext(spice: Spice, fixturesRoot: string): RunTspiceContext {
  return {
    spice,
    fixturesRoot,
    windows: new Map<string, SpiceWindow>(),
  };
}

/** Clear loaded kernels and CSPICE error state before starting a case run. */
export function clearKernelState(context: RunTspiceContext): void {
  context.spice.raw.kclear();
  context.spice.raw.reset();
}

/** Return an existing window by ID, or create and track a new one. */
export function getOrCreateWindow(
  context: RunTspiceContext,
  windowId: string,
  maxIntervals: number,
): SpiceWindow {
  const existing = context.windows.get(windowId);
  if (existing != null) {
    return existing;
  }

  const created = context.spice.kit.newWindow(maxIntervals);
  context.windows.set(windowId, created);
  return created;
}

/** Require a previously created window by ID. */
export function requireWindow(context: RunTspiceContext, windowId: string): SpiceWindow {
  const window = context.windows.get(windowId);
  if (window == null) {
    throw new Error(`Window does not exist: ${windowId}`);
  }

  return window;
}

function freeWindows(context: RunTspiceContext): void {
  for (const window of context.windows.values()) {
    try {
      context.spice.kit.freeWindow(window);
    } catch {
      // best-effort cleanup only
    }
  }
}

function clearKernelStateBestEffort(context: RunTspiceContext): void {
  try {
    context.spice.raw.kclear();
  } catch {
    // best-effort cleanup only
  }
}

function clearErrorStateBestEffort(context: RunTspiceContext): void {
  try {
    context.spice.raw.reset();
  } catch {
    // best-effort cleanup only
  }
}

/** Run best-effort cleanup for windows, kernel state, and error state after a case run. */
export function cleanupContext(context: RunTspiceContext): void {
  freeWindows(context);
  clearKernelStateBestEffort(context);
  clearErrorStateBestEffort(context);
}
