# @rybosome/tspice-perf-analysis

Scaffolding for a future perf/benchmark analysis layer around tspice.

This package is intentionally **layout-only** right now: it provides the directory structure and stable module surfaces that follow-on issues can build on.

## Directory layout

- `src/contracts/benchmark-contract/v1/` (pure)
  - Types and (eventual) YAML parsing + validation for the benchmark contract.
  - Must stay portable/pure: **no filesystem reads**, **no process env access**, **no execution**.

- `src/shared/fixtures/` (shared helpers)
  - Runner-agnostic utilities for interpreting/normalizing fixture references.
  - Initially intended to support reusing kernel fixtures from `packages/tspice/test/fixtures/kernels/...` via configurable `fixtureRoots`.

- `src/envs/executors/` (I/O + execution)
  - Environment-specific execution adapters (shelling out, spawning, process management, etc.).

- `src/runners/<runner>/` (runner orchestration)
  - Runner-specific orchestration (e.g. invoking tspice, parsing results, etc.).
  - This is where filesystem and process I/O is expected.

- `src/suites/yaml/v1/*.yml`
  - Canonical location for benchmark suite YAML files conforming to the v1 benchmark contract.

## Non-goals (for now)

- No real parsing/validation/execution logic yet.
- No new fixture directories (we intend to **reuse** existing kernel fixtures first).
