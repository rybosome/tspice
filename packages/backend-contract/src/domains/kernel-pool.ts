/**
* Kernel pool API contract.
*
* Contract conventions:
* - Backends MUST validate inputs as described below and throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*
* Terminology used in validation semantics:
* - "not empty or whitespace-only" means `value.trim().length > 0`.
* - "finite integer" means `Number.isFinite(value) && Number.isInteger(value)`.
*
* Empty arrays:
* - `pdpool`/`pipool`/`pcpool` accept `values: []` and set the variable to an empty list (size 0).
* - `swpool` accepts `names: []` and watches nothing (but still arms the agent so the next
*   `cvpool(agent)` returns `true`).
*/
import type { Found } from "../shared/types.js";

export type KernelPoolVarType = "C" | "N";

export interface KernelPoolApi {
  // --- Read ---------------------------------------------------------------

  /**
   * Get numeric (double) kernel pool values.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `start` must be a finite integer >= 0 (0-based).
   * - `room` must be a finite integer > 0.
   */
  gdpool(name: string, start: number, room: number): Found<{ values: number[] }>;

  /**
   * Get numeric (integer) kernel pool values.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `start` must be a finite integer >= 0 (0-based).
   * - `room` must be a finite integer > 0.
   */
  gipool(name: string, start: number, room: number): Found<{ values: number[] }>;

  /**
   * Get character kernel pool values.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `start` must be a finite integer >= 0 (0-based).
   * - `room` must be a finite integer > 0.
   */
  gcpool(name: string, start: number, room: number): Found<{ values: string[] }>;

  /**
   * Get the names of kernel pool variables matching a template.
   *
   * Wildcards:
   * - `*` matches any substring
   * - `%` matches any single character
   *
   * Validation semantics:
   * - `template` must not be empty or whitespace-only.
   * - `start` must be a finite integer >= 0 (0-based).
   * - `room` must be a finite integer > 0.
   */
  gnpool(template: string, start: number, room: number): Found<{ values: string[] }>;

  /**
   * Get kernel pool variable type (`C` or `N`) and size.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   */
  dtpool(name: string): Found<{ n: number; type: KernelPoolVarType }>;

  // --- Write --------------------------------------------------------------

  /**
   * Put numeric (double) values into the kernel pool.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `values` may be empty (sets an empty value list).
   * - Each value must be finite (no `NaN` / `±Infinity`).
   */
  pdpool(name: string, values: readonly number[]): void;

  /**
   * Put numeric (integer) values into the kernel pool.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `values` may be empty (sets an empty value list).
   * - Each value must be a safe integer in the signed 32-bit range
   *   [-2147483648, 2147483647].
   */
  pipool(name: string, values: readonly number[]): void;

  /**
   * Put character values into the kernel pool.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `values` may be empty (sets an empty value list).
   */
  pcpool(name: string, values: readonly string[]): void;

  // --- Control ------------------------------------------------------------

  /**
   * Set up a kernel pool "watch" for `agent`.
   *
   * After calling `swpool`, the next `cvpool(agent)` call will return `true`.
   *
   * Validation semantics:
   * - `agent` must not be empty or whitespace-only.
   * - `names` may be empty (watch nothing).
   */
  swpool(agent: string, names: readonly string[]): void;

  /**
   * Check whether watched variables for `agent` have been updated since the last call.
   *
   * Validation semantics:
   * - `agent` must not be empty or whitespace-only.
   */
  cvpool(agent: string): boolean;

  /**
   * Check existence of a *numeric* kernel pool variable.
   *
   * NOTE: This does not detect character-valued variables; use `dtpool` if you need a
   * general existence/type check.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   */
  expool(name: string): boolean;
}
