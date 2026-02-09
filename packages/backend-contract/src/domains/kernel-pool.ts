/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type { Found } from "../shared/types.js";

export type KernelPoolVarType = "C" | "N";

export interface KernelPoolApi {
  // --- Read ---------------------------------------------------------------

  /**
   * Get numeric (double) kernel pool values.
   *
   * `start` is 0-based.
   */
  gdpool(name: string, start: number, room: number): Found<{ values: number[] }>;

  /**
   * Get numeric (integer) kernel pool values.
   *
   * `start` is 0-based.
   */
  gipool(name: string, start: number, room: number): Found<{ values: number[] }>;

  /**
   * Get character kernel pool values.
   *
   * `start` is 0-based.
   */
  gcpool(name: string, start: number, room: number): Found<{ values: string[] }>;

  /**
   * Get the names of kernel pool variables matching a template.
   *
   * Wildcards:
   * - `*` matches any substring
   * - `%` matches any single character
   *
   * `start` is 0-based.
   */
  gnpool(template: string, start: number, room: number): Found<{ values: string[] }>;

  /**
   * Get kernel pool variable type (`C` or `N`) and size.
   */
  dtpool(name: string): Found<{ n: number; type: KernelPoolVarType }>;

  // --- Write --------------------------------------------------------------

  /** Put numeric (double) values into the kernel pool. */
  pdpool(name: string, values: readonly number[]): void;

  /** Put numeric (integer) values into the kernel pool. */
  pipool(name: string, values: readonly number[]): void;

  /** Put character values into the kernel pool. */
  pcpool(name: string, values: readonly string[]): void;

  // --- Control ------------------------------------------------------------

  /**
   * Set up a kernel pool "watch" for `agent`.
   *
   * After calling `swpool`, the next `cvpool(agent)` call will return `true`.
   */
  swpool(agent: string, names: readonly string[]): void;

  /**
   * Check whether watched variables for `agent` have been updated since the last call.
   */
  cvpool(agent: string): boolean;

  /**
   * Check existence of a *numeric* kernel pool variable.
   *
   * NOTE: This does not detect character-valued variables; use `dtpool` if you need a
   * general existence/type check.
   */
  expool(name: string): boolean;
}
