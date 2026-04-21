# @rybosome/tspice-py-parity-checking

A fixed-case parity package that compares `@rybosome/tspice` behavior against a **live SpiceyPy oracle**.

## Why this package exists

- This is a fresh implementation under `packages/py-parity-checking`.
- It is intentionally independent from `packages/parity-checking` and its v3 YAML/spec pipeline.
- Oracle truth comes from live Python sidecar execution (SpiceyPy), not from baked expected corpora.

## Architecture (v1)

- **TypeScript runner**: executes fixed workflow cases against `@rybosome/tspice` (WASM backend in tests).
- **Python sidecar**: executes the same workflow against SpiceyPy.
- **Parity assertions**:
  - Success path: strict equality on normalized outputs.
  - Error path: minimal matching (error/no-error + lightweight class/message checks).

Each case is isolated by `kclear()` before and after execution on both sides.

## Fixtures

- Uses checked-in fixtures only.
- Required kernel fixtures are copied into this package under `fixtures/kernels`.
- Includes a checked-in EK fixture for fixed `ekfind`/`ekgc` workflows.

## Local commands

```bash
pnpm -C packages/py-parity-checking typecheck
pnpm -C packages/py-parity-checking test
```
