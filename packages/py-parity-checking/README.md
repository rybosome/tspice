# @rybosome/tspice-py-parity-checking

A fixed-case parity package that compares `@rybosome/tspice` behavior against a **live SpiceyPy oracle**.

## Why this package exists

- This implementation lives under `packages/py-parity-checking`.
- Oracle truth comes from live Python sidecar execution (SpiceyPy), not from baked expected outputs.
- The corpus is deterministic and generated from canonical `SpiceRawBackend` method keys.

## Coverage model

- Canonical raw method keys are generated into `src/generated/canonical-raw-methods.ts`.
- Case corpus is generated into `src/cases/canonical-auto.cases.json`.
- One deterministic baseline case is created per canonical raw method key:
  - `requiredParams === 0` → no-args **success** expectation.
  - `requiredParams > 0` → no-args **error** expectation.

This guarantees no key-gap drift between canonical raw methods and py-parity case coverage.

## Architecture

- **TypeScript lane**: generic dispatcher calls `spice.raw[method](...args)`.
- **Python lane**: generic dispatcher calls `spiceypy.<method>(*args)`.
- **Parity assertions**:
  - Success path: strict equality on normalized outputs.
  - Error path: minimal matching (error/no-error + optional class/message fragments).

Each case is isolated by `reset()` + `kclear()` before and after execution on both lanes.

## Regeneration / validation

Regenerate canonical method metadata + case corpus:

```bash
pnpm -C packages/py-parity-checking generate:cases
```

Run package checks:

```bash
pnpm -C packages/py-parity-checking typecheck
pnpm -C packages/py-parity-checking test
```
