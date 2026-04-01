# parity-checking

`@rybosome/tspice-parity-checking` is the canonical parity owner for this repo.
It owns:

- parity method specs,
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

- canonical call-step shape is `{ op: "call", fn, in }` only.
- call-step `fn` and `in` support top-level string-token references for `$args` and `$args.<path>`.
- `$refs` / `$refs.<path>` are rejected in canonical call-step execution.
- reference substitution is not recursive for object/array payloads in `in`; only top-level call-step strings are resolved.

## Scripts

- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
- `pnpm -C packages/parity-checking test`

`test` runs the full guard pipeline before parity execution:

1. schema validity,
2. completeness against v3 baseline coverage expectations,
3. method parity execution (tspice vs cspice).
