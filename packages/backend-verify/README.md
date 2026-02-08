# backend-verify

YAML-driven verification harness for the TSPICE backend.

## Scenarios

Scenarios live in `packages/backend-verify/scenarios/*.yml`.

### Kernel paths

In a scenario's `setup.kernels`, kernel entries can be:

- Absolute filesystem paths
- Relative paths (resolved relative to the scenario file)
- `$FIXTURES/...` aliases

#### `$FIXTURES`

`$FIXTURES` expands to a **fixtures root** directory:

- If `TSPICE_FIXTURES_DIR` is set, that directory is used (relative values are resolved against `process.cwd()`).
- Otherwise, the parser walks up from the scenario directory (and then from `process.cwd()`) until it finds a monorepo root marker (`pnpm-workspace.yaml` or `.git`), and uses:
  - `<repoRoot>/packages/tspice/test/fixtures/kernels`

#### Fixture packs (directory alias)

If a kernel entry resolves to a directory, it is treated as a **fixture pack directory alias** and will load:

- `<dir>/<basename(dir)>.tm`

Example:

- `$FIXTURES/basic-time` loads `$FIXTURES/basic-time/basic-time.tm`

## Notes

- This repo commits only publicly available kernels needed for tests.
- CSPICE itself is **not** committed.
