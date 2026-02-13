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

### Output directory + overwrite semantics

By default, outputs are written to a **timestamped subdirectory** under `./benchmarks/results/`:

```
./benchmarks/results/<YYYYMMDD-HHmmss>/
  raw.json
  bmf.json
```

If you pass an explicit `--outDir`, outputs are written directly into that directory:

```bash
pnpm bench --backend node-native --suite micro --outDir ./benchmarks/results/custom
```

If `<outDir>/raw.json` or `<outDir>/bmf.json` already exist, they are **replaced**.
Writes are done via an atomic swap (write a temp file in the same directory, then rename) to avoid leaving truncated JSON on crash.

### BMF semantics + units

`bmf.json` is a minimal Bencher Metric Format (BMF) mapping of:

`benchmarkKey -> metricName -> { value: number }`

Where `benchmarkKey` is currently:

`node-native/<suiteId>/<benchmarkCaseId>`

Since BMF does not include a unit field, consumers must treat these units as **implied**:

- `latency_p50` / `latency_p95`
  - **Unit:** `ns/op`
  - **Meaning:** p50/p95 quantiles of the measured `ns/op` samples.
  - Quantiles are computed from the sorted samples using linear interpolation between ranks.

- `throughput`
  - **Unit:** `ops/sec`
  - **Meaning:** throughput derived from the mean latency across samples.
  - Computation: `throughput = 1e9 / mean(ns/op)`.

Why quantiles for latency but mean for throughput?

- Latency quantiles (p50/p95) are stable, interpretable “typical” and “tail” measures and are a good fit for regression thresholds.
- Throughput is fundamentally an “average rate” measure, and the mean latency is the simplest way to derive an expected steady-state ops/sec.

We emit `latency_p50` and `latency_p95` as distinct measures (rather than overloading BMF `upper_value`) so they remain first-class metrics for alerting/thresholding.

### Timing + warmup semantics

Each benchmark case runs:

1) **Preflight** kernel loading once (outside timing) to fail fast on missing/bad kernels.
2) **Warmup phase**: `warmupIterations` iterations.
3) **Measured phase**: `iterations` iterations producing one latency sample each.

Within each warmup/measured iteration the runner:

- calls `isolate()` (`kclear()` + `reset()`) to start from a clean SPICE kernel pool/state
- loads the configured kernel(s) (if any)
- runs the benchmark call loop `opsPerIteration` times

The **measured timer** (`process.hrtime.bigint()`) starts *after* isolation + kernel loading and stops immediately after the call loop.
This means the reported latency/throughput:

- **includes:** just the benchmark call(s)
- **excludes:** kernel loading (`furnsh`) and per-iteration isolation/reset overhead

Isolation is performed **per iteration** (not per op). Each sample is the average latency of `opsPerIteration` calls executed under the same isolated+kernel-loaded state.
This both reduces timer overhead for very fast calls and keeps each sample comparable by resetting SPICE state between samples.

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
