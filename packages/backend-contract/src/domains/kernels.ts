/**
 * Contract conventions:
 * - Inputs are validated at the backend boundary. Shared runtime helpers
 *   (e.g. `normalizeKindInput`) are provided by `@rybosome/tspice-core`.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { KernelKindInput as CoreKernelKindInput } from "@rybosome/tspice-core";
import type {
  Found,
  KernelData,
  KernelInfo,
  KernelSource,
} from "../shared/types.js";
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
   *   at `path` before calling into SPICE. Each call adds a registration,
   *   including repeated loads of the same path. Meta-kernel child paths must
   *   already exist in the backend's filesystem.
   * - A failed load can leave earlier kernel-pool assignments/loads in place.
   *   Call `kclear()` when complete cleanup is required.
   *
   * @param kernel Filesystem path or bytes and a virtual identifier.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/furnsh_c.html
   */
  furnsh(kernel: KernelSource): void;

  /**
   * Unload one registration of a SPICE kernel previously loaded via `furnsh()`.
   * Unknown nonempty paths are harmless. Text-kernel unload can reread remaining
   * files; staged bytes are retained until `kclear()` on Node.
   * @param path Original filesystem path or byte-backed virtual identifier.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unload_c.html
   */
  unload(path: string): void;

  /**
   * Clear loaded kernels and kernel-pool variables; repeated calls are harmless.
   * Node also reclaims staged files. WASM files remain in its virtual filesystem.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/kclear_c.html
   */
  kclear(): void;

  /**
   * Retrieve a loaded kernel's type, meta-kernel source and numeric SPICE handle.
   * Empty/blank or unknown filenames return `{ found: false }`. Text/meta handles
   * are zero; binary handle numbers are backend-local metadata, not portable IDs.
   * @param path Original filesystem path or byte-backed virtual identifier.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/kinfo_c.html
   */
  kinfo(path: string): Found<KernelInfo>;

  /**
   * Extract a substring from a word sequence.
   *
   * This is a string-parsing utility (used by some NAIF kernels and tooling).
   * It does **not** extract kernel bytes. Only ASCII spaces delimit words;
   * significant tabs/newlines/non-ASCII whitespace survive in returned strings.
   * Inputs use C-string prefixes before NUL. Keyword and terminator arguments
   * are trimmed of ASCII whitespace; empty terminators are ignored.
   * @param keywd Nonempty keyword, matched case-sensitively as a whole word.
   * @param terms Terminator words; an empty list extracts through the end.
   * @param wordsq Input sequence, limited to fewer than 1 MiB of UTF-8 bytes.
   * @returns A miss or the remaining sequence and extracted substring.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/kxtrct_c.html
   */
  kxtrct(
    keywd: string,
    terms: readonly string[],
    wordsq: string,
  ): Found<{ wordsq: string; substr: string }>;

  /**
   * Replace `idset` with kernel-pool frame IDs of the requested class.
   *
   * `frmcls = -1` selects all kernel-pool classes; class 1 yields an empty set.
   * The caller owns the integer cell; insufficient capacity or an invalid class throws.
   * Non-integral or overflowing signed 32-bit class values are rejected before CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/kplfrm_c.html
   */
  kplfrm(frmcls: number, idset: SpiceIntCell): void;

  /**
   * Count loaded registrations selected by kind (default `ALL`).
   * @param kind Case-insensitive selector(s), including filename-inferred text subtypes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ktotal_c.html
   */
  ktotal(kind?: KernelKindInput): number;

  /**
   * Retrieve type, file, meta-kernel source and numeric handle at a filtered index.
   * @param which Zero-based signed 32-bit integer; negative/out-of-range indices miss.
   * @param kind Selector(s), default `ALL`; ordering follows CSPICE's loaded table.
   * @returns A miss or metadata, including backend-local handle zero for text/meta.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/kdata_c.html
   */
  kdata(which: number, kind?: KernelKindInput): Found<KernelData>;
}
