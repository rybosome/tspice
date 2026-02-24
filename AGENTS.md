# AGENTS.md

This file is the working contract for how agents (including Charlie) should operate in `rybosome/tspice`.

Use it as practical guidance for planning, implementation, testing, docs updates, and PR handoff quality.

## 1) Start here: 30-second mental model

- `tspice` is a TypeScript-first SPICE toolkit for Node + browser runtimes.
- SPICE behavior is stateful: kernel loading mutates shared SPICE state; isolation requires process/worker separation.
- Public API usage is centered on `spiceClients` + `kernels`, with explicit `dispose()` lifecycle handling.
- `spice` is split into two layers:
  - `raw`: backend/CSPICE-shaped operations (close to contract semantics).
  - `kit`: ergonomic helpers composed over `raw`.
- Treat `raw` correctness + parity expectations as strict.
- Treat `kit` ergonomics as flexible, but still test/documented.
- `raw` and `kit` changes are both expected to be type-safe and well-tested.
- GitHub CI results are the canonical merge truth source.

## 2) Repo map + package responsibilities

Use this as the default routing map before editing files.

- Keep this table in sync with repo structure: if you add, remove, rename, or move a package/app/path listed here, update this table in the same PR.

| If your task is about... | Primary location(s) | Notes |
| --- | --- | --- |
| Public facade/API exports | `packages/tspice` | End-user entrypoint (`@rybosome/tspice`) and `raw`/`kit` user-facing surface. |
| Backend contract shape | `packages/backend-contract` | Shared contract all backends must satisfy. |
| Node backend behavior | `packages/backend-node` | Native addon backend (`backend: "node"`). |
| WASM backend behavior | `packages/backend-wasm` | Browser/Node WASM backend (`backend: "wasm"`). |
| Shared C integration layer | `packages/backend-shim-c` | Common C shim used by Node + WASM backends. |
| CSPICE parity harness/scenarios | `packages/parity-checking` and `docs/parity/` | Reference-parity infrastructure and mapping docs. |
| Docs site/app | `apps/docs` | User documentation site implementation. |
| Repo-level documentation | `README.md`, `docs/` | Architecture, parity, inventory, screenshots, reference docs. |
| CI/tooling scripts | `scripts/`, `scripts/ci/`, `tools/` | Validation/build tooling and automation behavior. |
| Benchmarks/contracts | `benchmarks/contracts` and `packages/bench-contract` | Benchmark contract specs and validation workflow. |

## 3) API layer contract (`raw` vs `kit`)

This boundary is core to repo semantics.

| Dimension | `raw` | `kit` |
| --- | --- | --- |
| Purpose | Thin, CSPICE/back-end-contract-facing operations | Ergonomic, tspice-invented convenience operations |
| Semantics | Preserve backend/CSPICE behavior shape | Compose over `raw` with explicit defaults |
| Allowed change style | Conservative and parity-driven | User-experience-driven (still explicit/tested) |
| Test obligations | Parity + edge/error behavior coverage expected | Unit/integration coverage for composition + defaults |
| Docs obligations | CSPICE-linked JSDoc and contract mapping consistency | Clear JSDoc/examples for behavior and defaults |

`raw`/`kit` rules:

- New `raw` API work MUST keep semantics aligned with backend contract/CSPICE expectations.
- New `raw` API work MUST include parity implications (tests and mapping updates when applicable).
- New `kit` API work MUST be explicit about defaults, composition, and error/edge behavior.
- `kit` MUST NOT silently redefine underlying `raw` semantics without clear rationale + docs.

## 4) Type-safety expectations

Production code quality gates (for new/changed production code):

- Avoid introducing unsafe escape hatches:
  - no `as unknown as ...`
  - no `as any`
  - no unbounded `any`
  - no `// @ts-ignore`
  - no `// @ts-expect-error` without a narrow, documented reason
  - no `eslint-disable` used to bypass type-safety rules
  - no unsafe casts used to bypass typing/contracts
- If an exception is truly necessary, keep it narrow and document the reason inline.
- Prefer explicit types and narrowings that explain intent.
- Keep public API types stable and legible.
- If runtime input is uncertain, validate/parse explicitly instead of asserting blindly.

Test code expectations:

- Test code can be more flexible when needed for fixtures/mocks.
- Even in tests, prefer local, contained casts with clear intent.

Quick rule of thumb:

| Context | Expectation |
| --- | --- |
| Production implementation | Strong typing, no unsafe shortcuts |
| Test/fixture setup | Practical flexibility allowed, but keep intent explicit |

## 5) Testing + parity requirements

