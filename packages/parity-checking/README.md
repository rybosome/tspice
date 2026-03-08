# parity-checking

`@rybosome/tspice-parity-checking` is the canonical parity owner for this repo.
It owns:

- parity workflow + method specs,
- pre-execution guard pipeline,
- tspice/cspice parity runtime comparison,
- cross-cutting spec execution,
- generated parity catalogs + method-surface registry artifacts.

## Layout

- `specs/methods/**` — per-method parity specs (`schemaVersion: 3`, `manifest.kind: method`)
- `specs/cross-cutting/**` — executable cross-cutting specs (`schemaVersion: 3`, `manifest.kind: crossCuttingSpec`)
- `catalogs/contract-methods.json` — generated canonical contract methods
- `catalogs/parity-denylist.json` / `catalogs/parity-denylist.ts` — generated denylist (v3 baseline is empty)
- `registry/method-surface.yml` — canonical YAML registry for v3 method-surface coverage
- `catalogs/method-surface.json` / `src/generated/methodSurfaceRegistry.ts` — generated artifacts from the YAML method-surface registry

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

- `pnpm run preflight:parity:native`
- `pnpm -C packages/parity-checking sync:method-surface`
- `pnpm -C packages/parity-checking check:method-surface-sync`
- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
- `pnpm -C packages/parity-checking test`

### Native parity preflight (linux-arm64 devbox)

Run this before native parity-checking work:

```bash
pnpm run preflight:parity:native
```

Or package-local:

```bash
pnpm -C packages/parity-checking run preflight:native
```

This command fails fast unless all required native prerequisites are present:

- `nix` is available on `PATH`
- `TSPICE_CSPICE_DIR` is set
- `$TSPICE_CSPICE_DIR` contains the expected CSPICE layout:
  - `include/SpiceUsr.h`
  - `lib/cspice.a`
  - `lib/csupport.a`

The preflight does not assume prior shell setup. Example one-shot invocation:

```bash
TSPICE_CSPICE_DIR=/abs/path/to/cspice pnpm run preflight:parity:native
```

If `nix` is unavailable, install/enable it first. If you bootstrap CSPICE through an equivalent non-Nix path, set `TSPICE_CSPICE_DIR` to that install root before running parity checks.

`test` runs the full guard pipeline before parity execution:

1. schema validity,
2. completeness against v3 baseline coverage expectations,
3. cross-cutting spec discovery/validation/execution,
4. method parity execution (tspice vs cspice).
