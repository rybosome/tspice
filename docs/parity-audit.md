# Existing raw parity audit

Step 7 covers the contract-present baseline recorded at `3f950ae22993aaf9a629263a12388bf56894879c`. The [generated ledger](coverage-ledger.md#maintained-semantic-audit) lists every routine, its batch, dependencies, PRs, next action, and per-backend progress. Expansion remains separate.

## Maintained inputs

`data/parity-audits/baseline.json` assigns the entire baseline to bounded batches. Each reviewed batch has a same-named JSON file. This keeps independent reviews in separate files. The generator rejects missing assignments, removed routines/cases, duplicates, cyclic dependencies, missing evidence, conflicting route classifications, invalid status transitions, and unsupported completion claims.

A routine review records the contract, primary NAIF reference, semantics, exact scenario IDs and observed results/effects, success/edge/error assessments, fixture provenance, cleanup, numeric comparison rationale, and findings/repair evidence. Its Node and WASM judgments separately record route, trace, status history, and execution references. `reviewed` means a human examined this evidence; it does not mean the backend is verified. `needs-repair` remains distinct. A repaired finding must point to existing repair/test evidence and registered scenarios.

`verified` requires meaningful success evidence, no open findings, a PR reference, and both local and observed CI execution for that backend covering every reviewed scenario. An unsupported raw implementation cannot be verified through a harness fallback. Error-free routines can explain why CSPICE error scenarios are inapplicable rather than inventing them.

## Step 8 expansion

The same maintained evidence and acceptance rules apply to new raw routines.
`baseline.json` retains the original Step 7 `batches` and baseline commit;
its additive `expansionBatches` assigns newly contract-present routines without
rewriting that historical denominator. Both sets must be disjoint and together
cover the current raw contract. Planned routines live only in the
[expansion queue](step8-expansion.md), where open PRs remain distinct from landed work.
Adding an expansion assignment alone does not certify a routine. Its same-named
record must supply the same semantic review and source-bound Node/WASM execution.

## Vector basics expansion

The A08 record reviews `vdist_c`, `vequ_c`, `vpack_c`, `vupack_c`, `vzero_c`,
`unorm_c`, `ucrss_c`, and `vsep_c`. Its 32 registered workflows make 70 actual
routine calls per backend, retaining every result component. Copy/pack/unpack
extremes receive an additional exact live comparison; signed zero is checked
separately because ordinary JSON parity does not certify its sign. Scaled norm,
distance and near-parallel angle assertions make small nonzero results
observable. A scoped live probe preserves and compares nonfinite output classes
without changing the shared comparator.

The first `ucrss` run exposed a compiler-dependent residual for a mathematically
parallel pair. The [numerical investigation](step8-vector-numerics.md) preserves
the original inputs, observed results and source/compiler evidence. Exact-zero
parity uses dyadic parallel/opposed vectors; mixed, scaled, handedness and
near-parallel cases remain. This repairs the assertion's conditioning assumption
and records a numerical limit of direct CSPICE builds; it does not establish
identical results at ill-conditioned parallel or near-parallel inputs. No routine
is excluded and the global
tolerance is unchanged.

Real-backend argument/recovery checks, native result-shape checks, and WASM
allocation rollback tests cover the wrapper boundary. These are assertion-source
descriptions, not execution claims. The audit remains `reviewed` until fresh
source-bound local and observed canonical CI evidence satisfies the normal
verification requirements. Prior Step 7 observations remain historical on this
branch.

## Recording verification

Execution records are maintained observations, not inferred from CI configuration or scenario registration. Record the command, backend, native-required flag where applicable, successful scenario IDs, result summary, and SHA-256 source digest. CI observations also need the actual successful job URL and tested commit. Inspect logs for executed cases and absence of unexpected skips before recording success. Local observations describe the run result; durable CI links provide independently inspectable execution evidence.

`auditSourceDigest(root, record, routines)` in `scripts/coverage-ledger/audits.mjs` hashes the batch's contract/backend/native/shim source, all registered case files, checked-in WASM binary, comparator, parity entrypoint, locked oracle dependencies, fixture files, finding/repair assertion evidence, and explicitly reviewed harness trace files. Compute the digest after formatting and validation. A changed input invalidates current recorded executions until rerun and explicitly re-recorded. Preserve prior observations with `historical: true`; historical executions cannot satisfy current verification. This is a drift guard over recorded inputs; it is not an automatic assertion-quality judgment or proof that a human execution claim is true.

After editing an audit or case, run:

```bash
pnpm generate:coverage-ledger
pnpm test:coverage-ledger
pnpm check:coverage-ledger
pnpm run check:js:required
TSPICE_EXPECT_NATIVE=true pnpm run check:native:required
```

Keep CI observations tied to the tested source digest; editing audit metadata alone does not change it. Do not mark CI configuration or a historical run against different sources as a successful current verification. When a shared harness/implementation changes, rerun affected batch evidence before preserving its completion status.

## Vector arithmetic pilot

The initial pilot reviews `vadd_c`, `vcrss_c`, `vdot_c`, `vhat_c`, `vminus_c`, `vnorm_c`, `vscl_c`, and `vsub_c`. Eleven additional scenarios cover nonzero normalization (previously absent), wide dynamic range, mixed/reversed operands, cancellation, orthogonality, parallel/zero vectors, and fractional/zero scales. Every scalar or vector component reaches the normal live SpiceyPy comparison. These authored mathematical inputs require no kernels or external scientific data. NAIF documents these routines as error-free for their ordinary finite inputs; the audit records that rationale separately from JavaScript argument validation.

## File-handle prerequisite

The file-reader review reproduced foreign-handle acceptance on actual WASM
backends: each registry started at ID 1, so a foreign token selected an unrelated
local DAF/DAS file. File registries now share the existing host-realm opaque token
issuer with WASM cells/windows and keep owner-local token maps. IDs are never
reused in that realm, exceed uint32, and are resolved to original signed CSPICE
handles at every compiled boundary. The old global symbol key is retained so
separately loaded package copies share the sequence. This change claims no new
semantically completed routines by itself; the file/EK/ephemeris batches have
separate individual semantic records and live evidence in the generated ledger. It does not change worker transport or make tokens
portable between realms.

`file-handle-ownership.test.ts` exercises real public Node/WASM backends for DAF
and DAS reads/closes and rejects cell/file category confusion. Core tests cover
all five registry kinds, native-close failure/retry and stale-token rejection.
This reuses the #684 cell identity mechanism; no C/WASM regeneration is needed.

## Error-state observations

Error workflows can set `capture: true` on the existing `error.sigerr` step. This calls actual `raw.sigerr`, requires a structured SPICE exception, and compares its complete short/long/trace fields plus `raw.failed()` after the backend's automatic reset. No-op signaling and unrelated exceptions fail capture. The oracle calls actual `sp.sigerr`, reads full-size CSPICE buffers, and explicitly resets in `finally` to model the documented shim policy. Other steps continue normally, so stack changes, prepared messages, reset and repeated recovery have observable effects. This internal workflow option does not change public raw semantics.

Both backends reset signaled errors before throwing. A persistent true failure flag cannot be reached through these raw operations alone; the audit records that limitation instead of injecting an artificial flag or claiming a constant-false implementation is fully distinguished by live workflows. The case handlers track caller-managed traceback entries and unwind remaining names in reverse order on success/error; reset alone does not remove them. Leading diagnostic blanks are significant; only trailing CSPICE padding is removed.
