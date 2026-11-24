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

## Checkpoint delivery

The 76 pinned source PRs cover all 487 expansion routines and passed CI at their accepted heads. The queue records the exact source heads, bases and CI runs.

[Checkpoint 01](https://github.com/rybosome/tspice/pull/783) landed the implementation for 307 cumulative routines. [Checkpoint 02](https://github.com/rybosome/tspice/pull/784) brought the cumulative total to 408. Its [audit evidence](https://github.com/rybosome/tspice/pull/785) and [history follow-up](https://github.com/rybosome/tspice/pull/786) landed the validated implementation and evidence tree. [PR #787](https://github.com/rybosome/tspice/pull/787) then restored all 29 original source heads with a merge commit.

Checkpoint 03 adds 115 routines and 895 registered case identities. Its merge commit will make the 20 additional original source heads reachable from main. The combined source has 523 routines and 3,527 registered cases. Current combined parity evidence follows the rebuilt WASM and both required execution lanes.

## Initial ownership and deliveries

The following entries describe the original source-PR planning state.

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

## Verified source checkpoints

A01 source `bfedb1098e738e821b831ba9d1f9d6f7bc24c637` passed all 15
[canonical jobs](https://github.com/rybosome/tspice/actions/runs/43536295333)
and both required local lanes. The inspected Linux Node 22 native-required job
ran 2,254 live comparisons and all 2,471 parity-package tests without skips.
GitHub explicitly reported this source rebaseable on main `73f3fec8`.
PR #707 remains in progress until final verification metadata checks complete;
no implementation is claimed landed.

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

The checkpoint also preserves source history and evidence for [#708](https://github.com/rybosome/tspice/pull/708).

The checkpoint also preserves source history and evidence for [#709](https://github.com/rybosome/tspice/pull/709).

The checkpoint also preserves source history and evidence for [#710](https://github.com/rybosome/tspice/pull/710).

The checkpoint also preserves source history and evidence for [#711](https://github.com/rybosome/tspice/pull/711).

The checkpoint also preserves source history and evidence for [#713](https://github.com/rybosome/tspice/pull/713).

The checkpoint also preserves source history and evidence for [#714](https://github.com/rybosome/tspice/pull/714).

The checkpoint also preserves source history and evidence for [#716](https://github.com/rybosome/tspice/pull/716).

The checkpoint also preserves source history and evidence for [#717](https://github.com/rybosome/tspice/pull/717).

The checkpoint also preserves source history and evidence for [#718](https://github.com/rybosome/tspice/pull/718).

The checkpoint also preserves source history and evidence for [#720](https://github.com/rybosome/tspice/pull/720).

The checkpoint also preserves source history and evidence for [#712](https://github.com/rybosome/tspice/pull/712), [#725](https://github.com/rybosome/tspice/pull/725).

The checkpoint also preserves source history and evidence for [#715](https://github.com/rybosome/tspice/pull/715), [#731](https://github.com/rybosome/tspice/pull/731).

The checkpoint also preserves source history and evidence for [#712](https://github.com/rybosome/tspice/pull/712), [#736](https://github.com/rybosome/tspice/pull/736).

The checkpoint also preserves source history and evidence for [#712](https://github.com/rybosome/tspice/pull/712), [#747](https://github.com/rybosome/tspice/pull/747).

The checkpoint also preserves source history and evidence for [#719](https://github.com/rybosome/tspice/pull/719), [#726](https://github.com/rybosome/tspice/pull/726).

The checkpoint also preserves source history and evidence for [#721](https://github.com/rybosome/tspice/pull/721), [#732](https://github.com/rybosome/tspice/pull/732).

The checkpoint also preserves source history and evidence for [#734](https://github.com/rybosome/tspice/pull/734).

The checkpoint also preserves source history and evidence for [#737](https://github.com/rybosome/tspice/pull/737).

The checkpoint also preserves source history and evidence for [#722](https://github.com/rybosome/tspice/pull/722), [#728](https://github.com/rybosome/tspice/pull/728), [#742](https://github.com/rybosome/tspice/pull/742).

The checkpoint also preserves source history and evidence for [#744](https://github.com/rybosome/tspice/pull/744).

The checkpoint also preserves source history and evidence for [#735](https://github.com/rybosome/tspice/pull/735), [#746](https://github.com/rybosome/tspice/pull/746).

The checkpoint also preserves source history and evidence for [#723](https://github.com/rybosome/tspice/pull/723).

The checkpoint also preserves source history and evidence for [#724](https://github.com/rybosome/tspice/pull/724).

The checkpoint also preserves source history and evidence for [#740](https://github.com/rybosome/tspice/pull/740).

The checkpoint also preserves source history and evidence for [#741](https://github.com/rybosome/tspice/pull/741).

The checkpoint also preserves source history and evidence for [#727](https://github.com/rybosome/tspice/pull/727), [#738](https://github.com/rybosome/tspice/pull/738), [#751](https://github.com/rybosome/tspice/pull/751).

The checkpoint also preserves source history and evidence for [#743](https://github.com/rybosome/tspice/pull/743), [#755](https://github.com/rybosome/tspice/pull/755).

The checkpoint also preserves source history and evidence for [#750](https://github.com/rybosome/tspice/pull/750), [#758](https://github.com/rybosome/tspice/pull/758).

The checkpoint also preserves source history and evidence for [#759](https://github.com/rybosome/tspice/pull/759).

The checkpoint also preserves source history and evidence for [#760](https://github.com/rybosome/tspice/pull/760).

The checkpoint also preserves source history and evidence for [#753](https://github.com/rybosome/tspice/pull/753), [#762](https://github.com/rybosome/tspice/pull/762).

The checkpoint also preserves source history and evidence for [#765](https://github.com/rybosome/tspice/pull/765).

The checkpoint also preserves source history and evidence for [#767](https://github.com/rybosome/tspice/pull/767).

The checkpoint also preserves source history and evidence for [#772](https://github.com/rybosome/tspice/pull/772).

The checkpoint also preserves source history and evidence for [#749](https://github.com/rybosome/tspice/pull/749), [#779](https://github.com/rybosome/tspice/pull/779).

The checkpoint also preserves source history and evidence for [#730](https://github.com/rybosome/tspice/pull/730).

The checkpoint also preserves source history and evidence for [#739](https://github.com/rybosome/tspice/pull/739).

The checkpoint also preserves source history and evidence for [#757](https://github.com/rybosome/tspice/pull/757), [#761](https://github.com/rybosome/tspice/pull/761).

The checkpoint also preserves source history and evidence for [#763](https://github.com/rybosome/tspice/pull/763), [#766](https://github.com/rybosome/tspice/pull/766).

The checkpoint also preserves source history and evidence for [#770](https://github.com/rybosome/tspice/pull/770), [#774](https://github.com/rybosome/tspice/pull/774).
