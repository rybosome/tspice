# parity-checking

`@rybosome/tspice-parity-checking` is the canonical parity owner for this repo.
It owns:

- parity workflow + method specs,
- pre-execution guard pipeline,
- tspice/cspice parity runtime comparison,
- cross-cutting spec execution,
- generated parity catalogs.

## Layout

- `workflows/**` — reusable include workflows (`kind: workflow`)
- `specs/methods/**` — per-method parity specs (`kind: method`)
- `specs/cross-cutting/**` — executable cross-cutting specs (`kind: crossCuttingSpec`)
- `catalogs/contract-methods.json` — generated canonical contract methods
- `catalogs/alias-map.json` — generated alias -> canonical map
- `catalogs/parity-denylist.json` / `catalogs/parity-denylist.ts` — generated denylist

## Scripts

- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
- `pnpm -C packages/parity-checking test`

`test` runs the full guard pipeline before parity execution:

1. schema validity,
2. include graph validity,
3. completeness against generated contract catalog,
4. cross-cutting spec discovery/validation/execution,
5. centralized dispatch alias parity guard,
6. method parity execution (tspice vs cspice).
