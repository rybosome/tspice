# Contributing to tspice

Thanks for your interest in contributing to `tspice`.

This project explores a clean, modern TypeScript interface to SPICE.
It is maintained on a **best-effort basis**, with intentionally limited maintainer capacity.

Contributions are welcome, but expectations are explicit.

---

## Bug reports

**Bug reports are welcome and encouraged.**

If you encounter incorrect behavior, crashes, or inconsistencies:

- Open an issue using the bug report template
- Include reproduction steps where possible
- Include environment details (Node / browser, backend, kernels used)

There is **no guaranteed response time**. Issues may be triaged slowly, but
clear, well-scoped bug reports are genuinely helpful.

---

## Feature requests

Feature requests must start as **discussion**, not code.

If you have an idea:

- Open an issue describing the use case and motivation
- Be clear about scope and tradeoffs

`tspice` prioritizes:
- API clarity
- Cross-backend consistency
- Long-term maintainability

Not all feature requests will be accepted.

---

## Pull requests

Please **do not open pull requests without prior discussion**.

Maintainer time is extremely limited, and the bar for accepting PRs is intentionally high.
Uncoordinated PRs will be closed.

Before writing code:

1. Open an issue or discussion
2. Describe what you want to change and why
3. Wait for explicit alignment

Accepted PRs are expected to:
- Be narrowly scoped
- Follow existing patterns closely
- Include tests where appropriate
- Pass all automated checks without modification

Large refactors, API changes, or speculative abstractions are not accepted.

---

## Automation

This repository relies on automation to enforce consistency, compliance, and API stability.

PRs that do not pass automated checks will not be reviewed.

Automation is part of the project’s maintenance model.

### Coverage reporting (report-only)

The repository includes a report-only coverage lane for pull requests.

From the repo root:

- `pnpm coverage` — run all coverage-enabled package tests via Turbo
- `pnpm coverage:js` — JS-only coverage lane (matches `test:js` semantics)
- `pnpm coverage:report` — aggregate package summaries into JSON + markdown

The aggregate report emits a single all-unit-tests summary using whatever package `coverage-summary.json` files are present (plus package-level and missing-summary details).

`pnpm coverage:js` still runs a JS-only execution lane (matching `test:js` semantics), but `pnpm coverage:report` no longer adds parity/non-parity-specific views.

Coverage is currently informational only (no threshold enforcement).

---

## Responsiveness

`tspice` is a personal project maintained alongside a demanding full-time role.

As a result:
- Response times vary
- Some issues may remain open
- Some PRs may be declined without detailed feedback

This reflects the project’s maintenance constraints, not the quality of a contribution.

---

## Conduct

Basic decency is a hard requirement for participation in this project.

There is **zero tolerance for disrespectful or abusive behavior**.

Violations will result in immediate removal from the project.
