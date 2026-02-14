/**
 * Small error utilities shared by Node backend domain modules.
 *
 * Today the native addon already throws rich JS errors, so this module is
 * intentionally minimal; it exists primarily as a stable home for any future
 * normalization logic.
 */
export function formatNativeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
