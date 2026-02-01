# README conventions

This repo is a monorepo with multiple packages and apps. These conventions are meant to keep READMEs consistent, skimmable, and easy to maintain.

## Goals

- Make package/app READMEs easy to scan (common headings, consistent tone).
- Keep commands copy/pasteable from the repo root.
- Avoid duplicating large chunks of documentation between packages.

## Standard structure

Use these headings (omit sections that don’t apply):

- `# <name>`
- `## Overview`
- `## Purpose / Why this exists` (optional)
- `## How it fits into tspice` (optional)
- `## Installation` (optional; for published packages)
- `## Usage (Quickstart)`
- `## API surface` (optional)
- `## Development` (for contributors)
- `## Troubleshooting / FAQ` (optional)
- `## License / notices` (optional; or link to the canonical notice)

## Titles

- For workspace packages, use the package name from `package.json`:
  - Example: `# @rybosome/tspice-backend-wasm`
- For apps, use the workspace name from `package.json`:
  - Example: `# @rybosome/tspice-viewer`

## Repo commands

When a README includes repo-local commands, prefer running from the repo root using pnpm filters:

```bash
pnpm --filter <pkgName> run <script>
```

Examples:

```bash
pnpm --filter @rybosome/tspice run typecheck
pnpm --filter @rybosome/tspice-viewer run dev
```

Notes:

- `<pkgName>` should match the `name` field in that workspace’s `package.json`.
- Prefer documenting scripts that already exist in `package.json`.

## Linking

- Prefer relative links for repo-internal docs:
  - `../../docs/cspice-policy.md`
  - `../backend-wasm/README.md`
- Keep links stable when moving files (update cross-references as part of the change).

## Disclosures / notices

Some packages ship or reference CSPICE-derived artifacts.

- If the README needs disclosure text, link to the canonical docs:
  - `docs/cspice-naif-disclosure.md`
  - `docs/cspice-policy.md`
- If the package has a `NOTICE` file, link to it rather than duplicating the content.
