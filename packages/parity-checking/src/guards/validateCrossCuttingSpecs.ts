import type { CrossCuttingSpec } from "../dsl/types.js";

export function validateCrossCuttingSpecs(specs: CrossCuttingSpec[]): void {
  if (specs.length === 0) {
    throw new Error(
      "No cross-cutting specs discovered under specs/cross-cutting/**. At least one executable spec is required.",
    );
  }
}
