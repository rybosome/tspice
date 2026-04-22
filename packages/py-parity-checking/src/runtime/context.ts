import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import type { Spice } from "@rybosome/tspice";

import type { RuntimePaths } from "./path-ref.js";

export type CellsWindowsState = {
  windows: Map<string, SpiceWindow>;
};

export type KernelsState = {
  loadedVirtualKernelPaths: string[];
};

export type FileIoState = {
  openHandles: Map<string, string>;
};

export type DskState = {
  loadedSegments: number;
};

export type EkState = {
  lastQuery: string | null;
};

export type EphemerisState = {
  requestedTargets: Set<number>;
};

export type FramesState = {
  requestedFrames: Set<string>;
};

export type RunTspiceState = {
  cellsWindows: CellsWindowsState;
  kernels: KernelsState;
  fileIo: FileIoState;
  dsk: DskState;
  ek: EkState;
  ephemeris: EphemerisState;
  frames: FramesState;
};

export type RuntimeFinalizer = {
  label: string;
  run: () => void;
};

export type RunTspiceContext = {
  spice: Spice;
  paths: RuntimePaths;
  state: RunTspiceState;
  lifecycle: {
    finalizers: RuntimeFinalizer[];
    scratchCleanupRegistered: boolean;
  };
};

/** Create per-case execution context with mirrored domain state slices. */
export function createRunTspiceContext(spice: Spice, paths: RuntimePaths): RunTspiceContext {
  return {
    spice,
    paths,
    state: {
      cellsWindows: {
        windows: new Map<string, SpiceWindow>(),
      },
      kernels: {
        loadedVirtualKernelPaths: [],
      },
      fileIo: {
        openHandles: new Map<string, string>(),
      },
      dsk: {
        loadedSegments: 0,
      },
      ek: {
        lastQuery: null,
      },
      ephemeris: {
        requestedTargets: new Set<number>(),
      },
      frames: {
        requestedFrames: new Set<string>(),
      },
    },
    lifecycle: {
      finalizers: [],
      scratchCleanupRegistered: false,
    },
  };
}

/** Register case finalizers in deterministic order. */
export function registerFinalizer(
  context: RunTspiceContext,
  label: string,
  run: () => void,
): void {
  context.lifecycle.finalizers.push({ label, run });
}

/** Run all finalizers best-effort in stable registration order. */
export function runFinalizersBestEffort(context: RunTspiceContext): void {
  for (const finalizer of context.lifecycle.finalizers) {
    try {
      finalizer.run();
    } catch {
      // best-effort cleanup only
    }
  }
}

/** Return an existing window by ID, or create+track a new one in the cellsWindows slice. */
export function getOrCreateWindow(
  context: RunTspiceContext,
  windowId: string,
  maxIntervals: number,
): SpiceWindow {
  const existing = context.state.cellsWindows.windows.get(windowId);
  if (existing != null) {
    return existing;
  }

  const created = context.spice.kit.newWindow(maxIntervals);
  context.state.cellsWindows.windows.set(windowId, created);
  registerFinalizer(context, `cellsWindows.freeWindow:${windowId}`, () => {
    try {
      context.spice.kit.freeWindow(created);
    } catch {
      // best-effort cleanup only
    }
  });
  return created;
}

/** Require a previously created window by ID. */
export function requireWindow(context: RunTspiceContext, windowId: string): SpiceWindow {
  const window = context.state.cellsWindows.windows.get(windowId);
  if (window == null) {
    throw new Error(`Window does not exist: ${windowId}`);
  }
  return window;
}
