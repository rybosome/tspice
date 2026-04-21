import type { CaseError } from "../../case-types.js";

/** Normalize unknown thrown values into the parity case error shape. */
export function normalizeError(error: unknown): CaseError {
  if (error instanceof Error) {
    return { type: error.name, message: error.message };
  }

  return { type: typeof error, message: String(error) };
}
