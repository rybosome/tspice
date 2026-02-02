# How to be effective in this repo

This doc is a quick “mental map” for contributors. It’s intentionally short and links out to canonical READMEs/docs.

## Main entry points (what to touch first)

- **Public API (published package):** `packages/tspice` (`@rybosome/tspice`)
  - Start here for user-facing API changes: `createSpice()`, backend selection, exported surface.
  - Docs: [`../packages/tspice/README.md`](../packages/tspice/README.md)

- **Backend boundaries:**
  - **WASM backend:** `packages/backend-wasm` (`@rybosome/tspice-backend-wasm`)
    - Builds from checked-in Emscripten artifacts under `packages/backend-wasm/emscripten/`.
    - Docs: [`../packages/backend-wasm/README.md`](../packages/backend-wasm/README.md)
  - **Native Node backend:** `packages/backend-node` (`@rybosome/tspice-backend-node`)
    - Owns the Node native addon under `packages/backend-node/native/`.
    - Docs: [`../packages/backend-node/README.md`](../packages/backend-node/README.md)

- **Backend contract (shared types):** `packages/backend-contract` (`@rybosome/tspice-backend-contract`)
  - If you’re changing backend APIs, this is usually the first place to update.
  - Docs: [`../packages/backend-contract/README.md`](../packages/backend-contract/README.md)

- **Example app / integration:** `apps/orrery`

## Fastest path to run checks/build/test

From the repo root:

```bash
pnpm install

# “JS-only” verification (no native addon build)
pnpm run check:js

# Full verification (includes native addon build)
pnpm run check:native
```

Common single-purpose commands:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

When iterating on a specific workspace, prefer pnpm filters:

```bash
pnpm --filter @rybosome/tspice run test
pnpm --filter @rybosome/tspice-backend-wasm run build
pnpm --filter @rybosome/tspice-backend-node run build:native
```

## Native + WASM build/release workflow pointers

### WASM backend artifacts

- Regenerate the Emscripten outputs (requires `emcc`):

```bash
node scripts/build-backend-wasm.mjs
```

- Then rebuild/copy into `dist/`:

```bash
pnpm --filter @rybosome/tspice-backend-wasm run build
```

### Native backend + platform staging

The native addon is built in `packages/backend-node/native/`.

```bash
pnpm run fetch:cspice
pnpm -C packages/backend-node run build:native
pnpm run stage:native-platform
```

Notes:

- `pnpm run check:native` runs the full native pipeline (build + stage + build/test).
- Native builds require Python 3 and a working `node-gyp` toolchain.

### Publishing `@rybosome/tspice`

The publishable entry point is `@rybosome/tspice`.

- `pnpm run build` produces `packages/tspice/dist-publish/`.
- The release script lives in `packages/tspice`:

```bash
pnpm --filter @rybosome/tspice run release
```

(That script runs `verify:dist-publish` and uses `np` to publish from `dist-publish/`.)

## Compliance / redistribution checklist

Before publishing artifacts or changing anything related to CSPICE-derived components:

- Read the canonical docs:
  - Disclosure text + NAIF links: [`cspice-naif-disclosure.md`](./cspice-naif-disclosure.md)
  - Project policy: [`cspice-policy.md`](./cspice-policy.md)

- Make sure notices are correct:
  - Repo-wide: [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)
  - Backend notices:
    - [`../packages/backend-node/NOTICE`](../packages/backend-node/NOTICE)
    - [`../packages/backend-wasm/NOTICE`](../packages/backend-wasm/NOTICE)

- Run the repo guards:

```bash
pnpm run check:compliance
pnpm run check:versions
```
