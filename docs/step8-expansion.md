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

The initial queue has **75 batches**: 35 routines in four active batches and 452
routines in planned batches. Zero Step 8 routines are recorded as PR-ready,
landed or blocked. These are scheduling counts, not implementation or scientific
verification claims. The base's 162 routines and Step 7 repairs are not Step 8
progress. The working branch's generated implementation count can increase before
anything lands on main; never report that increase as merged coverage.

## Active ownership and next deliveries

`Codex Step 8 (/root)` owns all four active batches and their integration. The first
batch uses `/private/tmp/tspice-step8-constants`, branch `codex/expand-constants`.
The second uses `/private/tmp/tspice-step8-scalar-constants`, branch
`codex/expand-scalar-constants`. The third uses `/private/tmp/tspice-step8-cylindrical`,
branch `codex/expand-cylindrical-coordinates`, independently based on `73f3fec8`.
The fourth uses `/private/tmp/tspice-step8-vector-basics`, branch
`codex/expand-vector-basics`, also based on `73f3fec8`. The agent
coordinating Step 7 was notified of the first exact routine list after its merged
completion was inspected. No open Step 7 PR was found when this work began.

| Batch                       | Exact canonical routines                                                                                        | Public placement                                                                                          | Next action                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01-constants               | `pi_c`, `twopi_c`, `halfpi_c`, `dpr_c`, `rpd_c`, `spd_c`, `j2000_c`, `j1900_c`, `b1950_c`                       | Angular constants in `CoordsVectorsApi`; day/epoch constants in `TimeApi`. All remain flat `raw` methods. | [Draft PR #707](https://github.com/rybosome/tspice/pull/707) is open; required CI pending. Inspect results and record source-bound evidence before marking PR-ready. |
| A02-remaining-constants     | `b1900_c`, `j1950_c`, `j2100_c`, `jyear_c`, `tyear_c`, `clight_c`, `dpmax_c`, `dpmin_c`, `intmax_c`, `intmin_c` | Epoch/year constants in `TimeApi`; scalar limits and light speed in `CoordsVectorsApi`.                   | [Draft PR #708](https://github.com/rybosome/tspice/pull/708) is open; required CI pending. Inspect results and record source-bound evidence before marking PR-ready. |
| A05-cylindrical-coordinates | `cyllat_c`, `cylrec_c`, `cylsph_c`, `latcyl_c`, `latsph_c`, `reccyl_c`, `sphcyl_c`, `sphlat_c`                  | Existing `CoordsVectorsApi` scalar and Vec3 conventions.                                                  | Compiled implementation; focused 80 live comparisons and 6 public tests passed locally. Full required lanes and CI pending; no verified claim.                       |
| A08-vector-basics           | `vdist_c`, `vequ_c`, `vpack_c`, `vupack_c`, `vzero_c`, `unorm_c`, `ucrss_c`, `vsep_c`                           | Existing `CoordsVectorsApi` scalar and Vec3 conventions, with explicit multi-output results where needed. | Source implementation active; complete both backend paths, live parity, wrapper checks and required local/CI validation.                                             |

The two constant batches are kernel-free and have source wrappers in locked SpiceyPy 6.0.3. The epoch
constants return Julian dates, not seconds past J2000. Zero-argument constants
need real value comparisons and public-path tests, but no fabricated invalid
input or resource-lifecycle scenarios. No kernel/data fixture is introduced.

The focused A05 results above are an integration-owner progress observation,
not source-bound audit certification; its full lanes remain pending. All four
active batches remain in progress, and open draft PRs are not PR-ready or landed
coverage.

After these deliveries, the next independent candidate is `A09-vector-combinations`
(`vlcom_c`, `vlcom3_c`, `vperp_c`, `vproj_c`, `vrel_c`, `vrotv_c`, `rotvec_c`,
`vtmv_c`). It fits existing Vec3/Mat3 types and has locked source wrappers.
Refresh main, inspect active ownership, and complete primary-semantic review
before taking it.

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

## A05 source validation checkpoint

Both required local lanes passed on source `02aa05d93ca5b98a06e762d50f0f3afac04c145a`: 2,298 live Node/WASM comparisons and 2,519 parity-package tests in the native-required lane, with the production-native guard executed and zero skips. All 15 jobs in [source CI](https://github.com/rybosome/tspice/actions/runs/43537749949) completed successfully without retries. The [inspected Linux Node 22 native job](https://github.com/rybosome/tspice/actions/runs/43537749949/job/132270763254) confirms uncached execution. Current audit fingerprints now have fresh local and CI observations; original Step 7 executions remain historical. This evidence commit still needs final-head CI and explicit rebaseability before PR #709 is ready. No Step 8 routine is landed.
