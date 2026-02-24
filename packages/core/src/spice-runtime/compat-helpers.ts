import type {
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceIntCell,
  SpiceWindow,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";

/**
 * Non-1:1 helper APIs that were removed from `SpiceBackend` raw contract but
 * remain supported via higher-level tspice `kit` wrappers (strict/fast rollout).
 */
export interface CellsWindowsKitCompatApi {
  newIntCell(size: number): SpiceIntCell;
  newDoubleCell(size: number): SpiceDoubleCell;
  newCharCell(size: number, length: number): SpiceCharCell;
  newWindow(maxIntervals: number): SpiceWindow;
  freeCell(cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell): void;
  freeWindow(window: SpiceWindow): void;
  cellGeti(cell: SpiceIntCell, index: number): number;
  cellGetd(cell: SpiceDoubleCell, index: number): number;
  cellGetc(cell: SpiceCharCell, index: number): string;
}

export interface TimeKitCompatApi {
  spiceVersion(): string;
}

export interface FileIoKitCompatApi {
  readVirtualOutput(output: VirtualOutput): Uint8Array;
}

export type SpiceKitCompatHelpers =
  & CellsWindowsKitCompatApi
  & TimeKitCompatApi
  & FileIoKitCompatApi;
