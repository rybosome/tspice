# Step 8 missing-wrapper investigation

All **23 routines missing top-level Python wrappers** in locked SpiceyPy 6.0.3
are present as exported symbols in both the pinned native N0067 `cspice.a` and
the locked oracle's `libcspice.so`. All have declarations in pinned
`include/SpiceZpr.h` and implementations in `src/cspice`. This inspection found
**zero unavailable toolkit routines**. Python-wrapper absence does not justify
an exclusion or a substitute implementation.

These are availability and ABI findings, not verified tspice coverage. No
production path, registry, acceptance threshold or exclusion was changed.
Batches remain subject to the shared [audit standard](parity-audit.md).

## Evidence inspected

The source is the toolkit fetched by the repository's pinned N0067 manifest,
not another CSPICE release. On the investigated macOS arm64 host, `nm -gU`
confirmed the 23 exported C names in both libraries. The oracle reported
`SpiceyPy 6.0.3` and `CSPICE_N0067`. Its `SpiceInt`/`SpiceBoolean` representations
are 4-byte `ctypes.c_int`, double is 8 bytes, and `SpiceDLADescr` is eight
consecutive integers: 32 bytes at offsets 0, 4, 8, 12, 16, 20, 24, 28. These agree
with the pinned platform declarations in `SpiceZdf.h` and `SpiceDLA.h`.

| Inspected input                           | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Native N0067 `lib/cspice.a`               | `f3a1adf1742c7a63c390834f4227936a36e3c18dd78bf427bc96a04b703946f3` |
| Native N0067 `include/SpiceZpr.h`         | `111f0e5c8a55599f60bed187228f08442bb2e4635becf05479346c6e56d2a87a` |
| Locked `spiceypy/utils/libcspice.so`      | `3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523` |
| Locked `spiceypy/spiceypy.py`             | `86aaf23ee18e1ba86ebdc97a69d1d3c533136b98ac833195eeb29824ff76f420` |
| Locked `spiceypy/utils/libspicehelper.py` | `713dea8792c046ac31f10687d0ab7d16a2a5bc1d52fd7a29b01cc1911f47a693` |

The local native install is
`/Users/ryaneiger/src/tspice/.cache/cspice/N0067/darwin-arm64/cspice`.
The oracle is the existing Step 7 integration venv under
`/private/tmp/tspice-step7-integration/packages/py-parity-checking/sidecars/spiceypy/.venv`.
These paths identify the observation; portable implementation must use the
repository's locked sidecar and toolchain discovery, not hard-code these paths.

A separate Python process called the actual oracle library through explicitly
typed `ctypes` functions. It obtained successful values/effects from **22 of 23**
routines. `illum_plid_pl02` reached a concrete coordinate-system precondition,
described below. No tspice shim or backend was loaded. This is a local arm64
capability probe, not a cross-platform parity suite or CI evidence.

The scratch probe was `/private/tmp/tspice-step8-oracle-probe.py` (SHA-256
`09b9dbbcf08bb5a097e82d6c95a3a162a6fb66f681f2ba1398f904f3176ff27b`), run by the
locked venv's `bin/python`. Its final observations were written to
`/private/tmp/tspice-step8-oracle-probe-final.json` (SHA-256
`a1649032a4585c7c0dae5f4a56ecea12112f2d9d0c12970bd0f28cdabdab2d6c`). These
scratch files are not durable acceptance artifacts. Before implementing a batch,
turn the relevant probes into reviewed sidecar handlers and registered cases.

## Independent routes and remaining work

