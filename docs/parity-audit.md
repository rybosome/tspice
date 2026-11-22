# Existing raw parity audit

Step 7 covers the contract-present baseline recorded at `3f950ae22993aaf9a629263a12388bf56894879c`. The [generated ledger](coverage-ledger.md#maintained-semantic-audit) lists every routine, its batch, dependencies, PRs, next action, and per-backend progress. The additive expansion table tracks Step 8 separately from the baseline.

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

## Vector combinations expansion

The A09 record reviews `vlcom_c`, `vlcom3_c`, `vperp_c`, `vproj_c`, `vrel_c`,
`vrotv_c`, `rotvec_c`, and `vtmv_c`. Its 38 registered scenarios make 99 actual
routine calls per backend. Unequal coefficients, reversed vectors, basis
directions, signed/modulo axes and nonsymmetric matrices distinguish argument
order, rotation convention and row-major layout. All output components reach
the independent live oracle comparison.

Focused comparisons rescale tiny linear/projection/perpendicular results and a
small relative difference before comparing complete outputs to the live oracle.
Zero-axis copies receive separate exact literal and signed-zero checks. A scoped
15-observation live test retains finite and nonfinite result components without
changing the shared comparator. Real-backend argument/recovery tests, native
result-shape checks, and 41 WASM allocation failure/success cleanup tests cover
the wrapper boundary. These describe assertion source; execution claims require
the maintained evidence records.

The [numerical observations](step8-vector-combinations-numerics.md) document the
`vperp` zero-reference discrepancy between NAIF prose and the pinned source/live
oracle, along with finite-input extremes. The raw contract preserves the actual
routine and states the caveat. No scientific implementation or oracle output is
substituted, and no routine is excluded. The audit remains `reviewed` pending
fresh source-bound local and observed canonical CI evidence. Prior Step 7
executions remain historical on this branch.

## Coordinate conventions expansion

A06 adds seven routines without changing the immutable 162-routine Step 7
baseline. Its 57 registered scenarios contain 152 new-routine calls and 36
existing state-control steps. Independent angle flags, RA branches, body aliases,
PM/longitude overrides, signed flattening, planetocentric radii and genuine SPICE
errors receive routine-specific observations. All prior executions are historical
until source-bound required local and canonical CI evidence is recorded.

The [coordinate review](step8-coordinate-conventions.md) records the pinned
Moon/Sun PM lookup prerequisite, authored fixture provenance and cleanup, and
ten scoped finite-input extreme observations. Tiny distance/RA comparisons are
rescaled in focused live tests; global tolerance remains unchanged. The
[batch audit](../data/parity-audits/a06-coordinate-conventions.json) traces both
actual raw backends, independent oracle decode/dispatch, native wrapper and WASM
allocation tests, and state lifecycle code. Reviews alone do not claim verification.

## Scalar math expansion

A03 adds nine routines alongside the unchanged original 162-routine baseline.
Its 47 registered scenarios contain 373 actual routine calls, including seven
genuine conversion errors. Four min/max functions have no top-level SpiceyPy
wrappers; the new independent ctypes binding calls the actual locked library's
canonical symbols with exact fixed-count/scalar-varargs ABI. Every supported
arity 0..30 is exercised. Defined-input `sumai` results still come from CSPICE;
unsafe signed prefixes are separate wrapper-safety checks, never oracle calls
into undefined C behavior.

The [scalar review](step8-scalar-math.md) records exact source/ABI evidence,
conversion-table restrictions, ordered floating arithmetic, signed-zero probes,
and allocation/count boundaries. The
[batch audit](../data/parity-audits/a03-scalar-math.json) traces actual raw paths,
independent oracle handlers, models/decoder, and focused tests. Old executions
remain historical until fresh source-bound required local and canonical CI
observations are recorded; review alone is not verification.

## State derivatives expansion

A11 reviews six direct state-derivative routines: `ducrss`, `dvcrss`, `dvdot`,
`dvhat`, `dvnorm` and `dvsep`. The 39 registered scenarios contain 106 actual
routine calls, including two genuine `dvsep` numeric-overflow errors. Inputs
are authored readonly six-component states; all output position/derivative
entries or scalar values reach the actual locked SpiceyPy wrappers.

[State derivative evidence](step8-state-derivatives.md) records the pinned
whole-state scaling behind `ducrss`'s zero-cross derivative, `dvhat`'s copied
zero-position derivative, and `dvsep`'s guarded division and normalization
conditioning. Caller overflow restrictions for `ducrss`/`dvdot` remain intact.
Twelve separate tagged observations preserve complete finite/nonfinite outputs
and signed zeros for the unrestricted routines, with finite controls. Focused
live rescaling keeps tiny derivatives observable; no global tolerance changes.
The narrow WASM error-test allocation repair counts existing structured
short/long/trace buffers without changing production or scientific assertions.

The original 162-routine assignment remains immutable; only these six routines
are added as this branch's expansion. All earlier executions are historical and
all judgments remain `reviewed` until fresh required local and observed canonical
CI evidence is recorded against the final source digest.

## Polynomial expansions

A16 reviews `chbder`, `chbigr`, `chbint`, `chbval`, `polyds` and `rquad`.
Their 46 registered scenarios contain 131 actual routine calls, including five
genuine degree/radius/degenerate-equation errors. Inferred degree preserves the
full readonly coefficient array; every derivative, integral and ordered complex
root field reaches comparison. No kernels or external fixtures are needed.

[Polynomial evidence](step8-polynomial-expansions.md) records normalized
reliable-use domains, source-derived count/workspace bounds, complete numerical
outputs and the narrow negative-order `polyds` oracle binding. That independent
route invokes the actual locked symbol with guarded no-write storage; other
calls stay on SpiceyPy. The actual `INVALIDDEGREE` error spelling is retained
despite the header typo. Sixteen tagged observations per backend preserve
nonfinite outputs and signed zeros within normalized Chebyshev domains, with
finite controls and focused rescaling; no global tolerance change is made.
The pinned `rquad_c` checkout-name typo can also print a device-dependent
diagnostic. Dedicated repeated primary-error/caller-stack observations close
that evidence gap while documenting the unchanged upstream output limitation.
Allocation, ownership, error recovery and actual codec/structured-clone checks
are distinct from scientific and browser-startup evidence.

The original 162-routine assignment remains immutable; only these six routines
are added on this branch. Earlier executions remain historical and all judgments
remain `reviewed` until fresh required local and observed canonical CI evidence
is recorded against the final source digest.

## Fixed matrices expansion

The A12 record reviews `det_c`, `diags2_c`, `ident_c`, `invert_c`, `invort_c`,
`isrot_c`, `mequ_c`, `mtxm_c`, `mxmt_c`, `trace_c`, and `xpose_c`. Its 50
registered scenarios make 95 new-routine calls plus one `error.reset` control per
backend. Eight calls exercise genuine column or tolerance errors; every matrix
entry and both `diags2` outputs remain observable. Nonsymmetric operands,
threshold signs/boundaries, ignored lower-triangle entries and independent
tolerance parameters distinguish the underlying scientific contracts.

Focused tests compare exact identity/copy/transpose outputs to the live oracle
and rescale tiny determinants, traces, eigenvalues and inverse entries. A scoped
14-observation live test retains every nonfinite output alongside finite
controls. The narrow `brandMat3RowMajorResult` helper owns and brands nine numeric
result entries while leaving existing finite input validation unchanged. Its
six source tests cover nonfinite values, signed zero, ownership, malformed data,
freezing and the unchanged input boundary. Native boundary tests and 46 WASM
allocation failure/success checks cover the compiled adapters.

A focused regression takes actual Node/WASM `invert`, `mtxm`, `mequ` and
`diags2` results through the existing RPC codec and `structuredClone` on a
connected test worker pair. It observes complete NaN/infinity, signed-zero and
multi-matrix outputs. This tests the transport representation boundary; it does
not claim browser worker startup or asset delivery.

The [numerical review](step8-fixed-matrix-numerics.md) records the pinned-source
semantics, independent oracle observations and the signed-zero recovery
assertion repair. These descriptions and local progress do not establish final
verification: A12 remains `reviewed` until fresh source-bound local and observed
canonical CI evidence is recorded. The original Step 7 observations remain
historical on this branch.

## General vectors expansion

A10 reviews fifteen general-dimensional routines in the existing coordinate
API: `vaddg`, `vdistg`, `vdotg`, `vequg`, `vhatg`, `vlcomg`, `vminug`, `vnormg`,
`vprojg`, `vrelg`, `vsclg`, `vsepg`, `vsubg`, `vzerog` and `unormg`. Their 82
registered scenarios contain 205 actual new-routine calls across empty,
singleton and larger dimensions. Every output component and both `unormg`
fields reach independent comparison. No kernels or external fixtures are needed.

[General-vector evidence](step8-general-vectors.md) explains the pinned empty
results, safe dimensions, nine repaired SpiceyPy zero-length output conversions,
and source-specific numerical limits. The independent repair calls exact
canonical symbols in the locked library only for empty vector results; ordinary
nonempty calls remain on SpiceyPy. Separate tagged comparisons retain all fields
for 22 extreme/signed-zero observations per backend, without changing the normal
comparator. Allocation, guard, ownership and real RPC codec/structured-clone
checks are distinct from scientific comparisons and browser startup claims.

The immutable original 162-routine assignment remains intact. This branch adds
only A10's fifteen routines. Historical Step 7 executions cannot verify changed
sources; all judgments remain `reviewed` until fresh required local and observed
canonical CI records are attached to the final source digest.

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

## Validated input snapshots

`reccyl_c` now marshals the same entries that the typed adapters validated.
Copy the three validated rectangular components once into an owned tuple; dispatch the tuple to native or WASM. Scalar-input coordinate routines are unchanged. The focused public boundary regression compares single-read inputs with ordinary arrays on both real backends; unchanged registered cases retain the independent scientific oracle.

Regression evidence: [owned-numeric-inputs.test.ts](../packages/py-parity-checking/test/owned-numeric-inputs.test.ts).

`vdist_c`, `vequ_c`, `vupack_c`, `vzero_c`, `unorm_c`, `ucrss_c`, `vsep_c` now marshal the same entries that the typed adapters validated.
Read each of the three vector components once into an owned fixed-length input. Both native delegation and WASM marshaling use the validated snapshot. Bounded entry-read and ownership regressions check this adapter property independently of unchanged scientific cases.

Regression evidence: [vector-basics-domain.test.ts](../packages/backend-node/test/vector-basics-domain.test.ts), [vector-basics-allocations.test.ts](../packages/backend-wasm/test/vector-basics-allocations.test.ts).

`vlcom_c`, `vlcom3_c`, `vperp_c`, `vproj_c`, `vrel_c`, `vrotv_c`, `rotvec_c`, `vtmv_c` now marshal the same entries that the typed adapters validated.
Capture each three-vector and, for vtmv, all nine row-major matrix entries into owned inputs. Both native delegation and WASM marshaling use the validated snapshot. Bounded entry-read and ownership regressions check this adapter property independently of unchanged scientific cases.

Regression evidence: [vector-combinations-domain.test.ts](../packages/backend-node/test/vector-combinations-domain.test.ts), [vector-combinations-allocations.test.ts](../packages/backend-wasm/test/vector-combinations-allocations.test.ts).

`recazl_c`, `recpgr_c`, `recrad_c` now marshal the same entries that the typed adapters validated.
Copy each validated rectangular coordinate once into an owned three-vector and dispatch only that vector. Keep flag, body-name and ellipsoid semantics unchanged. The focused public boundary regression compares single-read inputs with ordinary arrays on both real backends; unchanged registered cases retain the independent scientific oracle.

`sumad_c`, `sumai_c`, `maxd_c`, `maxi_c`, `mind_c`, `mini_c` now marshal the same entries that the typed adapters validated.
Capture the input count, copy each finite or signed32 entry once, validate the sumai prefix using the owned copy and send the same values to the canonical reduction. Scalar clamp/conversion methods have no array input. The focused public boundary regression compares single-read inputs with ordinary arrays on both real backends; unchanged registered cases retain the independent scientific oracle.

`ducrss_c`, `dvcrss_c`, `dvdot_c`, `dvhat_c`, `dvnorm_c`, `dvsep_c` now marshal the same entries that the typed adapters validated.
Copy each of the six finite state components once into an owned position/velocity tuple before dispatch. Preserve the original state layout and scientific derivative algorithms. The focused public boundary regression compares single-read inputs with ordinary arrays on both real backends; unchanged registered cases retain the independent scientific oracle.

Regression evidence: [owned-numeric-inputs.test.ts](../packages/py-parity-checking/test/owned-numeric-inputs.test.ts).

`det_c`, `diags2_c`, `invert_c`, `invort_c`, `isrot_c`, `mequ_c`, `mtxm_c`, `mxmt_c`, `trace_c`, `xpose_c` now marshal the same entries that the typed adapters validated.
Capture each four- or nine-entry row-major matrix into an owned input. Keep the existing structural input acceptance, result branding and IEEE output behavior. Both native delegation and WASM marshaling use the validated snapshot. Bounded entry-read and ownership regressions check this adapter property independently of unchanged scientific cases.

Regression evidence: [fixed-matrices-domain.test.ts](../packages/backend-node/test/fixed-matrices-domain.test.ts), [fixed-matrices-allocations.test.ts](../packages/backend-wasm/test/fixed-matrices-allocations.test.ts).

`vaddg_c`, `vdistg_c`, `vdotg_c`, `vequg_c`, `vhatg_c`, `vlcomg_c`, `vminug_c`, `vnormg_c`, `vprojg_c`, `vrelg_c`, `vsclg_c`, `vsepg_c`, `vsubg_c`, `vzerog_c`, `unormg_c` now marshal the same entries that the typed adapters validated.
Capture dimensions, enforce routine-specific count bounds and equal lengths where required, then copy each finite general-vector component once. Use the owned copies for dispatch, buffer sizes and output-length checks. Both native delegation and WASM marshaling use the validated snapshot. Bounded entry-read and ownership regressions check this adapter property independently of unchanged scientific cases.

Regression evidence: [general-vectors-domain.test.ts](../packages/backend-node/test/general-vectors-domain.test.ts), [general-vectors-allocations.test.ts](../packages/backend-wasm/test/general-vectors-allocations.test.ts), [general-vector-input-snapshots.test.ts](../packages/backend-wasm/test/general-vector-input-snapshots.test.ts). These adapter checks do not replace
the independent scientific workflows. Earlier executions remain historical on
their recorded fingerprints; both required local lanes and observed canonical CI
must run on the corrected source before current verification.

The five polynomial array-input methods now marshal validated owned snapshots.
Their [boundary regressions](step8-polynomial-expansions.md#stable-coefficient-and-transformation-inputs)
are separate from the unchanged scientific observations. Earlier executions
remain historical; the corrected source needs fresh required local and CI
records before either backend can be called verified.

## Interpolation

The [A17 source review](step8-interpolation.md) covers Hermite and Lagrange
sample layouts, derivative units, midpoint endpoint-vector estimates, hidden
workspace limits and scientific error recovery. Its six direct raw routes add
53 registered scenarios / 132 canonical calls (11 genuine errors) to the
unchanged 162-routine baseline. The review records the native validated-count
copy repair. Prior-baseline executions are historical; final verification
requires fresh required local lanes and observed CI for the current source.

## Array storage

A04 adds six direct canonical array clear, fill and move routines. Its 35
registered workflows make 92 calls to the independent pinned library,
including three expected character-row size errors. The audit covers the
complete returned destination, unchanged storage outside the written prefix,
typed memory, scoped IEEE comparisons and the caller precondition on the
pinned move implementation. [Array-storage evidence](step8-array-storage.md)

## Rotation representations

A14 adds seven scientific methods on the exact A12 matrix branch. The
two expansion assignments remain separate. The combined source requires
new full validation records for each backend. The Euler constructor uses
the actual linked SPICELIB implementation with defined error handling.
[Matrix, quaternion, Euler and axis conventions](step8-rotation-representations.md)

## General matrices

Eight row-major operations add 60 registered workflows and 132 explicit calls.
The independent oracle preserves rectangular, empty and supported signed
dimensions. Public tests compare every element, owned output, transpose and
product composition, and exceptional floating-point results.
[Matrix contracts and numerical observations](step8-general-matrices.md)

## Frame algebra

The A15 review covers nine kernel-independent frame construction and state-transform methods. The 47 registered workflows contain 129 calls and 17 expected toolkit errors. The review tracks full row-major blocks, angular-velocity coordinates, both Euler uniqueness states and the linked-toolkit checks required for three failure paths. [Frame algebra evidence](step8-frame-algebra.md) [Routine audit](../data/parity-audits/a15-frame-algebra.json)

## Coordinate derivatives

A07 covers twelve coordinate Jacobians. The source review records two pinned exception paths, independent directional derivatives, exact buffer ownership and tabulated body conventions. [Scientific and representation evidence](step8-coordinate-jacobians.md) [Per-routine records](../data/parity-audits/a07-coordinate-jacobians.json)

## String transformations and matching

A18 covers eight byte-oriented CSPICE methods. Its 64 registered workflows make
274 canonical calls, including 12 expected SPICE errors. The independent oracle
reads exact C buffers for the three string results, retaining trailing whitespace
and exposing incomplete UTF-8 prefixes. Boolean results and byte indices use
the installed SpiceyPy wrappers. Each backend judgment progresses from source
review to verification after fresh required local lanes and observed CI.
[Primary semantics, byte evidence and boundaries](step8-string-transforms.md)

## String search positions and equivalent rows

A19 adds seven routines on the A18 StringsApi. Its 56 workflows compare 407
full byte or row indices, including misses, reverse substring start bounds
and empty versus blank rows. The guarded maximum start and the locked
ESRCHC row ABI have separate tests. The original A18 and Step 7 executions
remain historical until the composite source passes the source-bound gates.
[String search semantics, row layout and oracle](step8-string-search.md)

## Sorted bounds

A24 covers six inclusive or strict last-qualifying-index searches. Its 44
workflows make 282 canonical calls using the six installed SpiceyPy wrappers.
Character rows have explicit UTF-8 byte widths, ASCII blank padding and final
NULs. Numeric cases include ordered double boundaries and signed integers.
[Sorted-boundary semantics and evidence](step8-sorted-bounds.md)

## Array search

A22 depends on the six A24 sorted bounds and adds eight direct raw operations. The 55 registered workflows make 351 independent canonical calls and cover physical order, duplicate selection, binary and linear search, and numeric and UTF-8 comparison rules. Two additional public tests compare exact live indices for values outside JSON, including NaN and infinities. [Array search semantics and evidence](step8-array-search.md) [Per-routine audit](../data/parity-audits/a22-array-search.json)

## Kernel-pool expansion

B05 adds nine direct kernel-pool operations. The source review covers 69 workflows, 164 calls to the nine new methods and 32 terminal toolkit errors. The routine audit distinguishes two N0067 domain guards and follows KEEPER state, watches, logical continuation records, caller capacities and partial-load effects. [Kernel-pool review](step8-kernel-pool.md) [Per-routine audit](../data/parity-audits/b05-kernel-pool.json)

## Numeric strings and marker replacement

A21 adds eleven direct methods on A18’s string contract. Its conversion flags, buffer truncation and full counts coexist with independently checked scientific errors. Source-derived limits on extreme hexadecimal scaling and minimum integer word conversion apply to the documented calls. [Numeric strings](step8-string-numbers.md) [Per-routine audit](../data/parity-audits/a21-string-numeric.json)

## Window algebra

The B03 audit covers 13 canonical double-window operations in 78 registered workflows, with 207 calls to the new methods and ten genuine CSPICE error outcomes. Mutations and
result-window operations are compared by reading back the window cardinality
and every interval through the public API and independent oracle. The audit
also checks handle lifetimes, output capacity, closed boundaries, genuine
errors and source-specific summary indices.
[Window semantics and evidence](step8-window-algebra.md)

## Ordinary cell arrays

B01 extends the B03 cell registry with append and membership for three cell
types and an order-preserving copy into an existing destination. The 68
registered workflows compare actual contents, member booleans, recovered
set state and errors. The supplemental public tests distinguish the C
descriptor from translated control cardinality after a failed numeric copy.
[Cell-array semantics and evidence](step8-cell-arrays.md)

B02 exercises the eleven ordinary set-algebra entry points on real character,
double and integer cells. Its locked oracle supplies existing destination
storage and records post-error state before resetting and reusing each cell.
[Set-algebra semantics and evidence](step8-set-algebra.md)

## Array ordering

A23 adds eleven direct raw routines on the A24 array validation and UTF-8 layout. The 63 registered workflows cover source permutations, distinct output values, Shell-sort ties, signed bounds, UTF-8 rows and guarded domain errors. Focused tests compare the exact order and representation of double values outside JSON. [Semantic evidence](step8-array-order.md) [Per-routine audits](../data/parity-audits/a23-array-order.json)

## String tokenization

A20 adds nine parsing and lexical operations on the A18 string domain. Both
real backends passed the 62 registered workflows after correcting Node's
validation of the signed leading-dot mantissa count. The audit retains the
actual index and count, each row or word, and strict byte-capacity diagnostics.
Parent A18 executions remain historical on their original source.
[String contracts, assumptions and observed edge values](step8-string-tokenization.md)

## Character list parsing

B04 adds LPARSS on the A20 string parsing prerequisite. The reference shares one independent cell across steps so both replacement and empty-list insertion are observable. [Semantics and evidence](step8-string-set.md)

## Surface-name translations

D04 covers four surface-name and code translations in 46 registered workflows.
The audit checks complete output text, separate name and found flags, pool
precedence and refresh, byte capacities and genuine malformed-table errors.
[Surface translation semantics and supported bounds](step8-surface-names.md)

## Spacecraft clock details

Four new time routines use 49 registered workflows. The SCE2T route is a
reviewed SPICELIB alias with initialized result storage and an independent
oracle. The other three use their corresponding public CSPICE entrypoints.
[Clock routes, fixtures and numerical bounds](step8-sclk-additions.md)

## Frame metadata and transformations

D03 adds six methods to the 162-routine baseline, including the two-epoch orientation error guard. [Scientific and lifecycle evidence](step8-frame-metadata.md) [Routine audit](../data/parity-audits/d03-frame-additions.json)

## Civil time and local solar time expansion

D01 adds five time methods to the immutable 162-routine Step 7 assignment. The reviewed source covers parser effects, exact text, leap-second increments, independent geometry, kernel/error order and safe representation boundaries. Older executions remain tied to their original sources. [Scientific observations and fixture provenance](step8-civil-time.md) [Maintained routine review](../data/parity-audits/d01-time-additions.json)
