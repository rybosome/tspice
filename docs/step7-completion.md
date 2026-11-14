# Step 7: consolidated existing raw parity audit

[PR #706](https://github.com/rybosome/tspice/pull/706) is the single delivery PR
for the remaining Step 7 work. It targets current `main` at
`c5f0b058da08940f2fc7cb0453c9508663d91434`, which already includes #681–#687.
The remaining #688–#705 PRs are retained as individual review records. They do
not need separate rebases or merges before #706. After an explicitly authorized
merge of #706, those superseded PRs can be closed with a link to it.

The consolidated source contains semantic reviews for all **162 contract-present
routines** from baseline `3f950ae22993aaf9a629263a12388bf56894879c`:
**324 backend judgments across 23 maintained batches**. Every record retains its
NAIF references, implementation trace, scenario observations, fixture provenance,
cleanup/error assessments and repair evidence. Registration alone does not
certify parity. All 324 backend judgments are verified on the current integrated source; earlier
source/job observations remain historical.

There are zero open findings and no support exceptions. The inventory remains
652 canonical / 649 eligible / 162 implemented / 487 planned / 3 excluded.
The planned-routine expansion has not started.

## Integration and source preservation

The delivery branch starts directly from current main. The previously reviewed
combined assembly `43a4f952d07896561b8aedecab6da54cee064cb7` supplies the remaining
changes. Its executable, test, workflow and build inputs are preserved exactly;
recent main and #687 audit assessments and execution history are retained as
well. Shared frame helpers, opaque ownership, complete workflow types, every
early-close file path and BODFND/BODVAR ledger expectations are preserved.

The exact component heads, review sources, deduplication and resolution notes are
recorded in [the integration manifest](../data/step7-integration-sources.json).
The already-merged SPK/PCK offline repair from #686 is not replayed; the DSK
offline repair from #693 is included. Original review heads #688–#705 were
snapshotted before integration and match the reviewed assembly inputs.

The [per-PR readiness snapshot](../data/step7-pr-readiness.json) is explicitly
historical. Its old CI/rebaseability observations apply to those exact heads and
bases. Merge readiness now comes from #706's current main base and integrated CI.

## Coverage and verification

Registered scenarios increased from 305 to **1,109**, an increase of 804. The
complete live suite has **2,218 comparisons**, one per scenario on actual Node
and WASM, against locked SpiceyPy 6.0.3 / CSPICE N0067. Meaningful success,
edge/error, state and lifecycle evidence is recorded per routine. Error-free
routines explain that assessment instead of inventing failures. Harness
preconditions remain distinct from scientific errors; reporter effects are
compared in real child processes.

The 1e-12 absolute-or-relative comparator is unchanged. Independent analytic
bounds remain narrow and documented. Authored kernels use invented IDs, states,
frames, shapes and tables under MIT, with generators/provenance in the fixture
README. Existing external kernel bytes are unchanged; no mission observations
are added.

Fresh regeneration through the pinned owning Emscripten 3.1.74 script produced
identical Node/web binary SHA256
`31f67b0204e16fd1c95c483d5d9f554911b3d1f97daf2cb93af9794dc3a71911`.
It matches the reviewed combined artifact. Generated glue/binary were not
hand-edited. All three doctors passed with Node 22.23.4 / pnpm 10.13.1,
production N0067 and locked Python 3.12.15 / SpiceyPy 6.0.3.

Both complete required local lanes passed with matching task caches. An additional
`TSPICE_EXPECT_NATIVE=true pnpm run test:required --force` executed all 15 graph
tasks with **zero cache hits**, passing all **2,218 live comparisons** and all
**2,431 parity-package tests without skips**, plus 600 WASM / 66 Node / 28 core /
150 facade tests. All 38 ledger regressions, generated drift, formatting, lint
and typecheck passed. Current-source canonical CI passed all 15 jobs; no historical
run is relabeled.

Current delivery source `388063d4ee0c81c58b3ed653d84a9195e4f31da7` passed
[all 15 canonical jobs](https://github.com/rybosome/tspice/actions/runs/43521244532).
Its inspected [Linux Node22 native-required job](https://github.com/rybosome/tspice/actions/runs/43521244532/job/132215745970)
freshly executed all 2,218 live comparisons and all 2,431 parity-package tests
without skips, plus 600 WASM / 66 Node / 28 core / 150 facade tests. All current
maintained records identify that actual tested source/job. REST explicitly
confirmed mergeability and rebaseability against unchanged current main. Final
verification-metadata CI is linked from PR #706; executable/test/build inputs
remain identical to this source.

Historical combined source `30753720aaed683d25a1807a7a789b3a8d1fe43a` passed
[all 15 canonical jobs](https://github.com/rybosome/tspice/actions/runs/43428741796).
Its [Linux Node22 native-required job](https://github.com/rybosome/tspice/actions/runs/43428741796/job/131896580478)
ran all 2,218 comparisons and 2,431 parity-package tests without skips. This is
retained historical evidence, separate from the new delivery branch's checks.
The final current validation note and exact final-head CI are on PR #706.

## Defects repaired

- Test/build ownership: a synchronized reproducer observed consumed package
  exports disappear during artifact replacement. Build/preparation ownership and
  no-emit typechecking remove overlapping writers, with cold/warm/direct-command
  integration regressions. Native-required execution remains fail-closed.
- Actual raw WASM `kplfrm`: the compiled operation replaces the harness fallback;
  real class/frame results, errors and cell effects now reach live comparison.
- Ownership and cleanup: nonreused owner-local opaque cell/window/file tokens,
  allocation capacities, close-failure retry and cleanup before scratch deletion
  prevent foreign/stale aliases and leaked resources. CK physical handle
  semantics remain distinct from invented opaque file tokens.
- Bounds and memory: checked cell/GF/workspace/output arithmetic, exact vector
  and state layouts, private EK row-pointer storage, protected temporary string
  allocations and strict typed boundaries address concrete overruns, truncation,
  signed overflow and allocation-failure leaks.
- Opaque SPK descriptors: all packed bytes survive native/WASM and worker/RPC
  transport, including valid NaN bit patterns; comparisons unpack every integer
  field rather than numerically normalizing opaque words.
- Semantic assertions: complete matrices, sets, windows, state vectors, segment
  descriptors, EK values, geometry vectors/epochs/angles/flags and GF endpoints
  reach comparisons. Setter effects, load order, duplicate claims, error recovery
  and independent physical/analytic expectations distinguish real behavior.
- Oracle and output handling: scoped found handling preserves scientific errors;
  native stdout is drained before restoring sidecar FD1; WASM GF initialization
  drains the actual TTY display. Diagnostic leading blanks remain significant.
- Offline reliability: exact tracked SPK/PCK/DSK fixtures satisfy existing tests;
  isolated empty-cache/no-network controls exposed the prior unnecessary fetches.

## Retained review units

The individual PRs remain available for domain review and historical evidence.
Their changes are delivered together through #706; the integration manifest
records their exact heads.

| Review PR                                           | Scope                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| [#688](https://github.com/rybosome/tspice/pull/688) | Time parsing, formatting and persistent defaults                         |
| [#689](https://github.com/rybosome/tspice/pull/689) | UTC and spacecraft clock partitions and precision                        |
| [#690](https://github.com/rybosome/tspice/pull/690) | Kernel lifecycle, metadata and keyword extraction                        |
| [#691](https://github.com/rybosome/tspice/pull/691) | Opaque file ownership shared prerequisite                                |
| [#692](https://github.com/rybosome/tspice/pull/692) | DAF/DAS reader state, descriptors and cleanup                            |
| [#693](https://github.com/rybosome/tspice/pull/693) | Offline DSK traversal fixture                                            |
| [#694](https://github.com/rybosome/tspice/pull/694) | DLA/DSK writers and index bounds                                         |
| [#695](https://github.com/rybosome/tspice/pull/695) | DSK query unions, shapes and resource bounds                             |
| [#696](https://github.com/rybosome/tspice/pull/696) | EK file/segment lifecycle and cleanup                                    |
| [#697](https://github.com/rybosome/tspice/pull/697) | EK columns, query results and native storage bounds                      |
| [#698](https://github.com/rybosome/tspice/pull/698) | Frame metadata and dynamic transforms                                    |
| [#699](https://github.com/rybosome/tspice/pull/699) | CK pointing, coverage, priority and cleanup                              |
| [#700](https://github.com/rybosome/tspice/pull/700) | Opaque SPK descriptor bits and transport                                 |
| [#701](https://github.com/rybosome/tspice/pull/701) | Offline SPK/PCK repair deduplicated with main; DSK prerequisite retained |
| [#702](https://github.com/rybosome/tspice/pull/702) | SPK file lifecycle, type8 writers and coverage                           |
| [#703](https://github.com/rybosome/tspice/pull/703) | SPK states, aberration modes and segment search                          |
| [#704](https://github.com/rybosome/tspice/pull/704) | Surface geometry, illumination, occultations and planes                  |
| [#705](https://github.com/rybosome/tspice/pull/705) | GF event windows, state, allocation and reporter output                  |

## Retained failure evidence and limits

The actual #686 Linux Node20 [download failure](https://github.com/rybosome/tspice/actions/runs/43401231458/job/131804285643)
(`UND_ERR_SOCKET` after 126506 bytes) remains inspectable. Exact tracked fixture
reuse and an isolated empty-cache/network-disabled regression repair that path.
The earlier DSK timeout and all race, allocation, bounds, oracle and reporter
negative controls remain linked from the original PRs and maintained records.
No observed failure is discarded or converted to passing evidence by a retry.

The earlier report-only [run 43432185224](https://github.com/rybosome/tspice/actions/runs/43432185224)
was canceled after confirming it had no failed jobs, solely to free runners for
the historical final checkpoint. Successful source-proof runs are preserved.
This event is separate from the current consolidation's validation.

CSPICE global state still requires process/worker isolation. Documented pinned
scientific preconditions remain explicit, including creator-produced plane
storage, GF point equality-to-zero limits and N0067 ILLUMF surface-list behavior.
The architecture and raw/kit boundary are preserved.

Review and final CI verification of #706 precede a separately authorized merge.
The 487 planned routines remain outside this assignment.
