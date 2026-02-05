# PR-sized implementation grouping plan (A–D + 1–16)

Context:

- Originating issue: https://github.com/rybosome/tspice/issues/285
- Grouping proposal comment (quoted/expanded here): https://github.com/rybosome/tspice/issues/285#issuecomment-3855513055

This doc expands the proposed “PR-sized implementation groups” into **actionable implementation plans**.

## Table of contents

- [Guiding principles](#guiding-principles)
- [Naming / routing conventions (what exists today)](#naming-routing-conventions)
- [Enabler PRs (A–D)](#enabler-prs-a-d)
  - [Enabler A — SpiceCell + SpiceWindow core types + marshalling](#enabler-a)
  - [Enabler B — String array + fixed-width output string buffers](#enabler-b)
  - [Enabler C — File-handle + DAF/DAS/DLA plumbing](#enabler-c)
  - [Enabler D — Error-system mapping + `Found` conventions](#enabler-d)
- [Dependency graph](#dependency-graph)
  - [Dependency table](#dependency-table)
- [Group-by-group implementation plans](#group-by-group-implementation-plans)
  - [Group 1 — Foundational contract + shared runtime utilities](#group-1)
  - [Group 2 — (Enabler A) SpiceCell/SpiceWindow types + basic ops](#group-2)
  - [Group 3 — (Enabler B) String array + fixed-width output-buffer conventions](#group-3)
  - [Group 4 — (Enabler D) Error system + status utilities](#group-4)
  - [Group 5 — Kernel pool read/write core](#group-5)
  - [Group 6 — IDs↔names & frame name utilities](#group-6)
  - [Group 7 — Time expansions (non-core conversions)](#group-7)
  - [Group 8 — Vector/matrix “bulk add” (no kernels required)](#group-8)
  - [Group 9 — Frame transforms & attitude (CK read-only first)](#group-9)
  - [Group 10 — (Enabler C) File handles + DAF/DAS/DLA core](#group-10)
  - [Group 11 — Kernel management “full” (beyond furnsh/kclear)](#group-11)
  - [Group 12 — SPK read APIs + coverage/object queries](#group-12)
  - [Group 13 — Geometry “classic” (subpoints, intercepts, illumination)](#group-13)
  - [Group 14 — GF event finding tranche 1 (infra + 1–2 search families)](#group-14)
  - [Group 15 — Writers: SPK/CK/PCK (segment creation)](#group-15)
  - [Group 16 — DSK + EK “big subsystems” (split further)](#group-16)

## Guiding principles

- **Each group is sized for one PR.** It should be possible to land it without coordinating large cross-cutting refactors.
- Each group is expected to touch the same three layers:
  - **Contract:** `packages/backend-contract/src/domains/*` (API surface + types)
  - **Node backend:** `packages/backend-node/*` (native addon export + TS adapter)
  - **WASM backend:** `packages/backend-wasm/*` (wasm exports + shim/TS adapter)
- **Group by marshalling + CSPICE subsystem boundaries, not by “domain name”.** PR size is dominated by shared plumbing (string buffers, cells/windows, file handles), not by which high-level routine uses it.
- **Prefer explicit return objects over “out params”.** Contract APIs should model common CSPICE calling patterns as ergonomic JS shapes.
- **Be strict about invariants at boundaries.** Fail fast on contract violations (wrong lengths, non-finite numbers, illegal enum strings).

Related docs / code pointers:

- CSPICE routine inventory (implemented vs planned): [`docs/cspice-function-inventory.md`](./cspice-function-inventory.md)
- Backend contract package overview: [`packages/backend-contract/README.md`](../packages/backend-contract/README.md)
- Node backend package overview: [`packages/backend-node/README.md`](../packages/backend-node/README.md)
- WASM backend package overview: [`packages/backend-wasm/README.md`](../packages/backend-wasm/README.md)
- Contract domains folder (current surface): [`packages/backend-contract/src/domains/`](../packages/backend-contract/src/domains/)

## Naming routing conventions

_(what exists today)_

- Contract composes the backend surface in `packages/backend-contract/src/index.ts` via `SpiceBackend extends TimeApi, KernelsApi, ...`.
- Node backend assembles the runtime backend in `packages/backend-node/src/index.ts` by spreading per-domain factories (`createTimeApi`, `createKernelsApi`, …) over the native binding.
  - Native addon entrypoint: `packages/backend-node/native/src/addon.cc`
  - Native domain registration pattern: `packages/backend-node/native/src/domains/*.{h,cc}`
- WASM backend assembles the runtime backend in `packages/backend-wasm/src/runtime/create-backend.*.ts` by spreading per-domain factories over an Emscripten `module`.
  - Typed export surface: `packages/backend-wasm/src/lowlevel/exports.ts`
  - Shared C shim sources (compiled into WASM): `packages/backend-shim-c/src/domains/*.c` (wired in `scripts/build-backend-wasm.mjs`)
  - TS-side marshalling helpers live under `packages/backend-wasm/src/codec/*`.

## Enabler PRs (A-D)

The lettered “enabler” PRs are called out because they unlock many later routines. In the numbered plan, they correspond to:

| Enabler | Equivalent numbered group |
| --- | --- |
| A) SpiceCell + SpiceWindow | Group 2 |
| B) String array + fixed-width output buffers | Group 3 |
| C) File handles + DAF/DAS/DLA plumbing | Group 10 |
| D) Error system mapping + Found conventions | Group 4 |

The remainder of this doc uses the numbered groups as the primary identifiers, and annotates where a group is also an enabler.


### Enabler A

**SpiceCell + SpiceWindow core types + marshalling**

**Purpose / what it unlocks**: introduces SPICE’s `CELL`/`WINDOW` collection types so later PRs can expose coverage windows (`spkcov`, `ckcov`, …), object sets (`spkobj`, `ckobj`, …), and GF confinement/result windows.

**Dependencies**: Group 1.

**Scope by layer**

- Contract (`packages/backend-contract/src/domains/*`): add `SpiceCell<T>` / `SpiceWindow` types + a minimal operations surface.
- Node (`packages/backend-node/*`): marshalling between JS (typed arrays / objects) and native SPICE cell structs; safe lifetime semantics.
- WASM (`packages/backend-wasm/*`): define a stable linear-memory layout for cells/windows + view helpers.

**Concrete deliverables / tests / DoD**: implemented as **Group 2** below (this enabler is intentionally not separate work from Group 2).

### Enabler B

**String array + fixed-width output string buffers**

**Purpose / what it unlocks**: unlocks routines with “`char[][len]`” outputs and multi-string results (`kdata`, pool getters, EK metadata, etc.).

**Dependencies**: Group 1.

**Scope by layer**

- Contract: types/conventions that make max-length constraints explicit.
- Node: native helpers for string arrays + output buffers.
- WASM: TS codec helpers + shim wrappers for packed fixed-width buffers.

**Concrete deliverables / tests / DoD**: implemented as **Group 3** below.

### Enabler C

**File-handle + DAF/DAS/DLA plumbing**

**Purpose / what it unlocks**: provides the low-level I/O substrate for kernel readers/writers (SPK/CK/PCK/DSK/EK) and many “coverage/object query” APIs.

**Dependencies**: Group 4 (error handling rules).

**Scope by layer**

- Contract: branded handle types + file I/O domain.
- Node: native handle registry + safe close semantics.
- WASM: shim wrappers + TS-side handle state tracking.

**Concrete deliverables / tests / DoD**: implemented as **Group 10** below.

### Enabler D

**Error-system mapping + `Found` conventions**

**Purpose / what it unlocks**: makes failure behavior consistent (throw vs `{found:false}`) and enables reliable wrapping of routines with “found” outputs.

**Dependencies**: Group 1.

**Scope by layer**

- Contract: a minimal error/status domain + documented conventions.
- Node: normalized `Error` shapes and consistent exception propagation.
- WASM: richer error decoding than “single message string”.

**Concrete deliverables / tests / DoD**: implemented as **Group 4** below.

---

## Dependency graph

### Dependency table

> “Deps” are other **groups** that must be merged first.

| Group | Title | Deps |
| --- | --- | --- |
| 1 | Foundational contract + shared runtime utilities | — |
| 2 | (A) SpiceCell/SpiceWindow types + basic ops | 1 |
| 3 | (B) String array + output-buffer conventions | 1 |
| 4 | (D) Error system + status utilities | 1 |
| 5 | Kernel pool read/write core | 3, 4 |
| 6 | IDs↔names & frame name utilities | 5 |
| 7 | Time expansions (non-core conversions) | 5 |
| 8 | Vector/matrix bulk add (no kernels required) | 1 |
| 9 | Frame transforms & attitude (CK read-only first) | 5, 6, 7, 8 |
| 10 | (C) File handles + DAF/DAS/DLA core | 4 |
| 11 | Kernel management “full” (beyond furnsh/kclear) | 3, 4, 10 |
| 12 | SPK read APIs + coverage/object queries | 6, 7, 8, 10, 11 |
| 13 | Geometry “classic” (subpoints, intercepts, illumination) | 5, 8, 9, 12 |
| 14 | GF event finding tranche 1 | 2, 4, 12, 13 |
| 15 | Writers: SPK/CK/PCK (segment creation) | 6, 7, 8, 10 |
| 16 | DSK + EK “big subsystems” (split further) | 2, 3, 4, 10 |

## Suggested merge ordering (topological)

This is a dependency-respecting ordering that keeps “unlocking power” high. Where there are multiple valid choices, the ordering below tries to keep later PRs smaller and reduce churn.

1. **Group 1**
2. **Parallel tranche (can be simultaneous PRs after 1):** Groups **2**, **3**, **4**, **8**
3. **Group 5** (depends on 3+4)
4. **Parallel tranche:** Groups **6** and **7** (both depend on 5)
5. **Group 10** (depends only on 4; can start as soon as 4 lands, even if 5–7 are in progress)
6. **Group 11**
7. **Group 9** (once 5–8 are available)
8. **Group 12**
9. **Group 13**
10. **Group 14**
11. **Parallel tranche:** Groups **15** and **16** (after their deps; note 16 is large and should likely be split into 16a/16b)

### Parallelism notes

- **Groups 2/3/4/8** can be developed independently once the “Group 1” conventions/types land.
- **Group 10** is largely orthogonal to kernel pool + naming/time work; it mainly needs the error mapping rules from Group 4.
- **Group 6** and **Group 7** are safe parallel candidates after Group 5.
- Once Group 12 lands, **Group 13** and early parts of **Group 14** can overlap (but GF work tends to need more review time).

---

# Group-by-group implementation plans

Each group below is scoped and written as if it were the checklist for a PR.

## Group 1

**Foundational contract + shared runtime utilities**

**Purpose / unlocks**

- Establish consistent TS shapes and invariants that later domains build on.
- Reduce later PR churn by settling patterns for:
  - `Found<T>` usage
  - Matrix/vector runtime validation and branding
  - “out params” → return object conventions

**Depends on**: none

**Contract layer (`packages/backend-contract`)**

- Review/extend `Found<T>` in `packages/backend-contract/src/shared/types.ts`:
  - Decide (and document in comments) which routine families must throw vs return `{found:false}`.
  - If needed, add helper types like `FoundString`, `FoundInt`, etc. (type aliases only).
- Extend branded types/helpers where they are missing:
  - Today: `Mat3RowMajor`/`Mat3ColMajor` + runtime branders in `src/shared/mat3.ts`.
  - Add similar patterns for common SPICE “fixed-size arrays” that show up repeatedly (e.g. 6x6 matrices are currently raw arrays).
- Add a small “contract conventions” section (comments) to each domain file explaining:
  - argument validation expectations
  - return shape conventions

**Node backend layer (`packages/backend-node`)**

- Establish a shared pattern for runtime checks in TS adapters:
  - Prefer `invariant(...)` from `@rybosome/tspice-core` at the domain boundary.
  - For numeric arrays returned from the native addon, consistently validate length.
- (Optional but recommended) Add shared helpers for repetitive checks (e.g. `assertLength3`, `assertLength6`) under `packages/backend-node/src/codec/*`.

**WASM backend layer (`packages/backend-wasm`)**

- Establish common helpers for repetitive allocation patterns:
  - `mallocOrThrow(size)`
  - `withMalloc` / `withAllocs` style helpers that guarantee `_free` in finally blocks
  - shared “error buffer” allocation conventions (today most calls use `errMaxBytes=2048`)
- Centralize common shapes:
  - Found-flag decoding
  - string output buffer decoding and trimming rules

**Concrete deliverables (files/areas to touch)**

- `packages/backend-contract/src/shared/types.ts`
- `packages/backend-contract/src/shared/mat3.ts`
- `packages/backend-node/src/codec/*` (add helpers or conventions)
- `packages/backend-wasm/src/codec/*` (add helpers)

**Testing strategy**

- Contract:
  - Add/extend tests in `packages/backend-contract/test/index.test.ts` for any new runtime validators/branders.
- Backends:
  - Add unit tests that validate invariant failures for bad inputs (length mismatch, non-finite numbers) without requiring kernels.

**Risks / edge cases**

- Over-building abstractions can slow later work. Keep helpers minimal and “pay-for-what-you-use”.
- Contract changes that alter runtime exports may affect consumers (even internal ones). Keep changes additive.

**Definition of Done**

- Conventions are documented in code comments.
- Any added runtime helpers are covered by tests.
- No behavior changes to existing implemented SPICE calls unless explicitly intended.

---

## Group 2

**(Enabler A) SpiceCell/SpiceWindow types + basic ops**

**Purpose / unlocks**

- Introduce SPICE “collection” primitives (`SpiceCell<T>`, `SpiceWindow`) that many CSPICE subsystems use:
  - Coverage windows: `spkcov`, `ckcov`, `pckcov`, DSK coverage
  - Object lists: `spkobj`, `ckobj`, etc.
  - GF (geometry finder) confinement/result windows

**Depends on**: Group 1

**Contract layer (`packages/backend-contract`)**

- Add a new domain file, e.g. `packages/backend-contract/src/domains/cells-windows.ts`, exporting:
  - `SpiceCell<T>` shape(s)
  - `SpiceWindow` shape(s)
  - Basic utilities needed by later APIs (at minimum):
    - `ssize`, `scard`, `card`, `size`, `valid`
    - “window basics” (`wninsd`, `wnextd`, etc.)
- Decide contract ownership:
  - Either expose “cell ops” as first-class backend routines (mirroring CSPICE),
  - or keep most cell ops internal and only expose cells as data carriers.
  - This plan assumes we expose a minimal set of operations because later routines need to construct and inspect windows.
- Update `packages/backend-contract/src/index.ts`:
  - export the new domain
  - extend `SpiceBackend` with `CellsWindowsApi` (or similar)

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Add a new native domain under `packages/backend-node/native/src/domains/` (e.g. `cells_windows.{h,cc}`) and register it in `native/src/addon.cc`.
  - Implement marshalling between JS arrays/typed arrays and SPICE cell structs.
    - Define rules for element type (`int`, `double`, `char`) and how it maps to JS.
    - Define allocation strategy: cells are sized at creation; many CSPICE routines require caller-allocated cells.
  - Ensure lifetime safety: never expose raw pointers to JS; represent cells as opaque JS objects with internal buffers.
- TS adapter:
  - Add `packages/backend-node/src/domains/cells-windows.ts` implementing the contract API by delegating to native.

**WASM backend layer (`packages/backend-wasm`)**

- Shared shim C (`packages/backend-shim-c`):
  - Add `src/domains/cells_windows.c` with wrapper functions that:
    - allocate/init SPICE cells/windows
    - perform basic ops
    - return results in a stable ABI-friendly layout
- WASM exports:
  - Add exported symbols to `scripts/build-backend-wasm.mjs` `EXPORTED_FUNCTIONS` and to `packages/backend-wasm/src/lowlevel/exports.ts`.
- TS adapter:
  - Add `packages/backend-wasm/src/domains/cells-windows.ts` implementing the contract API.
  - Implement a clear, documented linear-memory layout for the cell backing store (so later code can reuse it).

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/cells-windows.ts` (new)
  - `packages/backend-contract/src/index.ts`
- Node:
  - `packages/backend-node/native/src/domains/cells_windows.{h,cc}` (new)
  - `packages/backend-node/native/src/addon.cc`
  - `packages/backend-node/src/domains/cells-windows.ts` (new)
  - `packages/backend-node/src/index.ts`
- WASM:
  - `packages/backend-shim-c/src/domains/cells_windows.c` (new)
  - `scripts/build-backend-wasm.mjs`
  - `packages/backend-wasm/src/lowlevel/exports.ts`
  - `packages/backend-wasm/src/domains/cells-windows.ts` (new)
  - `packages/backend-wasm/src/runtime/create-backend.*.ts`

**Testing strategy**

- Add backend-level unit tests for basic cell/window operations (no kernels required):
  - create cell/window, insert items, verify cardinality, verify ordering rules.
- Add cross-backend parity tests (similar to `packages/backend-node/test/primitives-parity.test.ts`) for the basic operations.
- Add type-level tests in `packages/tspice/test/types.test.ts` (or contract tests) to validate ergonomics of the new types.

**Risks / edge cases**

- **Sizing rules are easy to get wrong.** SPICE requires correct `size`/`card` invariants; failing to respect them can cause memory corruption in native code.
- **Window semantics are subtle:** windows are sets of intervals with invariants (ordering, disjointness, closed intervals).
- **Performance traps:** copying large cells between JS and native can be expensive. Prefer “caller supplies cell” patterns where feasible.

**Definition of Done**

- `SpiceCell`/`SpiceWindow` contract types exist and are documented.
- Both backends support creating and performing basic ops on cells/windows.
- Unit + parity tests cover success and failure cases (invalid size/card, out-of-range inserts).

---

## Group 3

**(Enabler B) String array + fixed-width output-buffer conventions**

**Purpose / unlocks**

- Provide stable conventions for routines that:
  - return **multiple strings** (e.g. kernel lists)
  - return **fixed-width string outputs** (common in CSPICE)
- This unblocks `kdata`-style surfaces, kernel pool getters, EK metadata queries, and many misc utilities.

**Depends on**: Group 1

**Contract layer (`packages/backend-contract`)**

- Introduce shared string-buffer types to express constraints explicitly:
  - e.g. `FixedString<Max extends number>` (type-only) or a doc-commented `maxLen` parameter.
- Decide a consistent model for “array of strings output”:
  - Option A: return `string[]` and let the backend decide truncation/validation.
  - Option B: return `{ values: string[]; truncated: boolean }` for routines where truncation is possible.
  - This plan recommends **Option A** initially, but requires that backends throw if truncation would occur (to avoid silent corruption).

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Implement helpers for:
    - input string arrays → `std::vector<std::string>` → CSPICE `SpiceChar**` patterns
    - output string buffers (allocate `char[N]`, call CSPICE, return JS string)
  - Ensure consistent encoding: treat all strings as UTF-8 at the JS boundary, but note that CSPICE is effectively ASCII; non-ASCII should round-trip but may behave oddly.
- TS adapter:
  - For each routine added later that uses these conventions, enforce maxLen assumptions at the boundary.

**WASM backend layer (`packages/backend-wasm`)**

- Extend `packages/backend-wasm/src/codec/strings.ts`:
  - add helpers for writing string arrays into linear memory
  - add helpers for reading back N fixed-width strings from a packed buffer
- Add wrappers in `packages/backend-shim-c` when CSPICE expects `char[][len]` or `SpiceChar*` arrays.

**Concrete deliverables (files/areas to touch)**

- `packages/backend-wasm/src/codec/strings.ts`
- `packages/backend-node/native/src/napi_helpers.h` (or a new helper header) for string buffer utilities
- (As routines get added) domain modules across both backends

**Testing strategy**

- Add focused tests that validate:
  - correct decoding of NUL-terminated output buffers
  - correct behavior with embedded NULs (should be treated as terminators)
  - explicit handling of truncation (throw rather than silently truncating)

**Risks / edge cases**

- Off-by-one errors around NUL terminators.
- CSPICE expects fixed-width buffers in many calls; incorrect sizes can lead to either truncation or memory issues.

**Definition of Done**

- A documented convention exists for:
  - output strings
  - output string arrays
  - max buffer sizes
- Both backends share helpers that are exercised by tests.

---

## Group 4

**(Enabler D) Error system + status utilities**

**Purpose / unlocks**

- Make error behavior predictable across backends.
- Define (and enforce) the difference between:
  - “this routine can fail and should throw”
  - “this routine can fail to *find* something and should return `{found:false}`”

**Depends on**: Group 1

**Contract layer (`packages/backend-contract`)**

- Add a new `error` domain (e.g. `packages/backend-contract/src/domains/error.ts`) exposing a minimal, opinionated subset:
  - `failed()`, `reset()`, `getmsg()`, `setmsg()`, `sigerr()`
  - optionally `chkin()`/`chkout()` if we want to mirror SPICE tracing
- Document “throw vs Found(false)” rules in the contract.

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Ensure the addon’s global CSPICE error action is set to a mode compatible with JS exception propagation (current README notes this is already done).
  - Expose the error-domain routines.
  - Provide a consistent JS `Error` shape:
    - `message`: the long message (or a composite)
    - optionally include SPICE short message/code in properties (`spiceShort`, `spiceLong`, `spiceTrace`)
- TS adapter:
  - Normalize errors (if needed) via `packages/backend-node/src/codec/errors.ts`.

**WASM backend layer (`packages/backend-wasm`)**

- Implement a richer error mapping than the current `throwWasmSpiceError`:
  - include SPICE short/long messages separately if the shim provides them
  - attach a stable “SPICE error name” when possible
- Add shared helpers for routines that return a `found` flag to avoid duplicating logic.

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/error.ts` (new)
  - `packages/backend-contract/src/index.ts`
- Node:
  - `packages/backend-node/native/src/domains/error.{h,cc}` (new)
  - `packages/backend-node/src/domains/error.ts` (new)
  - `packages/backend-node/src/index.ts`
- WASM:
  - `packages/backend-shim-c/src/errors.c` (extend)
  - `packages/backend-wasm/src/codec/errors.ts` (extend)
  - `packages/backend-wasm/src/domains/error.ts` (new)
  - `scripts/build-backend-wasm.mjs` + `packages/backend-wasm/src/lowlevel/exports.ts`

**Testing strategy**

- Add tests that intentionally trigger a known SPICE error and assert:
  - both backends throw
  - error messages contain a recognizable short code (e.g. `NOLOADEDFILES`)
- Add tests that validate `{found:false}` behavior is preserved and does not throw for `Found`-style routines.
  - Existing examples: `bodn2c`, `frmnam`, etc.

**Risks / edge cases**

- SPICE error handling is global; routines can leave errors “latched” if not reset.
- WASM error strings must be copied before `_free`.

**Definition of Done**

- A documented, enforced policy exists for throw vs `{found:false}`.
- Both backends expose a minimal “error/status” API.
- Tests cover at least one thrown error and one `{found:false}` non-throwing path.

---

## Group 5

**Kernel pool read/write core**

**Purpose / unlocks**

- Provide kernel pool inspection and mutation APIs. Many “naming” and “time” routines become useful only once kernel pool variables can be queried.

**Depends on**: Groups 3, 4

**Contract layer (`packages/backend-contract`)**

- Add a `kernel-pool` domain (new file under `src/domains/`), with routines such as:
  - Read:
    - `gdpool`, `gipool`, `gcpool`
    - `gnpool` (names)
    - `dtpool` (metadata)
  - Write:
    - `pdpool`, `pipool`, `pcpool`
  - Control:
    - `swpool`, `cvpool`, `expool`
- Model return shapes explicitly:
  - `gdpool(name, start, room) -> Found<{ values: number[] }>` (or throw if SPICE errors)
  - `dtpool(name) -> Found<{ type: 'N'|'C'; n: number }>`

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Implement the above routines.
  - Use string-array/output-buffer utilities from Group 3 for returning names.
- TS adapter:
  - Validate that arrays returned are within `room` and that types match.

**WASM backend layer (`packages/backend-wasm`)**

- Shim C:
  - Wrap kernel pool getters using stable buffer layouts.
  - Pay special attention to `gcpool` (strings) which will use fixed-width buffers.
- TS adapter:
  - Decode output buffers into `string[]`.

**Concrete deliverables (files/areas to touch)**

- `packages/backend-contract/src/domains/kernel-pool.ts` (new)
- Node:
  - `packages/backend-node/native/src/domains/kernel_pool.*` (new)
  - `packages/backend-node/src/domains/kernel-pool.ts` (new)
- WASM:
  - `packages/backend-shim-c/src/domains/kernel_pool.c` (new)
  - `packages/backend-wasm/src/domains/kernel-pool.ts` (new)
  - export wiring (`build-backend-wasm.mjs`, `lowlevel/exports.ts`)

**Testing strategy**

- Use minimal kernels from `packages/tspice/test/fixtures/kernels/` (LSK) to verify:
  - pool variables exist after `furnsh`
  - getters return expected shapes
- Add parity tests for one numeric getter and one string getter.

**Risks / edge cases**

- Kernel pool variable typing and size rules can be confusing (`N` vs `C`, scalar vs array).
- Many getters require the caller to choose `start`/`room`; poor defaults can lead to truncated results.

**Definition of Done**

- Kernel pool read and write routines are available in both backends.
- At least one read + one write routine is covered by tests.

---

## Group 6

**IDs↔names & frame name utilities**

**Purpose / unlocks**

- Expand name/ID resolution utilities beyond the tiny core set.
- This unlocks better ergonomics for later ephemeris and frame routines.

**Depends on**: Group 5

**Contract layer (`packages/backend-contract`)**

- Extend existing domains:
  - `packages/backend-contract/src/domains/ids-names.ts`
  - `packages/backend-contract/src/domains/frames.ts`
- Add routines such as:
  - `bod*` family (beyond `bodn2c`/`bodc2n`): `bodc2s`, `bods2c`, `boddef`, `bodfnd`, `bodvar`
  - frame info: `frinfo`, `namfrm`/`frmnam` already exist
  - center/frame mapping helpers: `ccifrm`, `cidfrm`/`cnmfrm` already exist

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Add exports in `native/src/domains/ids_names.*` and `frames.*`.
  - Most of these routines use `found` flags and/or kernel pool; enforce Group 4 rules.
- TS adapter:
  - Extend `packages/backend-node/src/domains/ids-names.ts` and `frames.ts`.

**WASM backend layer (`packages/backend-wasm`)**

- Shim C additions for each routine.
- TS adapter additions using `tspiceCallFoundInt` / `tspiceCallFoundString` patterns.

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/ids-names.ts`
  - `packages/backend-contract/src/domains/frames.ts`
- Node:
  - `packages/backend-node/native/src/domains/ids_names.*`
  - `packages/backend-node/native/src/domains/frames.*`
  - `packages/backend-node/src/domains/ids-names.ts`
  - `packages/backend-node/src/domains/frames.ts`
- WASM:
  - `packages/backend-shim-c/src/domains/ids_names.c`
  - `packages/backend-shim-c/src/domains/frames.c`
  - `packages/backend-wasm/src/domains/ids-names.ts`
  - `packages/backend-wasm/src/domains/frames.ts`

**Testing strategy**

- Add tests that:
  - resolve built-in bodies/frames without needing extra kernels (where applicable)
  - resolve kernel-defined frames/bodies after loading LSK/PCK.

**Risks / edge cases**

- Some routines rely on kernel pool variables being present; tests must load the right kernels.
- Some conversions are case-sensitive / have surprising name normalization.

**Definition of Done**

- Contract surface includes the chosen additional ID/name routines.
- Both backends implement them with parity tests for at least a couple representative calls.

---

## Group 7

**Time expansions (non-core conversions)**

**Purpose / unlocks**

- Implement time routines that are needed for attitude, SPK coverage queries, and many mission kernels.

**Depends on**: Group 5

**Contract layer (`packages/backend-contract`)**

- Extend `packages/backend-contract/src/domains/time.ts` with:
  - delta/units:
    - `deltet`, `unitim`
  - parsing + formatting:
    - `tparse`, `tpictr`, `timdef`
  - SCLK helpers (beyond `scs2e`/`sce2s`):
    - `scencd`, `scdecd`, `sct2e`, `sce2c` (and any required support routines)
- Define which routines require loaded kernels (`LSK`, `SCLK`) and document in comments.

**Node backend layer (`packages/backend-node`)**

- Native addon: implement the new time routines in `native/src/domains/time.*`.
- TS adapter: extend `packages/backend-node/src/domains/time.ts` with invariant checks.

**WASM backend layer (`packages/backend-wasm`)**

- Shim + exports for each routine.
- TS adapter under `packages/backend-wasm/src/domains/time.ts`.

**Concrete deliverables (files/areas to touch)**

- `packages/backend-contract/src/domains/time.ts`
- `packages/backend-node/native/src/domains/time.*`
- `packages/backend-node/src/domains/time.ts`
- `packages/backend-shim-c/src/domains/time.c`
- `packages/backend-wasm/src/domains/time.ts`

**Testing strategy**

- Extend `packages/tspice/test/sclk-ck.test.ts` style tests:
  - ensure failures are meaningful when kernels are missing
  - verify roundtrips where possible (`scencd`/`scdecd`, `unitim` conversions)
- Add parity tests for a small subset (time tests are often deterministic and good parity candidates).

**Risks / edge cases**

- Time pictures and formatting are sensitive to locale/format strings.
- Some SCLK routines require mission-specific kernels; fixtures may need to grow.

**Definition of Done**

- Time domain expanded with documented kernel prerequisites.
- Representative tests exist in both backends (and ideally parity tests for at least one routine).

---

## Group 8

**Vector/matrix “bulk add” (no kernels required)**

**Purpose / unlocks**

- Add a large batch of pure-math SPICE primitives that do not require kernels.
- These are foundational helpers used widely in geometry and frame computations.

**Depends on**: Group 1

**Contract layer (`packages/backend-contract`)**

- Extend `packages/backend-contract/src/domains/coords-vectors.ts` with routines like:
  - vectors: `vadd`, `vsub`, `vminus`, `vscl`, `vdot` (already), `vcrss` (already), `vhat` (already)
  - matrices: `mxm`, `mxv` (already), `mtxv` (already)
  - rotations: `rotate`, `rotmat`, `axisar`
  - coordinate transforms: `georec`, `recgeo`, `recpgr`, `pgrrec`
  - derivative variants (`dv*` family) as a follow-up subset if desired

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Add the math routines to `native/src/domains/coords_vectors.*`.
  - Ensure all routines validate input sizes and numeric finiteness.
- TS adapter:
  - Extend `packages/backend-node/src/domains/coords-vectors.ts`.

**WASM backend layer (`packages/backend-wasm`)**

- Shim + exports for each routine.
- TS adapter:
  - Prefer reusable helpers rather than writing malloc boilerplate per routine.

**Concrete deliverables (files/areas to touch)**

- `packages/backend-contract/src/domains/coords-vectors.ts`
- `packages/backend-node/native/src/domains/coords_vectors.*`
- `packages/backend-wasm/src/domains/coords-vectors.ts`
- `packages/backend-shim-c/src/domains/coords_vectors.c`

**Testing strategy**

- Add deterministic unit tests with known expected outputs (no kernels):
  - vector arithmetic
  - identity matrix multiplications
  - rotation invariants (orthonormality)
- Extend or create parity tests comparing node vs wasm outputs within tolerances.

**Risks / edge cases**

- Floating point tolerance: tests should use `atol/rtol` (existing parity tests already do this).
- Zero-vector edge cases (some routines define special behavior, e.g. `vhat`).

**Definition of Done**

- A substantial batch of kernel-free primitives is implemented in both backends.
- Tests cover basic correctness and parity.

---

## Group 9

**Frame transforms & attitude (CK read-only first)**

**Purpose / unlocks**

- Frame transforms (`pxform`, `sxform`) are already present; this group expands frame/CK read-only coverage and the helper routines needed to work with CKs.

**Depends on**: Groups 5, 6, 7, 8

**Contract layer (`packages/backend-contract`)**

- Extend `packages/backend-contract/src/domains/frames.ts` with:
  - CK coverage/object query routines: `ckcov`, `ckobj`
  - CK file open/close for read-only access: `cklpf`, `ckupf`
  - Any additional frame transform helpers needed (`pxfrm2`, etc.) as follow-ups

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Implement CK read-only routines in `native/src/domains/frames.*`.
  - Use Group 2 (cells/windows) if returning coverage windows.
- TS adapter:
  - Extend `packages/backend-node/src/domains/frames.ts`.

**WASM backend layer (`packages/backend-wasm`)**

- Shim + exports for CK read-only routines.
- TS adapter:
  - For coverage APIs, decode windows using Group 2 conventions.

**Concrete deliverables (files/areas to touch)**

- Contract: `packages/backend-contract/src/domains/frames.ts`
- Node native: `packages/backend-node/native/src/domains/frames.*`
- WASM shim: `packages/backend-shim-c/src/domains/frames.c`
- TS adapters: `packages/backend-node/src/domains/frames.ts`, `packages/backend-wasm/src/domains/frames.ts`

**Testing strategy**

- Add a binary CK fixture (the repo currently has a TODO in `packages/tspice/test/sclk-ck.test.ts`).
  - Once a `.bc` fixture exists, add happy-path tests for `ckgp/ckgpav` and coverage routines.
- Add tests for failure behavior when CK is not loaded (already present).

**Risks / edge cases**

- CK coverage routines can return large windows; ensure window representation is efficient.
- Kernel prerequisites are more complex (LSK + SCLK + CK).

**Definition of Done**

- CK read-only APIs are implemented.
- Tests cover at least one happy-path CK query with a real binary CK.

---

## Group 10

**(Enabler C) File handles + DAF/DAS/DLA core**

**Purpose / unlocks**

- Provide the low-level file I/O substrate used by many “big subsystem” routines.
- Establish a unified handle/lifetime model usable across:
  - Node native addon
  - WASM shim

**Depends on**: Group 4

**Contract layer (`packages/backend-contract`)**

- Add a `file-io` domain with routines such as:
  - file presence/type helpers: `exists`, `getfat`, `rdtext`
  - DAF core: `dafopw`, `dafopr`, `dafcls`, `dafbfs`, `daffna`, `dafgda`, ...
  - DAS core: `dasopr`, `dasopw`, `dascls`, ...
  - DLA core: `dlaopn`, `dlabfs`, `dlafns`, ...
- Define a **handle type** in the contract:
  - Use a branded number type (`type SpiceHandle = number & { __brand: 'SpiceHandle' }`) to reduce accidental misuse.
  - Document lifetime rules: handles must be closed, and use-after-close is an error.

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - Implement a handle registry:
    - map CSPICE integer handles to JS-visible handles
    - enforce close-once semantics
  - Expose DAF/DAS/DLA routines.
- TS adapter:
  - Provide ergonomic wrappers:
    - `withHandle(...)` helpers that auto-close in a `finally`

**WASM backend layer (`packages/backend-wasm`)**

- Shim C:
  - Implement DAF/DAS/DLA wrappers that take/return integer handles and return error codes.
  - Ensure that “handle registry” rules are consistent with Node (even if the underlying storage differs).
- TS adapter:
  - Track handle state to prevent use-after-close (even if only best-effort).

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/file-io.ts` (new)
  - `packages/backend-contract/src/shared/types.ts` (handle branding)
- Node:
  - `packages/backend-node/native/src/domains/file_io.*` (new)
  - `packages/backend-node/src/domains/file-io.ts` (new)
- WASM:
  - `packages/backend-shim-c/src/domains/file_io.c` (new)
  - `scripts/build-backend-wasm.mjs` export list
  - `packages/backend-wasm/src/domains/file-io.ts` (new)

**Testing strategy**

- Add tests that:
  - open a file for read (e.g. an SPK) and close it
  - assert double-close throws
  - assert invalid handle usage throws
- For WASM, ensure tests cover both Node and browser-like module initialization paths where possible.

**Risks / edge cases**

- Handle leaks are easy to introduce in error paths.
- Some CSPICE file APIs mutate global state; error reset discipline matters.

**Definition of Done**

- A branded handle type exists in the contract.
- Both backends expose a small, tested, safe subset of DAF/DAS/DLA primitives.

---

## Group 11

**Kernel management “full” (beyond furnsh/kclear)**

**Purpose / unlocks**

- Move kernel management from “load/unload” into “introspect/inspect/iterate”:
  - `kinfo`, `kxtrct`, `kplfrm`, fully featured `kdata`
  - Support for extracting kernels and querying metadata.

**Depends on**: Groups 3, 4, 10

**Contract layer (`packages/backend-contract`)**

- Extend `packages/backend-contract/src/domains/kernels.ts`:
  - add `kinfo(path) -> Found<...>`
  - add `kxtrct(...)` (likely returns a handle or writes a file depending on backend)
  - add `kplfrm` / `kdata` expansions as needed
- Document backend-dependent behavior:
  - Node operates on OS filesystem
  - WASM operates on virtual FS (`/kernels/...`) via `packages/backend-wasm/src/runtime/fs.ts`

**Node backend layer (`packages/backend-node`)**

- Native addon: implement the CSPICE calls.
- TS adapter:
  - integrate with `packages/backend-node/src/runtime/kernel-staging.ts` so byte-backed kernels remain trackable.

**WASM backend layer (`packages/backend-wasm`)**

- Shim + exports.
- TS adapter:
  - ensure paths are normalized via `resolveKernelPath`.

**Concrete deliverables (files/areas to touch)**

- `packages/backend-contract/src/domains/kernels.ts`
- `packages/backend-node/native/src/domains/kernels.*`
- `packages/backend-node/src/domains/kernels.ts`
- `packages/backend-shim-c/src/domains/kernels.c`
- `packages/backend-wasm/src/domains/kernels.ts`

**Testing strategy**

- Extend existing kernel tests:
  - `packages/backend-node/test/kernels.test.ts`
  - `packages/backend-wasm/test/kernels.test.ts`
- Add tests for:
  - `kinfo` on a loaded kernel
  - iterating `kdata` results and verifying stable properties

**Risks / edge cases**

- Metadata string sizes can be larger than expected; output-buffer sizing is important.
- Differences between byte-backed kernel IDs and filesystem paths must remain clear.

**Definition of Done**

- Kernel management surface is expanded and documented.
- Tests confirm correct behavior in both backends.

---

## Group 12

**SPK read APIs + coverage/object queries**

**Purpose / unlocks**

- Expand SPK access beyond `spkezr`/`spkpos` to include lower-level readers and query routines.

**Depends on**: Groups 6, 7, 8, 10, 11

**Contract layer (`packages/backend-contract`)**

- Extend/add an SPK-focused domain (either extend `ephemeris.ts` or split into `ephemeris-spk.ts`):
  - state/position: `spkez`, `spkezp`, `spkgeo`, `spkgps`, `spkssb`
  - queries:
    - coverage: `spkcov`
    - object sets: `spkobj`
    - segment search/info: `spksfs`, `spkpds`, `spkuds`
- Model coverage/object results using Group 2’s `SpiceCell`/`SpiceWindow`.

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - implement the SPK routines
  - ensure query routines that fill cells/windows use the same cell allocation model introduced in Group 2
- TS adapter:
  - decode results into contract types

**WASM backend layer (`packages/backend-wasm`)**

- Shim wrappers for SPK calls; most are straightforward numeric IO, but coverage/object outputs require cells.

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/ephemeris.ts` (extend) and/or new `ephemeris-spk.ts`
  - `packages/backend-contract/src/index.ts`
- Node:
  - `packages/backend-node/native/src/domains/ephemeris.*`
  - `packages/backend-node/src/domains/ephemeris.ts`
- WASM:
  - `packages/backend-shim-c/src/domains/ephemeris.c`
  - `packages/backend-wasm/src/domains/ephemeris.ts`

**Testing strategy**

- Use the existing SPK kernel caching helper (`packages/tspice/test/helpers/kernels.ts`) to download a known SPK (e.g. `de440s.bsp`).
- Add tests that:
  - verify lower-level readers match `spkezr` results for a reference case
  - verify `spkcov` returns a non-empty window for a known target
  - verify `spkobj` returns known bodies for the kernel

**Risks / edge cases**

- Coverage windows can be huge; avoid copying more than necessary.
- Segment search routines can have tricky calling conventions; ensure `found` vs throw is correct.

**Definition of Done**

- A coherent SPK domain exists with both “compute” and “query” routines.
- Tests cover at least one compute routine and one query routine.

---

## Group 13

**Geometry “classic” (subpoints, intercepts, illumination)**

**Purpose / unlocks**

- Implement higher-level geometry routines used by real applications: subpoints, intercepts, illumination, occultations, and supporting primitives.

**Depends on**: Groups 5, 8, 9, 12

**Contract layer (`packages/backend-contract`)**

- Extend `packages/backend-contract/src/domains/geometry.ts`:
  - add additional illumination routines: `illumg`, `illumf`
  - add intercept/subpoint variants as needed
  - add plane/ellipse helpers: `nvc2pl`, `pl2nvc`, etc.
- Ensure return shapes are explicit and avoid out-params.

**Node backend layer (`packages/backend-node`)**

- Native addon: implement routines in `native/src/domains/geometry.*`.
- TS adapter:
  - enforce argument validation (vector lengths, finite numbers)
  - enforce `Found` semantics (e.g. intercept routines that may not find a surface hit)

**WASM backend layer (`packages/backend-wasm`)**

- Shim + exports.
- TS adapter: reuse malloc helpers; geometry calls often have many string args.

**Concrete deliverables (files/areas to touch)**

- `packages/backend-contract/src/domains/geometry.ts`
- `packages/backend-node/native/src/domains/geometry.*`
- `packages/backend-wasm/src/domains/geometry.ts`
- `packages/backend-shim-c/src/domains/geometry.c`

**Testing strategy**

- Use the same kernel set as the existing geometry tests, plus PCK/SPK as needed.
- Add scenario-based tests:
  - known illumination angles at a known point
  - intercept returns `{found:false}` for a ray that misses
- Add parity tests for at least one geometry routine with tolerances.

**Risks / edge cases**

- Many geometry routines are numerically sensitive and depend heavily on kernel choice.
- Methods strings (e.g. for `subpnt`) are easy to mistype; provide docs/examples.

**Definition of Done**

- Geometry domain expanded with classic routines.
- Tests cover both happy-path and `{found:false}` paths.

---

## Group 14

**GF event finding tranche 1 (infra + 1–2 search families)**

**Purpose / unlocks**

- Bring in the first slice of Geometry Finder (GF) capability.
- GF work tends to be large; this group intentionally limits scope to infra + a couple searches.

**Depends on**: Groups 2, 4, 12, 13

**Contract layer (`packages/backend-contract`)**

- Add a GF-focused domain (could live under geometry, e.g. `geometry-gf.ts`):
  - infrastructure: `gfstep`, `gfstol`, `gfrefn`, `gfrepf`, `gfrepi`, ...
  - one or two search families:
    - `gfsep` (angular separation)
    - `gfdist` (distance)
- Represent GF confinement and result windows using Group 2 `SpiceWindow`.

**Node backend layer (`packages/backend-node`)**

- Native addon: implement GF routines.
  - Ensure callbacks (if any) are not used in tranche 1; stick to routines that can be wrapped with simple inputs/outputs.
- TS adapter:
  - expose a “batteries included” wrapper (optional) that sets typical defaults (`step`, `tol`) to reduce boilerplate.

**WASM backend layer (`packages/backend-wasm`)**

- Shim wrappers must carefully manage memory; GF routines can fill large windows.

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/geometry-gf.ts` (new)
  - `packages/backend-contract/src/index.ts`
- Node:
  - `packages/backend-node/native/src/domains/geometry_gf.*` (new)
  - `packages/backend-node/src/domains/geometry-gf.ts` (new)
- WASM:
  - `packages/backend-shim-c/src/domains/geometry_gf.c` (new)
  - `packages/backend-wasm/src/domains/geometry-gf.ts` (new)

**Testing strategy**

- Add integration-style tests that:
  - load a known kernel set
  - run a small GF search over a short interval
  - assert the returned window is non-empty and well-formed

**Risks / edge cases**

- GF searches can be slow; tests need timeouts and may need to limit search windows.
- Numerical tolerance configuration is tricky; poor defaults yield empty or unstable results.

**Definition of Done**

- GF infra routines exist and are documented.
- At least one GF family (`gfsep` or `gfdist`) works end-to-end in both backends.

---

## Group 15

**Writers: SPK/CK/PCK (segment creation)**

**Purpose / unlocks**

- Enable creating kernel products (SPK/CK/PCK) from JS.
- This is a distinct tranche because it depends on file I/O substrate (Group 10) and has much higher risk.

**Depends on**: Groups 6, 7, 8, 10

**Contract layer (`packages/backend-contract`)**

- Add writer APIs with careful attention to backend differences:
  - Node can write to OS filesystem paths.
  - WASM writes into virtual FS (and will need a way to extract bytes back out).
- Suggested contract design:
  - functions accept either:
    - a path string (backend-dependent), or
    - a “virtual output” handle that can be read back.
- Routines:
  - SPK: `spkopn`, `spkopa`, `spkcls`, `spkw*`
  - CK: `ckopn`, `ckcls`, `ckw*`
  - PCK: `pckopn`, `pckcls`, `pckw02`

**Node backend layer (`packages/backend-node`)**

- Native addon: implement open/write/close.
- TS adapter:
  - provide `withSpkFile(...)` helpers to ensure closure.

**WASM backend layer (`packages/backend-wasm`)**

- Shim C: wrap writer routines.
- TS adapter:
  - add a “read back created file bytes” helper in `packages/backend-wasm/src/runtime/fs.ts` (if not already sufficient).

**Concrete deliverables (files/areas to touch)**

- Contract: new/extended ephemeris + frames + pck domains.
- Node: native domains + TS adapters.
- WASM: shim domains + TS adapters + fs extraction helpers.

**Testing strategy**

- Add tests that:
  - create a minimal kernel segment
  - close it
  - re-open and query metadata to prove it is valid
- For WASM, verify that written files can be extracted from virtual FS as bytes.

**Risks / edge cases**

- Writer APIs are easy to misuse; incorrect inputs can generate invalid kernels.
- File formats are strict; tests should validate with SPICE readers.

**Definition of Done**

- At least one writer path (e.g. minimal SPK) works end-to-end in both backends.
- Tests validate written output by reading it back through SPICE.

---

## Group 16

**DSK + EK “big subsystems” (split further)**

**Purpose / unlocks**

- Implement two large CSPICE subsystems that have heavy marshalling needs:
  - DSK (Digital Shape Kernel)
  - EK (Events Kernel)

**Depends on**: Groups 2, 3, 4, 10

**Recommended split**

Even though the proposal lists this as one group, it is likely too big. A practical split:

- **16a: DSK read/query subset** (depends on 2,4,10)
- **16b: DSK writers** (depends on 2,4,10 and likely more math helpers)
- **16c: EK open/metadata** (depends on 3,4,10)
- **16d: EK query/data ops + fast write** (depends on 3,4,10)

**Contract layer (`packages/backend-contract`)**

- Add new domains:
  - `dsk.ts` with:
    - read/query: `dskobj`, `dsksrf`, `dskgd`, `dskb02`, ...
    - writer follow-up: `dskopn`, `dskw02`, `dskmi2`
  - `ek.ts` with:
    - open/close: `ekop*`
    - metadata: `ekntab`, `ektnam`, `eknseg`
    - query/data: `ekfind`, `ekgc`, `ekgd`, `ekgi`
    - fast write: `ekifld`, `ekffld`
- Use Group 3 string-array conventions heavily (EK metadata often returns string lists).

**Node backend layer (`packages/backend-node`)**

- Native addon:
  - implement DSK/EK wrappers in separate native domains for reviewability.
  - Use handle substrate from Group 10 for EK/DSK file handles.

**WASM backend layer (`packages/backend-wasm`)**

- Shim C:
  - add separate C files for DSK and EK to keep exported surface manageable.
- TS adapter:
  - DSK often involves bulk numeric buffers; prefer typed arrays + shared memory views.

**Concrete deliverables (files/areas to touch)**

- Contract:
  - `packages/backend-contract/src/domains/dsk.ts` (new)
  - `packages/backend-contract/src/domains/ek.ts` (new)
  - `packages/backend-contract/src/index.ts`
- Node:
  - `packages/backend-node/native/src/domains/dsk.*` (new)
  - `packages/backend-node/native/src/domains/ek.*` (new)
  - TS adapters under `packages/backend-node/src/domains/`
- WASM:
  - `packages/backend-shim-c/src/domains/dsk.c` (new)
  - `packages/backend-shim-c/src/domains/ek.c` (new)
  - `packages/backend-wasm/src/domains/dsk.ts` + `ek.ts` (new)

**Testing strategy**

- Add fixture kernels appropriate for each subsystem:
  - a small DSK sample (or download/cached fixture)
  - a small EK sample
- For writers, prefer roundtrip tests:
  - write minimal EK/DSK
  - read it back and assert metadata

**Risks / edge cases**

- These APIs tend to be large and under-documented; expect iteration.
- Performance/memory pressure is real, especially in WASM.

**Definition of Done**

- The subsystem is split into PR-sized subgroups (16a/16b/16c/16d) with at least one merged.
- At least one DSK and one EK “read/query” API works in both backends with tests.

