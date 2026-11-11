# @rybosome/tspice-py-parity-checking

A fixed-case parity package that compares `@rybosome/tspice` behavior against a **live SpiceyPy oracle**.

## Why this package exists

- The fixed JSON case registry is the maintained source of parity scenarios.
- Oracle truth comes from live Python sidecar execution (SpiceyPy), not from baked expected corpora.

## Architecture

- **TypeScript runner**: executes registered workflows against WASM and, when the native backend is available, Node. Each backend result is compared with the live sidecar result.
- **Python sidecar**: executes the same workflow against SpiceyPy.
- **Parity assertions**:
  - Success path: recursive equality on normalized outputs, with absolute or relative numeric tolerance of `1e-12`.
  - Error path: minimal matching (error/no-error + lightweight class/message checks).

Case runners clear kernel state and reset SPICE errors before each workflow, then attempt resource cleanup and another clear/reset afterward. Case registration establishes executable scenarios; it does not establish that every routine and backend has meaningful success, edge, and error coverage.

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
