# Agent guide

`tspice` provides a TypeScript facade over CSPICE for Node and browser runtimes. Use this guide for stable architectural constraints and file routing; use [development setup](docs/development-setup.md) for prerequisites and command details.

## Architecture and state

- The public entrypoint is `packages/tspice`, centered on `spiceClients` and `kernels`. Callers own the returned `dispose()` lifecycle.
- `raw` follows the shared backend contract and CSPICE semantics. `kit` composes ergonomic helpers over `raw` and documents its defaults.
- Node's native backend shares CSPICE state across backend objects in a process and serializes native operations. Independent native workloads need process isolation.
- Each WASM module instance owns its CSPICE state. Workers provide thread isolation for synchronous, CPU-heavy calls.
- The shared C shim owns common error, memory, and handle behavior. Keep Node and WASM adapters consistent with it.

## File routing

| Surface                                                   | Location                      |
| --------------------------------------------------------- | ----------------------------- |
| Public exports, clients, `raw` / `kit`, kernel catalogs   | `packages/tspice`             |
| Backend interfaces and shared types                       | `packages/backend-contract`   |
| Shared TypeScript validation and runtime helpers          | `packages/core`               |
| Node adapter and C++ addon                                | `packages/backend-node`       |
| WASM adapters, loaders, and checked-in Emscripten outputs | `packages/backend-wasm`       |
| Shared C ABI, errors, and handle registries               | `packages/backend-shim-c`     |
| Deterministic facade/testing backend                      | `packages/backend-fake`       |
| Live SpiceyPy oracle, case registry, and fixtures         | `packages/py-parity-checking` |
| Published native addon wrappers                           | `packages/tspice-native-*`    |
| Consumer typecheck without DOM libraries                  | `fixtures/consumer-nodom`     |
| Documentation site and API reference generation           | `apps/docs`                   |
| Contributor docs, mapping, inventory, and reset plan      | `docs`                        |
| Build, generation, validation, and CI setup               | `scripts`, `.github`          |

Update this map when package ownership or repository structure changes.

## Change requirements

- Preserve `raw` / `kit` responsibilities. A convenience helper must make its defaults and composition explicit.
- For a raw routine or backend change, trace the contract, shared C shim, Node adapter, WASM adapter, memory/handle lifecycle, errors, parity cases, and mapping documentation. State intentional backend exceptions explicitly.
- Validate unknown runtime values. Keep production types explicit; avoid `any`, double casts, and suppression comments that bypass contracts. A necessary exception must be narrow and explained inline.
- Cover meaningful success, edge, error, and cleanup behavior for changed code. Docs-only changes can use documentation validation instead of runtime tests.
- Keep three signals separate: routine implementation breadth, scenario/backend parity, and source line/branch coverage. A registered case alone does not prove semantic coverage.
- Update public JSDoc and affected examples with behavior changes. Follow [the CSPICE mapping](docs/spicebackend-cspice-mapping.md) and [generated routine inventory](docs/cspice-function-inventory.md).
- Regenerate owned artifacts with their source scripts. Never edit the checked-in WASM/glue or generated API/LLM output by hand. CSPICE downloads and build trees stay under ignored caches.

## Validation and handoff

Run a narrow package check first, then the relevant required lane:

```bash
pnpm doctor
pnpm run check:js:required

# Native or cross-backend changes
pnpm doctor:native
TSPICE_EXPECT_NATIVE=true pnpm run check:native:required
```

The JS lane uses checked-in WASM artifacts. Regenerating those artifacts requires Emscripten; see [development setup](docs/development-setup.md). For docs changes, use `pnpm docs:build` and regenerate `pnpm generate:llm` when its inputs change.

A PR handoff states the exact scope, behavior and backend implications, commands actually run, generated files updated, and remaining gaps. GitHub Actions provides the final platform and packaged-install evidence before merge. Keep PRs coherent and resolve actionable review feedback.

When this guide disagrees with code, report the concrete mismatch and update the guidance in the appropriate change. Keep temporary plans and historical issue references in the [reset plan](docs/project-reset-and-coverage-plan.md), rather than turning them into permanent agent policy.
