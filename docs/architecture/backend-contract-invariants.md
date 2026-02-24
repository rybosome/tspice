# Backend contract invariants (`SpiceBackend`, raw, and parity)

This document records the owner-approved invariants for the pre-`0.1.0` strict/fast backend cleanup (issue #524).

## Decisions (owner-approved)

1. **1:1 analogue requirement**
   - A `SpiceBackend` method is a **1:1 analogue** only when there is a single obvious CSPICE function in toolkit docs we would link to, **and** that is what `backend-node` / `backend-wasm` actually call.
   - If a helper is not a 1:1 analogue, it does **not** belong on `SpiceBackend` (or `spice.raw`).

2. **`.kind` ownership**
   - `kind` belongs to the higher-level `Spice` / `SpiceAsync` client object.
   - `SpiceBackend` (the raw backend contract) does **not** own `kind`.
   - `spice.kind` is the supported metadata location; `spice.raw.kind` is intentionally hidden.

3. **Rollout policy: strict/fast (breaking)**
   - Before `0.1.0`, we prefer a single breaking cleanup pass over compatibility shims in `raw`.
   - Non-analogue helpers may remain available via higher-level `kit` APIs where needed for ergonomics / existing runtime behavior.

## Package boundary rule: `packages/backend-contract` is contracts-only

`packages/backend-contract` is the **declaration layer** for backend interop and parity:

- allowed: **types, interfaces, constants, declarations**
- not allowed: runtime helper logic, runtime validators, branding helpers, handle registries, normalization utilities, convenience wrappers

Runtime/helper implementations belong in runtime packages (currently `packages/core`, or another shared runtime package if a better fit emerges).

## Raw vs kit placement (strict/fast cleanup)

These helpers were removed from `SpiceBackend` / `spice.raw` and are now exposed via `spice.kit`:

- cell/window helper alloc/free/read helpers (`newIntCell`, `newDoubleCell`, `newCharCell`, `newWindow`, `freeCell`, `freeWindow`, `cellGeti`, `cellGetd`, `cellGetc`)
- `spiceVersion`
- `readVirtualOutput`

Rationale: they are useful runtime conveniences, but they are not 1:1 CSPICE analogues.

## Parity guardrail (contract classification)

Every `SpiceBackend` member must be classified as exactly one of:

- present in the checked-in CSPICE inventory (`data/cspice-functions.json`), matched case-insensitively by canonical routine name, or
- present in a checked-in allowlist with rationale (`packages/backend-contract/config/spicebackend-cspice-allowlist.json`)

The guardrail intentionally checks **all** member names (including camelCase / non-lowercase names) so helper methods cannot bypass classification by naming convention.
