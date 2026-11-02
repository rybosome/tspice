# @rybosome/tspice-py-parity-checking

A fixed-case parity package that compares `@rybosome/tspice` behavior against a **live SpiceyPy oracle**.

## Why this package exists

- This is a fresh implementation under `packages/py-parity-checking`.
- It is intentionally independent from the legacy v3 YAML/spec pipeline.
- Oracle truth comes from live Python sidecar execution (SpiceyPy), not from baked expected corpora.

## Architecture (v1)

- **TypeScript runner**: executes fixed workflow cases against `@rybosome/tspice` (WASM backend in tests).
- **Python sidecar**: executes the same workflow against SpiceyPy.
- **Parity assertions**:
  - Success path: strict equality on normalized outputs.
  - Error path: minimal matching (error/no-error + lightweight class/message checks).

Each case is isolated by `kclear()` before and after execution on both sides.

## Fixtures

- Scientific input kernels are checked in under `fixtures/kernels` and copied here for package isolation.
- Cases that exercise file-creation routines write scratch kernels under `fixtures/kernels/generated/`; this ignored directory is recreated as needed by the tests.
- Includes a checked-in EK fixture for fixed `ekfind`/`ekgc` workflows.

## Local commands

The test command provisions the locked Python environment and imports SpiceyPy before Vitest starts. Downloads and environment setup therefore happen outside each parity case's timeout. To prepare the sidecar separately, run `pnpm -C packages/py-parity-checking setup:sidecar`.

```bash
pnpm -C packages/py-parity-checking typecheck
pnpm -C packages/py-parity-checking test
```
