# Issue triage & labeling (maintainers)

This doc is a lightweight internal guide for consistent issue intake and labeling.

## Current labels (already in the repo)

**Type / intent**

- `bug`
- `enhancement`
- `documentation`
- `question`

**Disposition / meta**

- `duplicate`, `invalid`, `wontfix`
- `good first issue`, `help wanted`

## Suggested label taxonomy (optional additions)

These labels are *suggestions* to make the backlog easier to filter. They may not exist yet.

**Area** (where the work lives)

- `area:viewer` (`apps/tspice-viewer`)
- `area:wasm` (`packages/backend-wasm`)
- `area:node` (`packages/backend-node`)
- `area:core` (`packages/core`, `packages/tspice`)
- `area:docs`
- `area:ci`

**Status** (workflow state)

- `status:needs-triage` (new issue, not yet reviewed)
- `status:needs-info` (waiting on reporter)
- `status:needs-repro` (can’t reproduce yet)
- `status:blocked` (depends on external decision/work)
- `status:ready` (well-scoped and ready to implement)

**Priority** (rough ordering)

- `priority:p0` urgent / breaks users
- `priority:p1` important
- `priority:p2` nice-to-have

## Triage workflow

1) **Intake (first pass)**
- Apply a **type** label (`bug` / `enhancement` / `documentation` / `question`).
- Apply an **area** label when clear.
- If needed, ask for missing details (and optionally apply `status:needs-info`).

2) **For bug reports**
- Attempt to reproduce with the stated backend (`wasm` vs `node`).
- If reproducible: add minimal repro notes to the issue and move to `status:ready`.
- If not reproducible: request a minimal repro and use `status:needs-repro`.

3) **For feature requests**
- Confirm intended backend support (`wasm`, `node`, or both).
- If it needs design, keep discussion in the issue and avoid half-implemented PRs.
- If it changes public API, document expected behavior in the issue before implementation.

4) **Closing guidance**
- Close with a short reason and apply one of: `duplicate`, `invalid`, `wontfix`.
- If closing because the issue is resolved by a PR, link the PR.

## Using "good first issue" and "help wanted"

- Prefer `good first issue` for tasks that are:
  - small and well-scoped
  - mostly localized to one package
  - testable without deep CSPICE context
  - unlikely to require changes to CSPICE fetch/packaging/distribution policy

- Prefer `help wanted` for larger tasks where maintainers want outside help, but the issue may still require guidance.

## Future work (non-blocking)

- Consider adding a `SECURITY.md` / published GitHub Security Policy so reporters have a clear private disclosure path.
