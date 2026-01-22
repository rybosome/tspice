# tspice-viewer

Minimal Vite + React + TypeScript app that renders a basic Three.js scene using an imperative `canvas` setup (no `@react-three/fiber`).

## Development

From repo root:

- `pnpm install`
- `pnpm -C apps/tspice-viewer dev`

## Scripts

- `pnpm -C apps/tspice-viewer build`
- `pnpm -C apps/tspice-viewer typecheck`
- `pnpm -C apps/tspice-viewer test`

## Taking a screenshot

1) Start the dev server:

```sh
pnpm -C apps/tspice-viewer dev
```

2) Open the local URL in your browser.

- Vite typically uses `http://localhost:5173`, but the terminal output will print the exact URL (and any alternative port if 5173 is already taken).

3) Capture a screenshot using your OS tooling.

- macOS: `Shift` + `Command` + `4` (region) or `Shift` + `Command` + `5` (toolbar)
- Windows: `Win` + `Shift` + `S` (Snipping Tool)
- Linux: use your desktop screenshot tool (often `PrtSc` / GNOME Screenshot / Spectacle)

### Optional: headless screenshot (Playwright)

If you want a repeatable, scriptable screenshot, you can use Playwright’s CLI (with the dev server running):

```sh
npx playwright screenshot http://localhost:5173 docs/assets/tspice-viewer.png --viewport-size=1280,720
```

Recommended location for committed screenshots: `docs/assets/`.
