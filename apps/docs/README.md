# @rybosome/docs

VitePress documentation site for `tspice`.

## Local development

From the repo root:

- Dev server: `pnpm --filter @rybosome/docs dev`
- Production build: `pnpm --filter @rybosome/docs build`
- Preview build output: `pnpm --filter @rybosome/docs preview`

> Note: the VitePress `base` is environment-aware (see `.vitepress/config.mts`).
> - Local dev defaults to `/`.
> - GitHub Pages builds use `/<repoName>/` (derived from `GITHUB_REPOSITORY`).
> - Override if needed: `VITEPRESS_BASE=/tspice/ pnpm --filter @rybosome/docs dev`.
