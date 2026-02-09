/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type { Found, KernelData, KernelInfo, KernelKind, KernelSource } from "../shared/types.js";
import type { SpiceIntCell } from "./cells-windows.js";

export type KernelKindInput = KernelKind | readonly KernelKind[];

export interface KernelsApi {
  /**
   * Load a SPICE kernel.
   *
   * - If a string is provided, it is treated as a filesystem path.
   * - If bytes are provided, the backend may write them to a virtual filesystem
   *   at `path` before calling into SPICE.
   */
  furnsh(kernel: KernelSource): void;

  /**
   * Unload a SPICE kernel previously loaded via `furnsh()`.
   */
  unload(path: string): void;

  /** Clear all loaded kernels. */
  kclear(): void;

  /** Retrieve information about a currently loaded kernel by filename. */
  kinfo(path: string): Found<KernelInfo>;

  /**
   * Extract a substring from a word sequence.
   *
   * This is a string-parsing utility (used by some NAIF kernels and tooling).
   * It does **not** extract kernel bytes.
   */
  kxtrct(
    keywd: string,
    terms: readonly string[],
    wordsq: string,
  ): Found<{ wordsq: string; substr: string }>;

  /** Return kernel-pool frame IDs for the given frame class. */
  kplfrm(frmcls: number, idset: SpiceIntCell): void;

  /** Count loaded kernels of a given kind. */
  ktotal(kind?: KernelKindInput): number;

  /** Retrieve kernel metadata at position `which` for a given kind. */
  kdata(which: number, kind?: KernelKindInput): Found<KernelData>;
}