| Routines                                                                                              | Existing library ABI and observed behavior                                                                                                                                                                                                                                    | Implementation requirement                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearc_c`, `cleard_c`, `cleari_c`, `filld_c`, `filli_c`, `moved_c`                                   | Typed writable arrays plus count/row width. Numeric probes changed only requested elements; `clearc_c` produced blank-padded, NUL-terminated rows, retaining an untouched row.                                                                                                | Bind each actual symbol with explicit argument and void return types. Observe whole output buffers, capacities and untouched regions. Check character widths, signed counts and memory ownership.           |
| `nextwd_c`, `nthwd_c`, `repml_c`                                                                      | Explicit input/output string buffers; `nthwd_c` also returns an integer location; `repml_c` takes an integer Boolean and a single `char` case selector. Probes returned `alpha`/`beta gamma`, `beta` at index 9, and `Answer: TRUE`.                                          | Preserve CSPICE blanks, truncation, byte indexing and output terminators. Do not replace these routines with Python or JavaScript string operations.                                                        |
| `dasrdc_c`, `dasudc_c`                                                                                | Both already have accurate six-integer-plus-pointer declarations in `libspicehelper.py` (lines 381 and 395). A scratch DAS written by locked `sp.dasadc` read as `.ABC.DEF` into selected columns, leaving sentinel columns intact; updating addresses 2–3 produced `AxyDEF`. | Define complete two-dimensional byte storage and substring bounds. Preserve 1-based DAS addresses and zero-based row positions. Close before deleting scratch files and test failures separately.           |
| `maxd_c`, `maxi_c`, `mind_c`, `mini_c`                                                                | Variadic C functions: fixed `SpiceInt` count followed by scalar arguments. Explicit `argtypes=[c_int]`, correct return type, and individually wrapped `c_double`/`c_int` arguments worked for 0, 1, 4 and 30 values.                                                          | Use a genuine variadic call on the independent oracle and a checked, bounded C arity dispatcher on tspice's shared shim. Never pass an array pointer where scalar varargs are required.                     |
| `putcml_c`                                                                                            | Count plus `char **argv`, returning void. A separate process stored three strings, retained them after the caller changed its array, and rejected another call with `SPICE(PUTCMLCALLEDTWICE)`.                                                                               | Correct the independent binding signature, validate every string, and treat state/storage as process lifetime. Payload observation needs an explicit test-only strategy; a void result alone is inadequate. |
| `illum_pl02`, `illum_plid_pl02`, `limb_pl02`, `llgrid_pl02`, `subpt_pl02`, `subsol_pl02`, `term_pl02` | All seven are actual exported, nonvariadic C functions. They use a DAS handle, `SpiceDLADescr*`, strings/scalars and typed vector/output arrays. Six succeeded on existing authored geometry fixtures; one requires a latitudinal DSK.                                        | Add small explicit independent bindings against the locked library. Preserve legacy routines' own semantics and complete outputs; supply their exact frame/coordinate prerequisites.                        |

### Variadic limits

NAIF defines the count as the number of following scalar values, returns zero for
a count below one, and limits defined portable use to at most 30 values. A count
mismatch or larger list must not be passed to C as a test. A shared-shim switch
for arities 0–30 can call the original functions directly without reimplementing
min/max mathematics. The oracle's fixed-argument declaration is especially
important for the Apple arm64 variadic calling convention. The 0/1/4/30 probes
passed on this host; other supported platforms still need CI execution.
[Primary NAIF `maxd_c` reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxd_c.html)

### Command state and an incorrect locked binding

Pinned `SpiceZpr.h:3666` declares `putcml_c` with `SpiceChar **argv`. Locked
`libspicehelper.py:1616` declares its second argument as `c_char_p`, which is
incorrect for a pointer array. Use a scoped function binding with
`POINTER(c_char_p)` and `restype=None`; do not reuse the incorrect prototype.
The implementation `zzgetcml_c.c:252–310` deep-copies the array/strings into
static storage. It permits initialization once per library lifetime and provides
no public reset/free operation. Temporary caller input can be released after
success; the library's retained storage must not be treated as per-call memory.

The probe used the existing C getter only to inspect that stored state, in its
own process. `getcml_c` remains excluded from the public raw API and inventory.
A future `putcml_c` batch must explicitly review how a test-only observer checks
payloads on each backend without adding that excluded public API. Separate
processes/library instances are needed for independent initial-state cases.
[Primary NAIF `putcml_c` reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/putcml_c.html)

### Legacy plate geometry prerequisites

Deprecation does not mean absence: NAIF retains `illum_pl02` for backward
compatibility, and the pinned source/library contains the entire seven-routine
family. Implement the requested routines themselves, rather than routing them to
newer geometry routines and claiming identical semantics.
[Primary NAIF `illum_pl02` reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/illum_pl02.html)

The existing MIT-authored `audit-geometry.tf`, `.bsp` and `.bds` fixtures supplied
real library calls. The probe added only process-local pool values: synthetic
Sun radii and `OBJECT_100101_FRAME = 'AUDIT_GEOMETRY_FIXED'`. Without that body
association, three older routines return `SPICE(IDCODENOTFOUND)` even though the
named frame exists. With it, `illum_pl02`, `subpt_pl02` and `subsol_pl02` succeeded.
`llgrid_pl02`, `limb_pl02` and `term_pl02` returned full point arrays and plate IDs.
All handles were closed and kernel/error state cleared after observation.

`illum_plid_pl02` rejected the fixture's rectangular coordinate code 3. Its
pinned source explicitly requires `SPICE_DSK_LATSYS` and, surprisingly, signals
`SPICE(FRAMENAMENOTFOUND)` for that coordinate-system mismatch
(`illum_plid_pl02.c:1357–1367`). Preserve the actual code rather than relabeling
it as a guessed error. Its success path needs a small independently generated
latitudinal DSK with correct radial bounds. No library absence, ABI failure or
new exclusion is indicated by this fixture mismatch.

### Additional locked-oracle defect: `errprt`

While configuring the probe, locked `spiceypy.py:5735` called `libspice.errdev_c`
inside `errprt()`. Thus asking it to suppress error items changed the output
device to a filename instead. The first attempt produced `WRLINE` file-open
errors and an owned scratch file named `NONE`; that file was removed. The final
probe used the actual `errprt_c` symbol with a correctly typed buffer and had no
such output contamination.

This affects planned batch `B07-error-policy`, although `errprt_c` does have a
Python wrapper. A present wrapper cannot be assumed to call the intended routine.
Its future oracle must bind actual `errprt_c`, observe message selection and
verify the output device remains unchanged. No production or existing Step 7
routine was repaired as part of this investigation.

The next decisions are implementation details and evidence work, not denominator
changes: review the minimal independent bindings, prepare the one missing legacy
success fixture, and establish the command-state observation/lifetime strategy.
Keep all 23 routines eligible and all affected batches unverified until their
complete Node/WASM paths and meaningful live comparisons pass required CI.
