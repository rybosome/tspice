# Existing raw parity audit

Step 7 covers the contract-present baseline recorded at `3f950ae22993aaf9a629263a12388bf56894879c`. The [generated ledger](coverage-ledger.md#maintained-semantic-audit) lists every routine, its batch, dependencies, PRs, next action, and per-backend progress. Expansion remains separate.

## Maintained inputs

`data/parity-audits/baseline.json` assigns the entire baseline to bounded batches. Each reviewed batch has a same-named JSON file. This keeps independent reviews in separate files. The generator rejects missing assignments, removed routines/cases, duplicates, cyclic dependencies, missing evidence, conflicting route classifications, invalid status transitions, and unsupported completion claims.

A routine review records the contract, primary NAIF reference, semantics, exact scenario IDs and observed results/effects, success/edge/error assessments, fixture provenance, cleanup, numeric comparison rationale, and findings/repair evidence. Its Node and WASM judgments separately record route, trace, status history, and execution references. `reviewed` means a human examined this evidence; it does not mean the backend is verified. `needs-repair` remains distinct. A repaired finding must point to existing repair/test evidence and registered scenarios.

`verified` requires meaningful success evidence, no open findings, a PR reference, and both local and observed CI execution for that backend covering every reviewed scenario. An unsupported raw implementation cannot be verified through a harness fallback. Error-free routines can explain why CSPICE error scenarios are inapplicable rather than inventing them.

## Recording verification

Execution records are maintained observations, not inferred from CI configuration or scenario registration. Record the command, backend, native-required flag where applicable, successful scenario IDs, result summary, and SHA-256 source digest. CI observations also need the actual successful job URL and tested commit. Inspect logs for executed cases and absence of unexpected skips before recording success. Local observations describe the run result; durable CI links provide independently inspectable execution evidence.

`auditSourceDigest(root, record, routines)` in `scripts/coverage-ledger/audits.mjs` hashes the batch's contract/backend/native/shim source, all registered case files, checked-in WASM binary, comparator, parity entrypoint, locked oracle dependencies, fixture files, and explicitly reviewed harness trace files. Compute the digest after formatting and validation. A changed input invalidates current recorded executions until rerun and explicitly re-recorded. Preserve prior observations with `historical: true`; historical executions cannot satisfy current verification. This is a drift guard over recorded inputs; it is not an automatic assertion-quality judgment or proof that a human execution claim is true.

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
