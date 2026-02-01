# @rybosome/tspice-core

## Overview

Small, shared utilities used across the `tspice` packages.

## Purpose / Why this exists

This repo is organized as a monorepo with several small packages. `@rybosome/tspice-core` exists to hold low-level helpers that:

- are useful across multiple packages
- are intentionally tiny and dependency-free

## How it fits into `tspice`

- Used by the `@rybosome/tspice` facade (exhaustive backend selection via `assertNever`).
- Used by `@rybosome/tspice-backend-node` to validate runtime values coming from the native addon (`invariant`).

## Installation

You typically don’t install this package directly. It is a workspace-internal dependency of other packages.

## Usage (Quickstart)

### `invariant()`

`invariant(condition, message)` throws an `InvariantError` if the condition is falsy. It is typed as an assertion, so TypeScript narrows when it passes.

```ts
import { invariant } from "@rybosome/tspice-core";

const value: unknown = "hello";
invariant(typeof value === "string", "Expected value to be a string");

value.toUpperCase();
```

### `InvariantError`

```ts
import { InvariantError, invariant } from "@rybosome/tspice-core";

try {
  invariant(false, "Nope");
} catch (error) {
  if (error instanceof InvariantError) {
    console.error(error.message);
  }
}
```

### `assertNever()`

`assertNever(value, message)` is for exhaustiveness checking in `switch` statements.

```ts
import { assertNever } from "@rybosome/tspice-core";

type Kind = "a" | "b";

export function toNumber(kind: Kind): number {
  switch (kind) {
    case "a":
      return 1;
    case "b":
      return 2;
    default:
      return assertNever(kind, "Unexpected kind");
  }
}
```

When you add a new member to `Kind`, TypeScript will report an error at the `assertNever(kind, ...)` call until you handle the new case, enforcing exhaustiveness.

## API surface

- `InvariantError extends Error`
- `invariant(condition: unknown, message?: string): asserts condition`
- `assertNever(value: never, message?: string): never`

## Development

```bash
pnpm --filter @rybosome/tspice-core run build
pnpm --filter @rybosome/tspice-core run typecheck
pnpm --filter @rybosome/tspice-core run test
```

## Versioning

This package is under active development and may change as shared patterns settle.
