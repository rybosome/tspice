# Benchmark contract (YAML) — v1

This repo uses a small YAML “benchmark contract” to describe runnable benchmark suites.

The contract is **versioned** so we can evolve the schema over time without breaking older suites.

## Versioning

Each benchmark suite YAML file declares its schema version:

```yml
schemaVersion: 1
```

Future versions will increment this number, and tooling will validate against the selected version.

## v1 schema

### Top-level

```yml
schemaVersion: 1
suite: <string?>
fixtureRoots: <map<string,string>?>
defaults:
  setup:
    kernels: <fixtureRef[]?>
benchmarks: <benchmark[]>
```

- `suite` is an optional human-friendly label.
- `benchmarks` is required.

### Fixture roots + fixture refs

v1 supports referencing real fixture files via **fixture refs**.

A fixture ref is a string of the form:

- `$FIXTURES/<path>`
- `$<ROOT>/<path>` where `<ROOT>` is a key in `fixtureRoots`.

Example:

```yml
fixtureRoots:
  FIXTURES: packages/tspice/test/fixtures

defaults:
  setup:
    kernels:
      - $FIXTURES/kernels/naif0012.tls
```

Validation checks:

When fixture checks are enabled (default):

- the referenced root exists (when provided in `fixtureRoots`)
- the referenced file exists
- the ref does not escape its root via path traversal (`..`)
- the ref does not escape its root via symlinks (realpath containment)

When fixture checks are disabled (`--no-check-fixtures` / `checkFixtureExistence: false`):

- the path-traversal containment check is still performed (`..` cannot escape the root)
- root/file existence checks are skipped

Symlink containment is controlled separately via `checkSymlinkContainment` in
`resolveFixtureRef()` (it defaults to the same value as `checkExistence`). This
means callers can still opt into realpath-based symlink containment even when
existence checks are disabled.

Note: `checkSymlinkContainment` performs synchronous filesystem IO (e.g.
`fs.realpathSync`) and requires the fixture root to exist.

Note: enabling fixture checks performs **synchronous filesystem IO** and may be expensive in
long-running processes.

### Benchmarks

Every benchmark has:

```yml
id: <string>
kind: micro | workflow
measure: <any?>
setup:
  kernels: <fixtureRef[]?>
```

`call` semantics are intentionally opaque in v1; validation only checks structure.

#### Micro benchmarks

```yml
kind: micro
cases:
  - call: <string>
    args: <any?>
```

#### Workflow benchmarks

```yml
kind: workflow
steps:
  - call: <string>
    args: <any?>
    saveAs: <string?>
    sink: <string|boolean?>
```

Workflow steps can reference saved variables inside `args` with:

```yml
$ref: var.<name>
```

Validation enforces that `var.<name>` refers to a prior step’s `saveAs`.

## CLI

Validate a suite YAML file:

```sh
pnpm bench:contract validate benchmarks/contracts/v1/example.yml
```

The command exits non-zero and prints one error per line as `<path>: <message>`.

Usage errors additionally print the full usage text block after the first `$: <message>` line.

Pass `--json` to emit a machine-readable JSON object.

The JSON output schema is intentionally stable and always includes the same top-level keys (for both success and failure):

- `ok`: boolean
- `kind`: one of `"success" | "usage" | "parse" | "validate"`
- `errors`: an array of `{ path, message }` (empty on success)
- `usage`: a usage string (always included for help/automation)
