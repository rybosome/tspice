# Contributor map

Start with [development setup](./development-setup.md) for the pinned toolchain, doctor profiles, CSPICE cache behavior, and required validation commands. [AGENTS.md](../AGENTS.md) contains the stable architecture and change requirements for agent-assisted work.

## Main entrypoints

| Work | Start here |
| --- | --- |
| Public API, backend selection, clients, kernels, packaging | [`packages/tspice`](../packages/tspice/README.md) |
| Shared backend API shape | [`packages/backend-contract`](../packages/backend-contract/README.md) |
| Native C++ adapter and addon loading | [`packages/backend-node`](../packages/backend-node/README.md) |
| Portable adapters, loaders, and WASM assets | [`packages/backend-wasm`](../packages/backend-wasm/README.md) |
| Common C errors, memory, and opaque handles | [`packages/backend-shim-c`](../packages/backend-shim-c/README.md) |
| Shared TypeScript runtime helpers | [`packages/core`](../packages/core/README.md) |
| Deterministic fake backend | [`packages/backend-fake`](../packages/backend-fake/README.md) |
| SpiceyPy oracle and parity scenarios | [`packages/py-parity-checking`](../packages/py-parity-checking/README.md) |
| Build and generator ownership | [`scripts`](../scripts/README.md) |
| User-facing explanations and architecture | [`apps/docs`](../apps/docs/README.md) |

Orrery is a separate application maintained in [its own repository](https://github.com/rybosome/orrery).

## Validation

Install the frozen workspace dependencies and run the required lane for your change as described in [development setup](./development-setup.md). When iterating, pnpm filters let you run a package's checks directly:

```bash
pnpm --filter @rybosome/tspice run test
pnpm --filter @rybosome/tspice-backend-wasm run build
pnpm --filter @rybosome/tspice-backend-node run build:native
```

CI runs JS and native lanes on Linux/macOS with Node 20/22, plus packed-install smoke tests for the published native platforms. Treat those results as merge evidence; local success covers only the local environment.

## CSPICE and backend artifacts

- Native builds use the pinned archive in [`scripts/cspice.manifest.json`](../scripts/cspice.manifest.json), or a compatible installation supplied through `TSPICE_CSPICE_DIR`.
- `pnpm run stage:native-platform` copies a local addon into its matching platform wrapper package for packaging checks.
- Ordinary JS work uses the checked-in WASM artifact. `node scripts/build-backend-wasm.mjs` regenerates it using Emscripten and the shared C shim; it stages downloaded and patched CSPICE source under ignored `.cache/` paths.
- The Linux ARM64 source-build path is defined by [`flake.nix`](../flake.nix). On an AArch64 Linux builder, `nix build .#cspice-linux-arm64` produces the CSPICE `include/` and `lib/` tree. The development shell is `nix develop .#devShells.aarch64-linux.default`. Linux ARM64 is not currently a published native package target.

## Generated docs and coverage planning

The [routine inventory](./cspice-function-inventory.md) is generated from the canonical JSON and backend contract. Use it to select current planned routines, then use the [mapping](./spicebackend-cspice-mapping.md) and [reset plan](./project-reset-and-coverage-plan.md) to assess backend semantics and parity requirements.

`pnpm docs:api` generates API reference pages, `pnpm docs:build` builds the VitePress site, and `pnpm generate:llm` regenerates LLM artifacts from their owning source inputs. The [script catalog](../scripts/README.md) lists each generator's inputs and outputs.

## Publishing and redistribution

The public facade is `@rybosome/tspice`; `pnpm run build` creates its `packages/tspice/dist-publish/` output. The [release workflow](../.github/workflows/release.yml) owns version-tag publishing and native platform package checks. Publishing is a separate maintainer decision from routine development.

Before publishing or changing CSPICE-derived components, read the [disclosure](./cspice-naif-disclosure.md), [project policy](./cspice-policy.md), and [third-party notices](../THIRD_PARTY_NOTICES.md). Keep the [Node](../packages/backend-node/NOTICE) and [WASM](../packages/backend-wasm/NOTICE) notices with their artifacts.

```bash
pnpm run check:compliance
pnpm run check:versions
```