Default stance: include tests unless there is a strong, explicit reason not to.

Per-change checklist:

| Change type | Minimum validation expectation |
| --- | --- |
| `raw` method add/change | Unit coverage + parity impact assessed + mapping/docs updated as needed |
| `kit` helper add/change | Unit/integration coverage proving composition/defaults/error behavior |
| Backend contract or backend behavior change | Cross-backend implications checked; parity expectations re-evaluated |
| Docs-only change | Validate docs coherence; tests optional unless behavior changed |

Quality expectations:

- Cover non-happy-path behavior (errors/edge cases), not just smoke paths.
- Call out any test gap explicitly in PR body when full coverage is impractical.
- If parity behavior changes, make that visible in both tests and PR narrative.

Common repo commands:

```bash
pnpm test:js
pnpm check:js
pnpm typecheck
```

## 6) Documentation + JSDoc standards

Documentation should move with code.

- Public-facing behavior changes SHOULD ship with docs updates in the same PR.
- `raw` functions SHOULD have consistently formatted JSDoc with CSPICE linkage.
- Public API entries (`raw` and `kit`) SHOULD describe behavior, parameters, return shape, and notable caveats.
- If a PR would make docs inaccurate, update docs in that PR unless there is an explicit, documented exception.

Documentation touchpoints to check:

- `README.md`
- `apps/docs`
- `docs/`
- Inline JSDoc in relevant packages

## 7) CI/platform truth table

GitHub CI is the canonical correctness signal for merge readiness.

| Validation surface | What it is good for | Limitations / caveats |
| --- | --- | --- |
| Local/devbox runs | Fast iteration, early feedback, targeted debugging | Environment/platform differences can hide issues |
| GitHub Actions runners | Canonical end-to-end merge signal, including parity-sensitive checks | Slower feedback loop than local |

Platform note:

- Local Linux ARM64 constraints can make local signals incomplete for final correctness.
- PRs MUST be evaluated by GitHub CI before merge decisions.

## 8) PR/review protocol + Definition of Done (DoD)

PR author expectations:

- Keep scope coherent; split unrelated work.
- Summarize behavior changes and risk clearly.
- Include what was validated (and what was intentionally not, if any).
- Update docs/JSDoc when behavior/public surface changed.

Review communication expectations:

- Distinguish blocking vs non-blocking feedback.
- Resolve threads or explicitly track follow-ups before merge.
- Prefer concrete, testable requests over ambiguous style guidance.

Definition of Done checklist:

- [ ] Scope matches issue/intent.
- [ ] Type-safety expectations are met.
- [ ] Required tests/parity expectations are met (or explicitly exceptioned).
- [ ] Docs/JSDoc are updated when needed.
- [ ] GitHub CI required checks have completed (not pending) and are green.
- [ ] PR description captures validation and any known limitations.

## 9) Labeling policy status (placeholder only)

- There is currently **NO formal issue labeling system** in this repository.
- Agents **SHOULD NOT** follow, assume, or enforce any label taxonomy at this time.
- Roadmap/prioritization labeling behavior is deferred until [#529](https://github.com/rybosome/tspice/issues/529) is designed and implemented.
- Until then, do not infer workflow state from labels; rely on issue/PR discussion and maintainer direction.

## 10) Agent operating guardrails (non-prescriptive)

Hard quality gates (MUST):

- Preserve the `raw` vs `kit` contract boundaries in both code and docs.
- Keep production code type-safe without unsafe escape hatches.
- Ensure required tests/parity expectations are satisfied for the scope of change.
- Keep docs/JSDoc aligned with public behavior changes.
- Treat GitHub CI as the canonical merge-readiness truth source.
- State assumptions and caveats explicitly when certainty is limited.

Flexible execution patterns (MAY):

- Choose discovery/edit/test order dynamically based on task risk.
- Parallelize independent subtasks when it improves cycle time and clarity.
- Use incremental commits/checkpoints or single-pass execution as appropriate.
- Adapt implementation approach to scope, provided quality gates remain intact.

This section is intentionally not a rigid workflow. It defines outcomes and quality bars, not one required sequence of steps.

## 11) Lightweight maintenance + drift policy

- `AGENTS.md` is maintained by **Charlie**.
- If Charlie notices a mismatch between this file and repo reality, Charlie should call it out immediately in the active work thread.
- Small drift should be fixed directly in the in-flight change when practical.
- Larger drift should be captured in a dedicated follow-up issue/PR with clear linkage.
- If guidance here conflicts with observed repo truth, surface the conflict explicitly instead of silently choosing one.
- Keep this file practical, concise, and actionable; avoid process bloat.
