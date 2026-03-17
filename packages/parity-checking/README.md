# parity-checking

`@rybosome/tspice-parity-checking` is the canonical parity owner for this repo.

It owns:

- parity method specs,
- pre-execution guard pipeline,
- tspice/cspice parity runtime comparison,
- generated parity catalogs and generated dispatch artifacts.

## Layout

- `specs/methods/**` — parity method specs (`schemaVersion: 3`, `manifest.kind: method`)
- `specs/function-registry/function-registry.yaml` — canonical function-registry source
- `catalogs/contract-methods.json` — generated canonical contract surface inventory
- `catalogs/function-registry.json` — generated dispatch metadata catalog
- `catalogs/parity-denylist.json` — generated denylist (v3 baseline remains empty)
- `src/runners/generatedDispatchTable.generated.ts` — generated TS dispatch table
- `native/src/cspice_runner_generated_dispatch_table.{h,c}` — generated native dispatch table

Catalogs are JSON-only; there is no generated TypeScript denylist catalog.

## Function-registry DSL

See: `docs/parity/function-registry-dsl.md`.

Core rules:

- strict key validation,
- ordered `input` argument arrays,
- canonical function object field order: `input`, then `output`, then `buffers`,
- deterministic generation and stable sort by function key,
- parity-coverage lock against the harness method source (`specs/methods/**`).

## Canonical generated-dispatch seam contract

Canonical workflow execution always hands off through generated dispatch artifacts.

- TS: `src/runners/generatedDispatchSeam.ts` + `src/runners/generatedDispatchTable.generated.ts`
- native: `native/src/cspice_runner_generated_dispatch_seam.{h,c}` + generated table files

When a function is unsupported or unmodeled, execution must fail closed with normalized boundary fields:

- `code: generated_dispatch_unavailable`
- `reason: generated-dispatch-unavailable`
- proof markers in `details`:
  - `dispatchHandoffAttempted: true`
  - `fallbackUsed: false`
  - `stopPoint`

## Scripts

- `pnpm -C packages/parity-checking generate:contract-catalog`
- `pnpm -C packages/parity-checking generate:function-registry`
- `pnpm -C packages/parity-checking generate:denylist`
- `pnpm -C packages/parity-checking generate:dispatch-artifacts`
- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
- `pnpm -C packages/parity-checking test`

`check:generated` regenerates catalogs/artifacts and fails if tracked generated files drift.

`test` runs the full guard pipeline before parity execution:

1. schema validity,
2. completeness against baseline coverage expectations,
3. parity execution and generated-dispatch seam boundary checks.
