/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type { Found, KernelData, KernelKind, KernelSource } from "../shared/types.js";

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

  /** Count loaded kernels of a given kind. */
  ktotal(kind?: KernelKind): number;

  /** Retrieve kernel metadata at position `which` for a given kind. */
  kdata(which: number, kind?: KernelKind): Found<KernelData>;
}
