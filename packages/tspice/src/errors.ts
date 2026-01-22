export class SpiceError extends Error {
  readonly operation: string;

  constructor(operation: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SpiceError";
    this.operation = operation;
  }
}

export function wrapSpiceError(operation: string, error: unknown): SpiceError {
  if (error instanceof SpiceError) {
    return error;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return new SpiceError(operation, `${operation} failed: ${msg}`, { cause: error });
}
