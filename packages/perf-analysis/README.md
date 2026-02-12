# @rybosome/tspice-perf-analysis

Perf/benchmark analysis tooling around `@rybosome/tspice`.

Today this package includes a **node-native** benchmark runner that emits:

- `raw.json` (full samples + debug metadata)
- `bmf.json` (Bencher Metric Format)

Metric units (BMF does not have a unit field, so these are implied):

- `latency_p50` / `latency_p95`: `ns/op`
- `throughput`: `ops/sec`

See below for how to run it from the monorepo root.

## Running benchmarks (node-native)

Prerequisites:

- The node-native backend must be built (native addon available).
- On **linux-arm64**, automatic CSPICE fetching is not supported; you must provide a CSPICE install via `TSPICE_CSPICE_DIR`.

From the repo root:

```bash
pnpm bench --backend node-native --suite micro
```

Outputs are written to:

```
./benchmarks/results/<YYYYMMDD-HHmmss>/
  raw.json
  bmf.json
```

Override the output directory:

```bash
pnpm bench --backend node-native --suite micro --outDir ./benchmarks/results/custom
```

Native addon build (best-effort):

```bash
pnpm -w fetch:cspice
pnpm -C packages/backend-node run build:native
pnpm -w stage:native-platform
```

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

- No new fixture directories (we intend to **reuse** existing kernel fixtures first).
