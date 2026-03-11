# Issue #594 one-shot main-based rewrite PR vehicle checklist

This file tracks the one-shot rewrite vehicle requested in https://github.com/rybosome/tspice/issues/594#issuecomment-4040595964.

## Locked setup

- [x] Base = `main`
- [x] Prior PRs `#599`, `#600`, and `#608` are context only (not dependencies)

## Contracts to enforce in implementation

- [ ] Reference-lane contract: `cspice` is the native-only authority lane (no fallback)
- [ ] Orchestration contract: run reference `cspice`, then compare both `node` and `wasm` against it
- [ ] Fail-closed requirement: if native dispatch is unavailable in `cspice` lane, fail explicitly with stable error shape

## Context links

- Issue #594: https://github.com/rybosome/tspice/issues/594
- PR #597: https://github.com/rybosome/tspice/pull/597
- PR #599: https://github.com/rybosome/tspice/pull/599
- PR #600: https://github.com/rybosome/tspice/pull/600
- PR #608: https://github.com/rybosome/tspice/pull/608
