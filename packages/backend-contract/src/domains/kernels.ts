/**
 * Contract conventions:
 * - Inputs are validated at the backend boundary. Shared runtime helpers
 *   (e.g. `normalizeKindInput`) are provided by `@rybosome/tspice-core`.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { KernelKindInput as CoreKernelKindInput } from "@rybosome/tspice-core";
import type { Found, KernelData, KernelInfo, KernelSource } from "../shared/types.js";
import type { SpiceIntCell } from "./cells-windows.js";

/**
 * Kernel kind selector used by `ktotal()` / `kdata()`.
 *
 * Supports:
 * - a single `KernelKind`
 * - an array of `KernelKind` (treated as an OR query)
 * - a CSPICE-style multi-kind string (whitespace-separated, e.g. `"SPK CK"`)
 *
 * Tokens are validated case-insensitively and normalized to canonical uppercase.
 * Unknown/empty tokens throw `RangeError`.
 * An empty array (`[]`) is invalid and throws `RangeError`.
 */
export type KernelKindInput = CoreKernelKindInput;

/** Backend contract for kernel management and kernel metadata queries. */
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

  /**
   * Retrieve information about a currently loaded kernel by filename.
   * Mapping: non-direct/composite; native backend uses `kinfo_c`, WASM
   * synthesizes from loaded-kernel metadata.
   */
  kinfo(path: string): Found<KernelInfo>;

  /**
   * Extract a substring from a word sequence.
   *
   * Mapping: non-direct/composite; native backend uses `kxtrct_c`, WASM uses
   * the JS `kxtrctJs` fallback.
   *
   * This is a string-parsing utility (used by some NAIF kernels and tooling).
   * It does **not** extract kernel bytes.
   */
  kxtrct(
    keywd: string,
    terms: readonly string[],
    wordsq: string,
  ): Found<{ wordsq: string; substr: string }>;

  /**
   * Return kernel-pool frame IDs for the given frame class.
   * Mapping: direct CSPICE (`kplfrm_c`).
   * Backend caveat: current WASM bundle does not support this method.
   */
  kplfrm(frmcls: number, idset: SpiceIntCell): void;

  /** Count loaded kernels of a given kind. */
  ktotal(kind?: KernelKindInput): number;

  /** Retrieve kernel metadata at position `which` for a given kind. */
  kdata(which: number, kind?: KernelKindInput): Found<KernelData>;
}
