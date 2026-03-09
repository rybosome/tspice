# parity-checking

`@rybosome/tspice-parity-checking` is the canonical parity owner for this repo.
It owns:

- parity workflow + method specs,
- pre-execution guard pipeline,
- tspice/cspice parity runtime comparison,
- generated parity catalogs.

## Layout

- `specs/methods/**` — per-method parity specs (`schemaVersion: 3`, `manifest.kind: method`)
- `catalogs/contract-methods.json` — generated canonical contract methods
- `catalogs/parity-denylist.json` / `catalogs/parity-denylist.ts` — generated denylist (v3 baseline is empty)

## Method DSL (v3)

Method specs are v3-only. v1/v2 documents are no longer accepted.

Top-level shape:

- exactly one of:
  - singular `workflow` + `cases`, or
  - `suites[]` (each suite carries its own `workflow` + `cases`)
- shared `contract` block
- optional `setup` / `defaults.compare`

Workflow highlights:

- `callContract` for direct contract-method invocation from case args
- `spiceCall`, `project`, `projectResult`, `assert`, `switch`, etc. for explicit declarative flows
- `withResource` is first-class for lifecycle scoping
  - low-level lifecycle steps (`dasOpen`, `dlaBeginForwardSearch`, `dasClose`, `unlink`) are rejected when authored directly outside `withResource`
- `script` implies TypeScript (no `language` field). Script validation rejects module imports and direct network/fs access patterns.

## Scripts

- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
- `pnpm -C packages/parity-checking test`

`test` runs the full guard pipeline before parity execution:

1. schema validity,
2. completeness against v3 baseline coverage expectations,
3. method parity execution (tspice vs cspice).
