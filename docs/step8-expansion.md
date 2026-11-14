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

The maintained queue has **75 batches**: **52 routines in six in-progress
batches, 9 routines in one PR-ready batch, and 426 routines in planned batches**.
Zero Step 8 routines are landed or blocked. PR-ready means reviewed delivery
with successful required final-head checks; it is not merged coverage. The
base's 162 routines and Step 7 repairs are not Step 8 progress. Working-branch
implementation counts can increase before anything lands on main.

## Active ownership and next deliveries

`Codex Step 8 (/root)` owns all seven claimed batches and their integration. The first
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
`codex/expand-coordinate-conventions`, independently based on the same commit. The agent
coordinating Step 7 was notified of the first exact routine list after its merged
completion was inspected. No open Step 7 PR was found when this work began.

| Batch                       | Exact canonical routines                                                                                              | Public placement                                                                                                                          | Next action                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01-constants               | `pi_c`, `twopi_c`, `halfpi_c`, `dpr_c`, `rpd_c`, `spd_c`, `j2000_c`, `j1900_c`, `b1950_c`                             | Angular constants in `CoordsVectorsApi`; day/epoch constants in `TimeApi`. All remain flat `raw` methods.                                 | [PR-ready #707](https://github.com/rybosome/tspice/pull/707): final head `1eee2cff` passed all 15 CI jobs and explicit rebaseability review; draft removed, not merged.                                    |
| A02-remaining-constants     | `b1900_c`, `j1950_c`, `j2100_c`, `jyear_c`, `tyear_c`, `clight_c`, `dpmax_c`, `dpmin_c`, `intmax_c`, `intmin_c`       | Epoch/year constants in `TimeApi`; scalar limits and light speed in `CoordsVectorsApi`.                                                   | [Draft PR #708](https://github.com/rybosome/tspice/pull/708): source CI 15/15 green; metadata head `2b59cee8` awaits final-head CI/rebaseability.                                                          |
| A05-cylindrical-coordinates | `cyllat_c`, `cylrec_c`, `cylsph_c`, `latcyl_c`, `latsph_c`, `reccyl_c`, `sphcyl_c`, `sphlat_c`                        | Existing `CoordsVectorsApi` scalar and Vec3 conventions.                                                                                  | [Draft PR #709](https://github.com/rybosome/tspice/pull/709): source CI 15/15 green and fresh source-bound audits; metadata head `3c1b767b` awaits CI run `43540344076` and readiness.                     |
| A08-vector-basics           | `vdist_c`, `vequ_c`, `vpack_c`, `vupack_c`, `vzero_c`, `unorm_c`, `ucrss_c`, `vsep_c`                                 | Existing `CoordsVectorsApi` scalar and Vec3 conventions, with explicit multi-output results where needed.                                 | [Draft PR #710](https://github.com/rybosome/tspice/pull/710): source native CI passed; fresh audit evidence recorded; metadata head `f3d2cb4f` awaits final-head CI `43541137087`.                         |
| A09-vector-combinations     | `vlcom_c`, `vlcom3_c`, `vperp_c`, `vproj_c`, `vrel_c`, `vrotv_c`, `rotvec_c`, `vtmv_c`                                | Existing `CoordsVectorsApi` Vec3/Mat3 conventions; distinguish active and passive rotation.                                               | [Draft PR #711](https://github.com/rybosome/tspice/pull/711), source `69fd2108`: both required local lanes passed; source native CI passed and source-bound audits recorded; final-head readiness pending. |
| A12-fixed-matrices          | `det_c`, `diags2_c`, `ident_c`, `invert_c`, `invort_c`, `isrot_c`, `mequ_c`, `mtxm_c`, `mxmt_c`, `trace_c`, `xpose_c` | Existing `CoordsVectorsApi`, Mat3RowMajor and an immediately consumed 2x2 shape; numeric result ownership helper preserves CSPICE output. | Compiled source and semantic review complete; focused live/public/overflow/wrapper/core/allocation tests passed. RPC regression passed; full required local/CI validation pending.                         |
| A06-coordinate-conventions  | `azlrec_c`, `recazl_c`, `pgrrec_c`, `recpgr_c`, `radrec_c`, `recrad_c`, `srfrec_c`                                    | Existing `CoordsVectorsApi`; authored body constants support planetographic/surface conventions.                                          | Source work and fixture/semantic review active; required local/CI validation pending.                                                                                                                      |

The two constant batches are kernel-free and have source wrappers in locked SpiceyPy 6.0.3. The epoch
constants return Julian dates, not seconds past J2000. Zero-argument constants
need real value comparisons and public-path tests, but no fabricated invalid
input or resource-lifecycle scenarios. No kernel/data fixture is introduced.

The progress observations above come from the integration owner. A01 final head
`1eee2cffd03e1d9ab4f063807cd2e256a09ffe77` passed all 15 jobs in CI run
`43538403821`; an after-CI REST observation explicitly reported `rebaseable:true`
against `73f3fec8`. Draft status was removed and the PR body updated. Those nine
routines are PR-ready and remain unmerged.

A02 source CI passed all 15 jobs and local native validation passed 2,258 live
comparisons / 2,475 parity-package tests without skips. Its metadata head
`2b59cee8` awaits final CI `43540047006` and readiness review. A05 source CI and
local validation passed, including 2,298 live comparisons / 2,519 parity-package
tests without skips; final metadata head `3c1b767b` awaits CI `43540344076`.
A08's full local lanes and inspected source native CI job `132277308410` passed
2,282 live comparisons / 2,505 parity-package tests without skips. Its fresh
source-bound audits are verified, while final metadata head `f3d2cb4f` awaits
CI run `43541137087` and readiness review.

A09 draft PR #711 is open at `69fd2108259457989adf223241a72411d8714f5a`.
Both required local lanes passed, including 2,294 live comparisons / 2,517
parity-package tests without skips, 102 native / 641 WASM / 28 core / 150 facade
tests. Source CI has eight of fifteen jobs green; Linux Node 22 job
`132280923832` passed with complete uncached execution. A12 passed
100 focused Node/WASM case comparisons, 10 public tests, both 14-observation
extreme tests, 54 native wrapper tests, 6 core result-helper tests and 46 WASM
allocation checks. Its signed-zero recovery assertion was repaired without
normalizing outputs. Both actual-backend RPC regressions also passed; full required local lanes/CI
remain pending.

The other six claimed batches remain in progress. Queue progress notes do not
replace per-routine source-bound evidence, final-head readiness review, or an
actual merge. A14's precreated worktree remains unused and its batch is planned.

After these deliveries, `A10-general-vectors` is a planned candidate. Its fifteen
routines require an immediate review of readonly variable-length arrays, matching
dimensions, zero dimension and checked allocation sizes before implementation.
Refresh main and active ownership first; no owner or settled dimension policy is
claimed here.

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

Their batches require investigation of the actual locked library and pinned
N0067 ABI for a minimal independent live-oracle route. No such route is claimed
as established by this queue. If it cannot be established, request a concrete
maintainer decision while delivering independent routines. Do not compare tspice
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

## A09 source validation checkpoint

Both full required local lanes passed on source `69fd2108259457989adf223241a72411d8714f5a`: 2,294 live Node/WASM comparisons and 2,517 parity-package tests in the native-required lane, with zero skips and the production-addon guard executed. The [inspected source Linux Node 22 native job](https://github.com/rybosome/tspice/actions/runs/43540881828/job/132280923832) passed with the same uncached counts. Nine source jobs passed while remaining macOS jobs were queued. Current source-bound local and CI audit judgments are verified; this evidence-only commit supersedes the queued source matrix. Its entire required matrix and explicit GitHub rebaseability must pass before PR #711 is marked ready. The queue separately records PR #707 as ready; no Step 8 routine is landed.
