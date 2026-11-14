# Step 8 expansion queue

The [maintained queue](../data/expansion-queue.json) assigns every eligible routine
absent from main at `73f3fec8788ed926351f891b459ac75d434f6446` to exactly one bounded
implementation batch. That commit merged [Step 7 PR #706](https://github.com/rybosome/tspice/pull/706).
The earlier audit owns the existing surface; Step 8 owns the new routines below.
Its [semantic audit standard](parity-audit.md) remains the acceptance standard.

The snapshot is **652 canonical routines, 649 eligible, 162 already present,
487 absent, and 3 excluded**. There are **162 registered case files and 1,109
scenarios** at that base. Absence was derived from the ledger's `implementation`
field and actual contract, not the inventory's `planned` decision. The exclusions
remain `ftncls_c`, `getcml_c`, and `prompt_c`.

The maintained queue has **75 batches**: **68 routines in eight in-progress
batches, 35 routines in four PR-ready batches, and 384 routines in planned batches**.
Zero Step 8 routines are landed or blocked. PR-ready means reviewed delivery
with successful required final-head checks; it is not merged coverage. The
base's 162 routines and Step 7 repairs are not Step 8 progress. Working-branch
implementation counts can increase before anything lands on main.

## Active ownership and next deliveries

`Codex Step 8 (/root)` owns all twelve claimed batches and their integration. The first
batch uses `/private/tmp/tspice-step8-constants`, branch `codex/expand-constants`.
The second uses `/private/tmp/tspice-step8-scalar-constants`, branch
`codex/expand-scalar-constants`. The third uses `/private/tmp/tspice-step8-cylindrical`,
branch `codex/expand-cylindrical-coordinates`, independently based on `73f3fec8`.
The fourth uses `/private/tmp/tspice-step8-vector-basics`, branch
`codex/expand-vector-basics`, also based on `73f3fec8`. The fifth uses
`/private/tmp/tspice-step8-vector-combinations`, branch
`codex/expand-vector-combinations`, independently based on the same commit. The sixth
uses `/private/tmp/tspice-step8-fixed-matrices`, branch
`codex/expand-fixed-matrices`, also independently based on `73f3fec8`. The seventh
uses `/private/tmp/tspice-step8-coordinate-conventions`, branch
`codex/expand-coordinate-conventions`, independently based on the same commit. The eighth uses
`/private/tmp/tspice-step8-scalar-math`, branch `codex/expand-scalar-math`,
independently based on `73f3fec8`. The ninth uses
`/private/tmp/tspice-step8-general-vectors`, branch `codex/expand-general-vectors`,
also independently based on `73f3fec8`. The tenth uses
`/private/tmp/tspice-step8-state-derivatives`, branch `codex/expand-state-derivatives`,
independently based on the same commit. The eleventh uses
`/private/tmp/tspice-step8-polynomial-expansions`, branch
`codex/expand-polynomial-expansions`, also based on `73f3fec8`. The twelfth uses
`/private/tmp/tspice-step8-interpolation`, branch `codex/expand-interpolation`,
independently based on the same commit. The agent coordinating Step 7 was notified of the first exact routine list after its merged
completion was inspected. No open Step 7 PR was found when this work began.

| Batch                       | Exact canonical routines                                                                                                                                                   | Public placement                                                                                                                          | Next action                                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01-constants               | `pi_c`, `twopi_c`, `halfpi_c`, `dpr_c`, `rpd_c`, `spd_c`, `j2000_c`, `j1900_c`, `b1950_c`                                                                                  | Angular constants in `CoordsVectorsApi`; day/epoch constants in `TimeApi`. All remain flat `raw` methods.                                 | [PR-ready #707](https://github.com/rybosome/tspice/pull/707): final head `1eee2cff` passed all 15 CI jobs and explicit rebaseability review; draft removed, not merged.                                                                            |
| A02-remaining-constants     | `b1900_c`, `j1950_c`, `j2100_c`, `jyear_c`, `tyear_c`, `clight_c`, `dpmax_c`, `dpmin_c`, `intmax_c`, `intmin_c`                                                            | Epoch/year constants in `TimeApi`; scalar limits and light speed in `CoordsVectorsApi`.                                                   | [PR-ready #708](https://github.com/rybosome/tspice/pull/708): final head `2b59cee8` passed all 15 CI jobs and explicit rebaseability review; draft removed, not merged.                                                                            |
| A05-cylindrical-coordinates | `cyllat_c`, `cylrec_c`, `cylsph_c`, `latcyl_c`, `latsph_c`, `reccyl_c`, `sphcyl_c`, `sphlat_c`                                                                             | Existing `CoordsVectorsApi` scalar and Vec3 conventions.                                                                                  | [PR-ready #709](https://github.com/rybosome/tspice/pull/709): final head `3c1b767b` passed all 15 CI jobs and explicit rebaseability review; draft removed, not merged.                                                                            |
| A08-vector-basics           | `vdist_c`, `vequ_c`, `vpack_c`, `vupack_c`, `vzero_c`, `unorm_c`, `ucrss_c`, `vsep_c`                                                                                      | Existing `CoordsVectorsApi` scalar and Vec3 conventions, with explicit multi-output results where needed.                                 | [PR-ready #710](https://github.com/rybosome/tspice/pull/710): final head `f3d2cb4f` passed all15 CI jobs; after-CI REST explicitly rebaseable/mergeable, draft removed; not merged.                                                                |
| A09-vector-combinations     | `vlcom_c`, `vlcom3_c`, `vperp_c`, `vproj_c`, `vrel_c`, `vrotv_c`, `rotvec_c`, `vtmv_c`                                                                                     | Existing `CoordsVectorsApi` Vec3/Mat3 conventions; distinguish active and passive rotation.                                               | [Draft PR #711](https://github.com/rybosome/tspice/pull/711), source `69fd2108`: both required local lanes passed; inspected Linux Node 22 source CI passed; fresh audit verification recorded; metadata `0f13f395` awaits final CI `43542362965`. |
| A12-fixed-matrices          | `det_c`, `diags2_c`, `ident_c`, `invert_c`, `invort_c`, `isrot_c`, `mequ_c`, `mtxm_c`, `mxmt_c`, `trace_c`, `xpose_c`                                                      | Existing `CoordsVectorsApi`, Mat3RowMajor and an immediately consumed 2x2 shape; numeric result ownership helper preserves CSPICE output. | [Draft PR #712](https://github.com/rybosome/tspice/pull/712), source `72bd1365`: both required locals and inspected source native CI passed; fresh verification recorded; metadata `f3289ac9` pushed, final CI pending.                            |
| A06-coordinate-conventions  | `azlrec_c`, `recazl_c`, `pgrrec_c`, `recpgr_c`, `radrec_c`, `recrad_c`, `srfrec_c`                                                                                         | Existing `CoordsVectorsApi`; authored body constants support planetographic/surface conventions.                                          | [Draft PR #713](https://github.com/rybosome/tspice/pull/713): both full locals and source CI passed; fresh audit verification recorded. Final metadata `232ee6ef` awaits CI `43545867313`.                                                         |
| A03-scalar-math             | `brcktd_c`, `brckti_c`, `convrt_c`, `sumad_c`, `sumai_c`, `maxd_c`, `maxi_c`, `mind_c`, `mini_c`                                                                           | Existing `CoordsVectorsApi`; bounded reductions and independently investigated C variadic oracle route.                                   | [Draft PR #714](https://github.com/rybosome/tspice/pull/714): both full locals and source CI passed; all 171 audits freshly verified. Final metadata `9c1c1e2f` awaits CI `43546459881`.                                                           |
| A10-general-vectors         | `vaddg_c`, `vdistg_c`, `vdotg_c`, `vequg_c`, `vhatg_c`, `vlcomg_c`, `vminug_c`, `vnormg_c`, `vprojg_c`, `vrelg_c`, `vsclg_c`, `vsepg_c`, `vsubg_c`, `vzerog_c`, `unormg_c` | Existing `CoordsVectorsApi`; immediately consumed readonly general-vector shapes with reviewed dimensions.                                | [Draft PR #715](https://github.com/rybosome/tspice/pull/715), source `591c6f49`: both required locals and inspected source CI passed2382 live/2610 parity with no native-required skips; fresh metadata recording, final-head readiness pending.   |
| A11-state-derivatives       | `ducrss_c`, `dvcrss_c`, `dvdot_c`, `dvhat_c`, `dvnorm_c`, `dvsep_c`                                                                                                        | Existing `CoordsVectorsApi`; immediately consumed readonly six-component state inputs.                                                    | [Draft PR #716](https://github.com/rybosome/tspice/pull/716), source `b20b8172`: full JS passed2296 live/2521 parity plus expected guard skip; native-required and source CI `43547433026` pending.                                                |
| A16-polynomial-expansions   | `chbder_c`, `chbigr_c`, `chbint_c`, `chbval_c`, `polyds_c`, `rquad_c`                                                                                                      | Existing `CoordsVectorsApi`; immediately consumed bounded polynomial inputs/results.                                                      | Source frozen:46 scenarios/131 calls, primary audit reviewed. Compiled checks and full required lanes/CI pending.                                                                                                                                  |
| A17-interpolation           | `hrmesp_c`, `hrmint_c`, `lgresp_c`, `lgrind_c`, `lgrint_c`, `qderiv_c`                                                                                                     | Existing `CoordsVectorsApi`; immediate interpolation inputs/workspaces.                                                                   | Backend/parity assigned; count, spacing, repeated-node and derivative semantics under review.                                                                                                                                                      |

The progress observations above come from the integration owner. A01, A02, A05 and
A08 each passed all 15 final-head CI jobs and an explicit after-CI REST
`rebaseable:true` observation against `73f3fec8`; their draft flags were removed.
Their exact heads and CI runs are retained in the queue's readiness evidence.
These 35 routines are PR-ready and remain unmerged.

Source verification is separate from final-head readiness. A09, A12, A06
and A03 have fresh source-bound audit evidence after both full local lanes and
inspected canonical source CI. Their later metadata heads still require their
own final-head readiness checks. A06 passed 2,332 live comparisons / 2,559 parity
tests without skips; A03 passed 2,312 / 2,538 without skips. Earlier focused
repairs and exact execution details remain in each PR's audit records.

A10's focused tests passed 164 live comparisons, 12 public tests, three
extreme/oracle-guard tests with 22 observations per backend, 73 WASM tests,
116 native tests and two actual RPC checks. Its 82 scenarios contain 205 calls.
Both required local lanes passed 2,382 live comparisons and 2,610 parity tests
without native-required skips; inspected source CI job `132299443961` passed the
same counts. Fresh CI metadata is being recorded; final-head readiness remains pending. A11 source
is frozen with 39 scenarios/106 calls and all focused checks passed; full required
lanes and canonical CI remain pending. A16 production/parity is frozen at 46 scenarios/131 calls; compiled validation
is pending. A17 is newly assigned for source work; assignment does not establish
its interpolation bounds or semantics.
The eight in-progress batches have no PR-ready claim. A14's precreated worktree
remains unused and planned. Refresh main and ownership before taking more work.

## Reading and maintaining the queue

Each JSON batch records its exact routines, proposed domain/API placement,
owner, status, batch dependencies, prerequisite investigation, fixture needs,
locked-oracle availability, expected implementation changes, PR URLs, validation
evidence and next action. Proposed type/fixture/ABI work is explicitly unresolved
until reviewed. The graph does not require public wrappers for internal CSPICE
callees. String utilities propose one directly consumed strings domain because
there is currently no general string API; its placement is a decision for the
first string batch, not a speculative architecture change in the constants PR.

The waves are scheduling guides. Earlier letters are not a global barrier.
Small stateful writer/search families deliberately remain below five routines;
their complete workflow is the review unit. Larger families stay at fifteen
routines or fewer. Split a batch before implementation if its subtype, callback,
fixture or oracle work is too large for review. Preserve unique ownership and
update any dependent batch IDs when splitting.

Use these status meanings consistently:

- `planned`: scheduled candidate; unresolved design and oracle work may remain.
- `in-progress`: owned source work; no delivery or merge claim.
- `PR-ready`: complete supported path, reviewed semantic evidence, successful
  required local and observed CI execution, and a reviewable open PR.
- `landed`: that implementation merged on main; record its merge commit and
  reconcile the current inventory.
- `blocked`: a concrete dependency or maintainer decision prevents this batch;
  record the reason and continue independent work.

Keep `prs` and `validationEvidence` empty until actual evidence exists. For each
observation record the exact command, backend/native-required setting, result,
tested commit/source digest and CI job URL where applicable. Record source-bound
per-routine semantic evidence with the existing audit machinery. Generated
inventory/ledger files belong to their generators; queue status must not override
their derived implementation or audit judgments.

One integrator owns each compiled WASM revision. When source changes combine,
preserve all declarations/registrations, regenerate both Node/web artifacts with
the pinned owning build, verify actual exports and rerun affected raw paths.
Never resolve a binary conflict by choosing one side. Reconcile main and open PRs
before assigning another routine; landed work from another agent must be removed
from the absent-work queue rather than reimplemented or claimed as our delivery.

## Oracle availability and unresolved work

The queue records an availability inspection of the installed, locked SpiceyPy
**6.0.3** `spiceypy.py` module. The source SHA-256 and lockfile location are in
`oracleInspection`. Function definitions and direct `libspice` call names were
inspected, including the wrappers named `set_c` and `return_c`. Presence means
there is a source entry point to review. It does not establish correct error/found
handling, complete outputs, ABI compatibility or sufficient scientific coverage.

The following **23 routines lack corresponding top-level wrappers** in that
inspected module:

- Array storage/reductions: `clearc_c`, `cleard_c`, `cleari_c`, `filld_c`, `filli_c`,
  `moved_c`, `maxd_c`, `maxi_c`, `mind_c`, `mini_c`.
- Text/command state: `nextwd_c`, `nthwd_c`, `putcml_c`, `repml_c`.
- DAS character data: `dasrdc_c`, `dasudc_c`.
- Legacy plate geometry: `illum_pl02`, `illum_plid_pl02`, `limb_pl02`,
  `llgrid_pl02`, `subpt_pl02`, `subsol_pl02`, `term_pl02`.

These initial wrapper-availability gaps require an actual locked-library and
pinned N0067 ABI route. A03 now references the independent max/min variadic
investigation in PR #707; its source and live batch validation are recorded in PR #714, whose final-head readiness remains pending.
The other listed gaps retain their investigation prerequisites. If a route cannot
be established, request a concrete maintainer decision while delivering independent
routines. Do not compare tspice
against its own shim, silently omit parity, or add exclusions. Supported routines
in a mixed batch can be split out rather than waiting on unrelated wrapper gaps.

Other explicit investigations include callback ownership and synchronous
Node/WASM invocation (`E24`/`E25`), process/signal/error policy (`B07`/`E26`), and
implicit text-file/command state (`C14`). These are unresolved breadth/platform
questions, not approved unsupported-backend exceptions. New scientific fixtures
require provenance, rights and deterministic independent generation before they
can satisfy a batch.

No PR may be merged without explicit authorization. Step 9 reconciliation and
release decisions remain separate; this queue authorizes no version choice,
publishing or deployment.
