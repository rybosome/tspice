import type {
  DlaDescriptor,
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceHandle,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import type { Spice } from "@rybosome/tspice";

import type { RuntimePaths } from "./path-ref.js";

export type CellsWindowsState = {
  intCells: Map<string, SpiceIntCell>;
  doubleCells: Map<string, SpiceDoubleCell>;
  charCells: Map<string, SpiceCharCell>;
  windows: Map<string, SpiceWindow>;
};

export type KernelsState = {
  loadedVirtualKernelPaths: string[];
};

export type FileIoHandleState = {
  handle: SpiceHandle;
  closeWith: "dafcls" | "dascls";
  isOpen: boolean;
};

export type FileIoState = {
  handles: Map<string, FileIoHandleState>;
  descriptors: Map<string, DlaDescriptor>;
  spatialIndexes: Map<string, { spaixd: number[]; spaixi: number[] }>;
};

export type DskState = {
  loadedSegments: number;
  handles: Map<string, { handle: SpiceHandle; isOpen: boolean }>;
  dlaDescriptors: Map<string, DlaDescriptor>;
  spatialIndexes: Map<string, { spaixd: number[]; spaixi: number[] }>;
  resolvedPathRefs: Map<string, string>;
  cleanupRegistered: boolean;
};

export type EkState = {
  lastQuery: string | null;
  handles: Map<string, SpiceHandle>;
  segments: Map<string, EkSegmentState>;
};

export type EkSegmentState = {
  handleId: string;
  segno: number;
  rcptrs: number[];
};

export type EphemerisState = {
  requestedTargets: Set<number>;
  intCells: Map<string, SpiceIntCell>;
  spkHandles: Map<string, SpiceHandle>;
};

export type FramesState = {
  requestedFrames: Set<string>;
  stagedVirtualKernelPaths: Set<string>;
  ckHandles: Map<string, number>;
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
        intCells: new Map<string, SpiceIntCell>(),
        doubleCells: new Map<string, SpiceDoubleCell>(),
        charCells: new Map<string, SpiceCharCell>(),
        windows: new Map<string, SpiceWindow>(),
      },
      kernels: {
        loadedVirtualKernelPaths: [],
      },
      fileIo: {
        handles: new Map<string, FileIoHandleState>(),
        descriptors: new Map<string, DlaDescriptor>(),
        spatialIndexes: new Map<string, { spaixd: number[]; spaixi: number[] }>(),
      },
      dsk: {
        loadedSegments: 0,
        handles: new Map<string, { handle: SpiceHandle; isOpen: boolean }>(),
        dlaDescriptors: new Map<string, DlaDescriptor>(),
        spatialIndexes: new Map<string, { spaixd: number[]; spaixi: number[] }>(),
        resolvedPathRefs: new Map<string, string>(),
        cleanupRegistered: false,
      },
      ek: {
        lastQuery: null,
        handles: new Map<string, SpiceHandle>(),
        segments: new Map<string, EkSegmentState>(),
      },
      ephemeris: {
        requestedTargets: new Set<number>(),
        intCells: new Map<string, SpiceIntCell>(),
        spkHandles: new Map<string, SpiceHandle>(),
      },
      frames: {
        requestedFrames: new Set<string>(),
        stagedVirtualKernelPaths: new Set<string>(),
        ckHandles: new Map<string, number>(),
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

/** Return an existing int cell by ID, or create+track a new one in the cellsWindows slice. */
export function getOrCreateIntCell(
  context: RunTspiceContext,
  cellId: string,
  maxCardinality: number,
): SpiceIntCell {
  const existing = context.state.cellsWindows.intCells.get(cellId);
  if (existing != null) {
    return existing;
  }

  const created = context.spice.kit.newIntCell(maxCardinality);
  context.state.cellsWindows.intCells.set(cellId, created);
  registerFinalizer(context, `cellsWindows.freeIntCell:${cellId}`, () => {
    try {
      context.spice.kit.freeCell(created);
    } catch {
      // best-effort cleanup only
    }
  });
  return created;
}

/** Require a previously created int cell by ID. */
export function requireIntCell(context: RunTspiceContext, cellId: string): SpiceIntCell {
  const cell = context.state.cellsWindows.intCells.get(cellId);
  if (cell == null) {
    throw new Error(`Int cell does not exist: ${cellId}`);
  }
  return cell;
}

/** Return an existing double cell by ID, or create+track a new one in the cellsWindows slice. */
export function getOrCreateDoubleCell(
  context: RunTspiceContext,
  cellId: string,
  maxCardinality: number,
): SpiceDoubleCell {
  const existing = context.state.cellsWindows.doubleCells.get(cellId);
  if (existing != null) {
    return existing;
  }

  const created = context.spice.kit.newDoubleCell(maxCardinality);
  context.state.cellsWindows.doubleCells.set(cellId, created);
  registerFinalizer(context, `cellsWindows.freeDoubleCell:${cellId}`, () => {
    try {
      context.spice.kit.freeCell(created);
    } catch {
      // best-effort cleanup only
    }
  });
  return created;
}

/** Require a previously created double cell by ID. */
export function requireDoubleCell(context: RunTspiceContext, cellId: string): SpiceDoubleCell {
  const cell = context.state.cellsWindows.doubleCells.get(cellId);
  if (cell == null) {
    throw new Error(`Double cell does not exist: ${cellId}`);
  }
  return cell;
}

/** Return an existing char cell by ID, or create+track a new one in the cellsWindows slice. */
export function getOrCreateCharCell(
  context: RunTspiceContext,
  cellId: string,
  maxCardinality: number,
  length: number,
): SpiceCharCell {
  const existing = context.state.cellsWindows.charCells.get(cellId);
  if (existing != null) {
    return existing;
  }

  const created = context.spice.kit.newCharCell(maxCardinality, length);
  context.state.cellsWindows.charCells.set(cellId, created);
  registerFinalizer(context, `cellsWindows.freeCharCell:${cellId}`, () => {
    try {
      context.spice.kit.freeCell(created);
    } catch {
      // best-effort cleanup only
    }
  });
  return created;
}

/** Require a previously created char cell by ID. */
export function requireCharCell(context: RunTspiceContext, cellId: string): SpiceCharCell {
  const cell = context.state.cellsWindows.charCells.get(cellId);
  if (cell == null) {
    throw new Error(`Char cell does not exist: ${cellId}`);
  }
  return cell;
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

/** Return an existing int cell by ID, or create+track a new one in the ephemeris slice. */
export function getOrCreateEphemerisIntCell(
  context: RunTspiceContext,
  cellId: string,
  maxCardinality: number,
): SpiceIntCell {
  const existing = context.state.ephemeris.intCells.get(cellId);
  if (existing != null) {
    return existing;
  }

  const created = context.spice.kit.newIntCell(maxCardinality);
  context.state.ephemeris.intCells.set(cellId, created);
  registerFinalizer(context, `ephemeris.freeCell:${cellId}`, () => {
    try {
      context.spice.kit.freeCell(created);
    } catch {
      // best-effort cleanup only
    }
  });
  return created;
}

/** Require a previously created int cell by ID in the ephemeris slice. */
export function requireEphemerisIntCell(context: RunTspiceContext, cellId: string): SpiceIntCell {
  const cell = context.state.ephemeris.intCells.get(cellId);
  if (cell == null) {
    throw new Error(`Int cell does not exist: ${cellId}`);
  }
  return cell;
}

function closeSpkHandleBestEffort(context: RunTspiceContext, handle: SpiceHandle): void {
  try {
    context.spice.raw.spkcls(handle);
  } catch {
    // best-effort cleanup only
  }
}

/** Register an SPK handle under a logical ID for subsequent ephemeris workflow steps. */
export function setSpkHandle(context: RunTspiceContext, handleId: string, handle: SpiceHandle): void {
  const existing = context.state.ephemeris.spkHandles.get(handleId);
  if (existing != null) {
    closeSpkHandleBestEffort(context, existing);
  }

  context.state.ephemeris.spkHandles.set(handleId, handle);
  registerFinalizer(context, `ephemeris.spkcls:${handleId}:${String(handle)}`, () => {
    const current = context.state.ephemeris.spkHandles.get(handleId);
    if (current == null || current !== handle) {
      return;
    }

    closeSpkHandleBestEffort(context, handle);
    context.state.ephemeris.spkHandles.delete(handleId);
  });
}

/** Require a previously registered SPK handle by ID. */
export function requireSpkHandle(context: RunTspiceContext, handleId: string): SpiceHandle {
  const handle = context.state.ephemeris.spkHandles.get(handleId);
  if (handle == null) {
    throw new Error(`SPK handle does not exist: ${handleId}`);
  }
  return handle;
}

/** Remove a previously registered SPK handle ID. */
export function deleteSpkHandle(context: RunTspiceContext, handleId: string): void {
  context.state.ephemeris.spkHandles.delete(handleId);
}
