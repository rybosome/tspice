export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

export function invariant(condition: unknown, message = "Invariant violation"): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}
