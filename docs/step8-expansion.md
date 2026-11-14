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

The maintained queue has **75 batches**, with **259 routines in thirty-four in-progress
batches, 27 routines in three PR-ready batches, and 201 routines in planned batches**.
Zero Step 8 routines are landed or blocked. PR-ready means reviewed delivery
with successful required final-head checks; it is not merged coverage. The
base's 162 routines and Step 7 repairs are not Step 8 progress. Working-branch
implementation counts can increase before anything lands on main.

## Active ownership and next deliveries

`Codex Step 8 (/root)` owns all thirty-seven claimed batches and their integration. The first
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
independently based on the same commit. The thirteenth uses
`/private/tmp/tspice-step8-string-transforms`, branch `codex/expand-string-transforms`,
on the same base. The fourteenth uses `/private/tmp/tspice-step8-array-storage`,
branch `codex/expand-array-storage`. A24 uses `/private/tmp/tspice-step8-sorted-bounds`, branch `codex/expand-sorted-bounds`. B03 uses `/private/tmp/tspice-step8-window-algebra`, branch `codex/expand-window-algebra`. All three are based on `73f3fec8`. B01 uses `/private/tmp/tspice-step8-cell-arrays` on the B03 evidence head. E10 uses `/private/tmp/tspice-step8-plane-geometry` on main `73f3fec8`. A13 uses `/private/tmp/tspice-step8-general-matrices` on the A10 prerequisite from [#715](https://github.com/rybosome/tspice/pull/715). The agent coordinating Step 7 was notified of the first exact routine list after its merged
completion was inspected. No open Step 7 PR was found when this work began.

| Batch                        | Exact canonical routines                                                                                                                                                   | Public placement                                                                                                                          | Next action                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01-constants                | `pi_c`, `twopi_c`, `halfpi_c`, `dpr_c`, `rpd_c`, `spd_c`, `j2000_c`, `j1900_c`, `b1950_c`                                                                                  | Angular constants in `CoordsVectorsApi`; day/epoch constants in `TimeApi`. All remain flat `raw` methods.                                 | [PR-ready #707](https://github.com/rybosome/tspice/pull/707): final head `1eee2cff` passed all 15 CI jobs and explicit rebaseability review; draft removed, not merged.                                                                                                                                                                                     |
| A02-remaining-constants      | `b1900_c`, `j1950_c`, `j2100_c`, `jyear_c`, `tyear_c`, `clight_c`, `dpmax_c`, `dpmin_c`, `intmax_c`, `intmin_c`                                                            | Epoch/year constants in `TimeApi`; scalar limits and light speed in `CoordsVectorsApi`.                                                   | [PR-ready #708](https://github.com/rybosome/tspice/pull/708): final head `2b59cee8` passed all 15 CI jobs and explicit rebaseability review; draft removed, not merged.                                                                                                                                                                                     |
| A05-cylindrical-coordinates  | `cyllat_c`, `cylrec_c`, `cylsph_c`, `latcyl_c`, `latsph_c`, `reccyl_c`, `sphcyl_c`, `sphlat_c`                                                                             | Existing `CoordsVectorsApi` scalar and Vec3 conventions.                                                                                  | All 15 final-head jobs passed and rebaseability was confirmed. [#709 ready for review](https://github.com/rybosome/tspice/pull/709).                                                                                                                                                                                                                        |
| A08-vector-basics            | `vdist_c`, `vequ_c`, `vpack_c`, `vupack_c`, `vzero_c`, `unorm_c`, `ucrss_c`, `vsep_c`                                                                                      | Existing `CoordsVectorsApi` scalar and Vec3 conventions, with explicit multi-output results where needed.                                 | Draft [#710](https://github.com/rybosome/tspice/pull/710). Source verified. Evidence head `2e382e85` awaits [final CI](https://github.com/rybosome/tspice/actions/runs/43552258168) and rebaseability.                                                                                                                                                      |
| A09-vector-combinations      | `vlcom_c`, `vlcom3_c`, `vperp_c`, `vproj_c`, `vrel_c`, `vrotv_c`, `rotvec_c`, `vtmv_c`                                                                                     | Existing `CoordsVectorsApi` Vec3/Mat3 conventions; distinguish active and passive rotation.                                               | [Draft #711](https://github.com/rybosome/tspice/pull/711), evidence head `a25e7a84`, [CI 43553237186](https://github.com/rybosome/tspice/actions/runs/43553237186). Both corrected full local lanes and uncached Linux Node 22 job 132310685814 at source bdb51dc6 passed, with 2,294 live comparisons and 2,517 parity tests and no native-required skips. |
| A12-fixed-matrices           | `det_c`, `diags2_c`, `ident_c`, `invert_c`, `invort_c`, `isrot_c`, `mequ_c`, `mtxm_c`, `mxmt_c`, `trace_c`, `xpose_c`                                                      | Existing `CoordsVectorsApi`, Mat3RowMajor and an immediately consumed 2x2 shape; numeric result ownership helper preserves CSPICE output. | [Draft #712](https://github.com/rybosome/tspice/pull/712), final evidence head `a1127d86`. Corrected source passed both full local lanes and uncached Linux Node 22 at 2,318 live / 2,543 parity without native-required skips. [Final CI 43554113908](https://github.com/rybosome/tspice/actions/runs/43554113908)                                         |
| A06-coordinate-conventions   | `azlrec_c`, `recazl_c`, `pgrrec_c`, `recpgr_c`, `radrec_c`, `recrad_c`, `srfrec_c`                                                                                         | Existing `CoordsVectorsApi`; authored body constants support planetographic/surface conventions.                                          | [Draft #713](https://github.com/rybosome/tspice/pull/713), evidence head `a118bad3`, [CI 43552434453](https://github.com/rybosome/tspice/actions/runs/43552434453). Corrected source evidence is recorded in the metadata commit.                                                                                                                           |
| A03-scalar-math              | `brcktd_c`, `brckti_c`, `convrt_c`, `sumad_c`, `sumai_c`, `maxd_c`, `maxi_c`, `mind_c`, `mini_c`                                                                           | Existing `CoordsVectorsApi`; bounded reductions and independently investigated C variadic oracle route.                                   | [Draft #714](https://github.com/rybosome/tspice/pull/714), evidence head `fd64e4b0`. [CI 43553617925](https://github.com/rybosome/tspice/actions/runs/43553617925)                                                                                                                                                                                          |
| A10-general-vectors          | `vaddg_c`, `vdistg_c`, `vdotg_c`, `vequg_c`, `vhatg_c`, `vlcomg_c`, `vminug_c`, `vnormg_c`, `vprojg_c`, `vrelg_c`, `vsclg_c`, `vsepg_c`, `vsubg_c`, `vzerog_c`, `unormg_c` | Existing `CoordsVectorsApi`; immediately consumed readonly general-vector shapes with reviewed dimensions.                                | [Draft #715](https://github.com/rybosome/tspice/pull/715), evidence head `fb98c999`, [CI 43552435937](https://github.com/rybosome/tspice/actions/runs/43552435937). Corrected source evidence is recorded in the metadata commit.                                                                                                                           |
| A11-state-derivatives        | `ducrss_c`, `dvcrss_c`, `dvdot_c`, `dvhat_c`, `dvnorm_c`, `dvsep_c`                                                                                                        | Existing `CoordsVectorsApi`; immediately consumed readonly six-component state inputs.                                                    | [Draft #716](https://github.com/rybosome/tspice/pull/716), evidence head `f859992f`. [CI 43553619030](https://github.com/rybosome/tspice/actions/runs/43553619030)                                                                                                                                                                                          |
| A16-polynomial-expansions    | `chbder_c`, `chbigr_c`, `chbint_c`, `chbval_c`, `polyds_c`, `rquad_c`                                                                                                      | Existing `CoordsVectorsApi`; immediately consumed bounded polynomial inputs/results.                                                      | Draft [#717](https://github.com/rybosome/tspice/pull/717). Source verified. Evidence head `e053c237` awaits [final CI](https://github.com/rybosome/tspice/actions/runs/43551854495) and rebaseability.                                                                                                                                                      |
| A17-interpolation            | `hrmesp_c`, `hrmint_c`, `lgresp_c`, `lgrind_c`, `lgrint_c`, `qderiv_c`                                                                                                     | Existing `CoordsVectorsApi`; immediate interpolation inputs/workspaces.                                                                   | Draft [#718](https://github.com/rybosome/tspice/pull/718). Source verified. Evidence head `ff210e62` awaits [final CI](https://github.com/rybosome/tspice/actions/runs/43551857857) and rebaseability.                                                                                                                                                      |
| A18-string-transform         | `cmprss_c`, `eqstr_c`, `iswhsp_c`, `lastnb_c`, `lcase_c`, `ucase_c`, `matchi_c`, `matchw_c`                                                                                | New raw StringsApi for UTF-8 byte strings and single-byte tokens.                                                                         | [Draft #719](https://github.com/rybosome/tspice/pull/719), evidence head `92b3050e`. [CI 43554062008](https://github.com/rybosome/tspice/actions/runs/43554062008)                                                                                                                                                                                          |
| A04-array-storage            | `clearc_c`, `cleard_c`, `cleari_c`, `filld_c`, `filli_c`, `moved_c`                                                                                                        | Bounded array-storage operations and exact independent native ABI.                                                                        | [Draft #720](https://github.com/rybosome/tspice/pull/720), evidence head `411d40f5`. [CI 43554243805](https://github.com/rybosome/tspice/actions/runs/43554243805)                                                                                                                                                                                          |
| A24-sorted-bounds            | `lstlec_c`, `lstled_c`, `lstlei_c`, `lstltc_c`, `lstltd_c`, `lstlti_c`                                                                                                     | Independent sorted bound searches with duplicate and byte-order semantics.                                                                | [Draft #721](https://github.com/rybosome/tspice/pull/721), evidence head `3b2485cb`. [CI 43554247102](https://github.com/rybosome/tspice/actions/runs/43554247102)                                                                                                                                                                                          |
| B03-window-algebra           | `wncomd_c`, `wncond_c`, `wndifd_c`, `wnelmd_c`, `wnexpd_c`, `wnextd_c`, `wnfild_c`, `wnfltd_c`, `wnincd_c`, `wnintd_c`, `wnreld_c`, `wnsumd_c`, `wnunid_c`                 | Existing cells/windows API with canonical interval results and state effects.                                                             | [Draft PR #722](https://github.com/rybosome/tspice/pull/722). evidence 7d575af9; final matrix and explicit rebaseability required.                                                                                                                                                                                                                          |
| D04-surface-names            | `srfc2s_c`, `srfcss_c`, `srfs2c_c`, `srfscc_c`                                                                                                                             | Existing IDs/names domain with body-specific surface mappings and kernel pool state.                                                      | [Draft PR #723](https://github.com/rybosome/tspice/pull/723). evidence b82a929d; final matrix and explicit rebaseability required.                                                                                                                                                                                                                          |
| D02-sclk-additions           | `sce2t_c`, `scfmt_c`, `scpart_c`, `sctiks_c`                                                                                                                               | Existing time API for spacecraft clocks.                                                                                                  | Draft [#724](https://github.com/rybosome/tspice/pull/724) at `dd2add2b`. [CI run](https://github.com/rybosome/tspice/actions/runs/43557132757) and explicit rebaseability review remain pending.                                                                                                                                                            |
| A14-rotation-representations | `eul2m_c`, `m2eul_c`, `m2q_c`, `q2m_c`, `qxq_c`, `qdq2av_c`, `raxisa_c`                                                                                                    | Existing coordinate API, scalar-first quaternions and row-major matrix results.                                                           | Final evidence head `69a3e2fe`. [Draft #725](https://github.com/rybosome/tspice/pull/725) [CI run](https://github.com/rybosome/tspice/actions/runs/43557788094)                                                                                                                                                                                             |
| A19-string-search            | `cpos_c`, `cposr_c`, `ncpos_c`, `ncposr_c`, `pos_c`, `posr_c`, `esrchc_c`                                                                                                  | Existing StringsApi from A18.                                                                                                             | Final evidence head `b7340ff7`. [Draft #726](https://github.com/rybosome/tspice/pull/726) [CI run](https://github.com/rybosome/tspice/actions/runs/43558485387)                                                                                                                                                                                             |
| C01-daf-navigation           | `dafbbs_c`, `dafcs_c`, `daffpa_c`, `dafgh_c`, `dafgn_c`, `dafgs_c`, `dafhsf_c`, `dafopw_c`                                                                                 | Existing FileIoApi and owner-local DAF registry.                                                                                          | Final evidence head `b291e105`. [Draft #727](https://github.com/rybosome/tspice/pull/727) [CI run](https://github.com/rybosome/tspice/actions/runs/43561069205)                                                                                                                                                                                             |
| B01-cell-arrays              | `appndc_c`, `appndd_c`, `appndi_c`, `copy_c`, `elemc_c`, `elemd_c`, `elemi_c`                                                                                              | Existing CellsWindowsApi, stacked on the owner-registry support in [#722](https://github.com/rybosome/tspice/pull/722).                   | Final evidence head `85fd07af` on [draft #728](https://github.com/rybosome/tspice/pull/728). [Final matrix](https://github.com/rybosome/tspice/actions/runs/43562556413)                                                                                                                                                                                    |
| E10-plane-geometry           | `nvp2pl_c`, `pl2nvp_c`, `pl2psv_c`, `psv2pl_c`, `inrypl_c`, `vprjp_c`, `vprjpi_c`, `nplnpt_c`                                                                              | Existing geometry domain and four-word planes.                                                                                            | Source verified. Final evidence head `e41e264b` on [draft #729](https://github.com/rybosome/tspice/pull/729) awaits final matrix and explicit rebaseability.                                                                                                                                                                                                |
| A13-general-matrices         | `mequg_c`, `mtxmg_c`, `mtxvg_c`, `mxmg_c`, `mxmtg_c`, `mxvg_c`, `vtmvg_c`, `xposeg_c`                                                                                      | General row-major matrix operations on A10.                                                                                               | Stacked on A10 `fb98c999`. All 120 registered comparisons, 11 public/oracle, 19 native, 42 WASM and all eight in Chrome passed. [Draft #731](https://github.com/rybosome/tspice/pull/731)                                                                                                                                                                   |
| E01-orbital-elements         | `conics_c`, `eqncpv_c`, `oscelt_c`, `oscltx_c`, `prop2b_c`                                                                                                                 | Existing ephemeris domain, fixed state and element tuples.                                                                                | All five implemented with 102 registered comparisons, four public tests, 17 Node and 22 WASM focused tests, and actual Chrome. [Draft #730](https://github.com/rybosome/tspice/pull/730)                                                                                                                                                                    |
| A22-array-search             | `bschoc_c`, `bschoi_c`, `bsrchc_c`, `bsrchd_c`, `bsrchi_c`, `isrchc_c`, `isrchd_c`, `isrchi_c`                                                                             | Integer, double and character array searches.                                                                                             | Final metadata `47423c2e` on [draft #732](https://github.com/rybosome/tspice/pull/732). [Final-head CI](https://github.com/rybosome/tspice/actions/runs/43564692504)                                                                                                                                                                                        |
| A15-frame-algebra            | `frame_c`, `twovec_c`, `twovxf_c`, `eul2xf_c`, `xf2eul_c`, `xf2rav_c`, `rav2xf_c`, `invstm_c`, `xpose6_c`                                                                  | Existing FramesApi beside sxform. Stacked on [A12 #712](https://github.com/rybosome/tspice/pull/712) at `a1127d86`.                       | 94 registered comparisons, four public tests, 30 Node and 45 WASM boundary tests passed. Real Chrome exercised all nine. [Frame algebra evidence](https://github.com/rybosome/tspice/pull/736)                                                                                                                                                              |
| A20-string-tokenize          | `nextwd_c`, `nthwd_c`, `lparse_c`, `lparsm_c`, `lx4dec_c`, `lx4num_c`, `lx4sgn_c`, `lx4uns_c`, `lxqstr_c`                                                                  | Existing A18 StringsApi; nine byte-oriented word, list and scan methods.                                                                  | Draft [#735](https://github.com/rybosome/tspice/pull/735), source `4d4f03cd` passed canonical CI; final evidence in preparation.                                                                                                                                                                                                                            |
| A21-string-numeric           | `dp2hx_c`, `hx2dp_c`, `prsdp_c`, `prsint_c`, `repmc_c`, `repmct_c`, `repmd_c`, `repmf_c`, `repmi_c`, `repml_c`, `repmot_c`                                                 | A18 #719, shared string domain.                                                                                                           | Draft [#737](https://github.com/rybosome/tspice/pull/737), head `d53e2c8a`. [Canonical CI](https://github.com/rybosome/tspice/actions/runs/43566870555)                                                                                                                                                                                                     |
| E02-tle-propagation          | `evsgp4_c`, `getelm_c`                                                                                                                                                     | Existing EphemerisApi with two fixed rows and exact numeric tuples.                                                                       | [Draft #739](https://github.com/rybosome/tspice/pull/739), source `bd92b9f7`.                                                                                                                                                                                                                                                                               |
| D03-frame-additions          | `bltfrm_c`, `pxfrm2_c`, `tipbod_c`, `tisbod_c`, `tkfram_c`, `xfmsta_c`                                                                                                     | Existing frames domain on main `73f3fec8`.                                                                                                | Claimed in `codex/expand-frame-metadata`.                                                                                                                                                                                                                                                                                                                   |
| D01-time-additions           | `etcal_c`, `utc2et_c`, `tparch_c`, `tsetyr_c`, `et2lst_c`                                                                                                                  | Existing time domain on main `73f3fec8`.                                                                                                  | The five existing TimeApi methods are reviewed on corrected compiled source. [Semantic evidence](step8-civil-time.md).                                                                                                                                                                                                                                      |
| B02-set-algebra              | `diff_c`, `inter_c`, `sdiff_c`, `set_c`, `union_c`, `removc_c`, `removd_c`, `removi_c`, `ordc_c`, `ordd_c`, `ordi_c`                                                       | Uses [#728](https://github.com/rybosome/tspice/pull/728) at `85fd07af` for typed cell handles.                                            | Claimed on `codex/expand-set-algebra`.                                                                                                                                                                                                                                                                                                                      |
| C04-das-lifecycle            | `dasonw_c`, `dasops_c`, `dasopw_c`, `dashfn_c`, `dashfs_c`, `daslla_c`, `dasllc_c`, `dasrfr_c`, `daswbr_c`                                                                 | Independent on main 73f3fec8.                                                                                                             | Claimed on `codex/expand-das-lifecycle`.                                                                                                                                                                                                                                                                                                                    |
| C02-daf-records              | `dafps_c`, `dafus_c`, `dafgsr_c`, `dafrfr_c`, `dafrda_c`, `dafgda_c`                                                                                                       | C01 [#727](https://github.com/rybosome/tspice/pull/727) at `b291e105`.                                                                    | [Draft #738](https://github.com/rybosome/tspice/pull/738), source `0138a1b3` on C01.                                                                                                                                                                                                                                                                        |
| B05-kernel-pool              | `badkpv_c`, `bodvcd_c`, `bodvrd_c`, `clpool_c`, `dvpool_c`, `ldpool_c`, `lmpool_c`, `stpool_c`, `szpool_c`                                                                 | Existing kernel-pool API on main 73f3fec8.                                                                                                | Corrected source `2b1e2fc5` on [draft #734](https://github.com/rybosome/tspice/pull/734). [Canonical CI](https://github.com/rybosome/tspice/actions/runs/43565521263)                                                                                                                                                                                       |
| E11-ellipse-geometry         | `cgv2el_c`, `el2cgv_c`, `saelgv_c`, `pjelpl_c`, `inelpl_c`, `inedpl_c`, `npelpt_c`                                                                                         | Existing geometry domain, owned ellipse vectors and E10 planes.                                                                           | Draft [#733](https://github.com/rybosome/tspice/pull/733), final evidence head `a2689f58`. [CI](https://github.com/rybosome/tspice/actions/runs/43565795548)                                                                                                                                                                                                |

A01, A02 and A05 are PR-ready. Each final head passed all 15 CI jobs and an explicit after-CI rebaseability check. All three await maintainer review.

Review identified repeated reads of caller arrays in nine earlier batches:
A05, A08, A09, A12, A06, A03, A10, A11 and A16. Their adapters now use stable
input snapshots with corresponding boundary regressions. Fresh source-bound
validation is required. Earlier execution records still document the source that ran.
The corrected head of #709 passed fresh source validation and all final checks. The JSON queue retains the earlier readiness history for #709 and #710.

A17 has 53 registered scenarios / 132 actual calls, including 11 genuine errors.
Its native paired-input repair copies exactly the validated counts. All six
independent Python wrappers call the locked library; required corrected-source
backend and CI evidence must be recorded separately. The active ownership table records the current pull requests.

A14 is stacked on A12 at `a1127d866930e7e3be177d4fceee94a3a220b5c0`. A finite quaternion with components of magnitude 1e200 can produce NaN entries through the pinned `q2m_c`. A14 depends on A12’s Mat3 result helper, which retains those values. [A12 pull request](https://github.com/rybosome/tspice/pull/712)

## Reading and maintaining the queue

Each JSON batch records its exact routines, proposed domain/API placement,
owner, status, batch dependencies, prerequisite investigation, fixture needs,
locked-oracle availability, expected implementation changes, PR URLs, validation
evidence and next action. Proposed type/fixture/ABI work is explicitly unresolved
until reviewed. The graph does not require public wrappers for internal CSPICE
callees. A19 uses the StringsApi introduced in A18. B01 depends on B03’s
ordinary-cell and window ownership distinction.

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
investigation in PR #707; its earlier live validation is recorded in PR #714. The adapter correction still requires fresh evidence.
A04 now has independently typed locked C symbols for all six storage routines. Its exact guarded-memory evidence and remaining verification are recorded in its own audit. A20 independently binds NEXTWD and NTHWD in the locked library and verifies their returned bytes and indexes. The other listed gaps retain their investigation prerequisites. If a route cannot
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

## E02 source validation checkpoint

[PR #739](https://github.com/rybosome/tspice/pull/739) remains in progress. Both complete required lanes passed locally on bd92b9f7c8ca4b3c01617b316830fecfa2d31e39. JavaScript: 2,483 parity tests and one expected guard skip. Native-required: 2,264 registered Node/WASM live comparisons; 2,484 parity-package tests with no skips, including the native-required guard; 70 native wrapper, 611 WASM, 28 core and 150 facade tests passed. The [canonical native-required job](https://github.com/rybosome/tspice/actions/runs/43568124187/job/132366361966) confirms the same results. The complete final-head matrix and explicit GitHub rebaseability remain separate handoff requirements.

## D01 source validation checkpoint

[PR #741](https://github.com/rybosome/tspice/pull/741) remains in progress. Both complete required lanes passed locally on 76c549f2deb557021ec0cdb6b6da3ce20ff90b37. JavaScript: 2,510 parity tests and one expected guard skip. Native-required: 2,294 registered Node/WASM live comparisons; 2,511 parity-package tests with no skips, including the native-required guard; 80 native wrapper, 620 WASM, 28 core and 150 facade tests passed. The [canonical native-required job](https://github.com/rybosome/tspice/actions/runs/43570044988/job/132372232193) confirms the same results. The complete final-head matrix and explicit GitHub rebaseability remain separate handoff requirements.
