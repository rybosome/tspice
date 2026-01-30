# Contributing to `tspice`

Thanks for your interest in contributing!

This repo is a pnpm + Turborepo monorepo. Most PRs should be able to use the **JS-only** workflow (`pnpm check`) without touching native builds.

## Development setup

### Prerequisites

- Node.js **20** or **22** (these are the CI versions)
- `pnpm` (recommended via Corepack)

```bash
corepack enable
pnpm --version
```

### Install

From the repo root:

```bash
pnpm install
```

## Common commands

The repo exposes a small set of top-level scripts intended to match CI.

### Build

```bash
pnpm build:js   # build all JS packages (excludes the native Node addon)
pnpm build      # full build (includes dist packaging steps)
```

### Typecheck

```bash
pnpm typecheck
```

### Tests

```bash
pnpm test:js    # JS-only tests (excludes the native Node addon)
pnpm test       # all tests
```

### “What CI runs” (recommended before opening a PR)

```bash
pnpm check
```

`pnpm check` runs the same JS-only checks as the default CI job (compliance/versions checks, build, typecheck, tests).

### Native verification (only when needed)

Some changes (especially anything in `packages/backend-node` or CSPICE fetching/staging) should also run the native pipeline:

```bash
pnpm check:native
```

Native builds require Python 3 and a working `node-gyp` toolchain.

## Running the viewer (example app)

This repo includes an internal example / visualization app at `apps/tspice-viewer`.

```bash
pnpm -C apps/tspice-viewer dev
```

Other useful viewer commands:

```bash
pnpm -C apps/tspice-viewer test      # unit tests (vitest)
pnpm -C apps/tspice-viewer e2e       # Playwright e2e tests
pnpm -C apps/tspice-viewer build
pnpm -C apps/tspice-viewer preview
```

## PR process and expectations

- Keep PRs small and focused. If a change spans multiple packages, explain why.
- Add/adjust tests when changing behavior.
- Update docs (`README.md` and/or `docs/*`) when changing public APIs or contributor workflows.
- Prefer clear commit messages and descriptive PR titles.

### CSPICE policy & compliance

`tspice` embeds CSPICE-derived components as an internal implementation detail and follows NAIF redistribution guidance.

Before opening a PR that touches CSPICE fetching, packaging, redistribution, or adds bundled data (kernels/datasets), please review:

- [`docs/cspice-policy.md`](./docs/cspice-policy.md)

Also see the PR template compliance checklist:

- [`.github/pull_request_template.md`](./.github/pull_request_template.md)

If you’re unsure whether a change impacts compliance, open an issue first.

## Filing issues

Please use the GitHub issue forms (Bug Report / Feature Request). Include:

- which backend you’re using (`wasm` vs `node`)
- a minimal repro (or a link to a repro repo)
- versions (Node, OS, package versions)

