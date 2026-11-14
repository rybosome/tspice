# Coordinate conventions and numerical evidence

A06 adds `azlrec_c`, `recazl_c`, `pgrrec_c`, `recpgr_c`, `radrec_c`,
`recrad_c` and `srfrec_c` through the existing flat `raw` coordinate API.
Every path calls the actual routine in pinned CSPICE N0067. The
[per-routine audit](../data/parity-audits/a06-coordinate-conventions.json)
records exact registered cases, source traces, fixture and cleanup evidence.
Review and independent oracle observations alone do not establish compiled
backend or canonical CI verification.

## Angle and body conventions

`azlrec` and `recazl` have two independent boolean choices: `azccw` selects
azimuth toward +Y or -Y from +X; `elplsz` selects elevation toward +Z or -Z.
All four combinations have live cases with nonzero azimuth and elevation.
`radrec`/`recrad` always use right ascension from +X toward +Y and declination
toward +Z. Rectangular-to-angular results retain CSPICE's [0, 2*pi] azimuth/RA
range, including its branch behavior near +X. At the origin both angles are
zero; at either Z pole azimuth/RA is zero. Forward routines accept negative
range and unwrapped finite angles. No adapter angle normalization is added.
See [azlrec](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/azlrec_c.html),
[recazl](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recazl_c.html),
[radrec](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/radrec_c.html) and
[recrad](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recrad_c.html).

Planetographic longitude in `pgrrec`/`recpgr` uses current body-specific pool
state. A character `BODY<ID>_PGR_POSITIVE_LON` value of EAST or WEST overrides
rotation-derived direction; CSPICE handles case and surrounding spaces. Without
that override, a negative prime-meridian rate gives east-positive longitude;
a nonnegative rate gives west-positive longitude. Earth defaults east-positive.
Moon and Sun also default east-positive, but pinned N0067 looks up their PM
coefficient before applying that exception. They therefore still need numeric
`BODY301_PM`/`BODY10_PM` with at least two entries, or an explicit longitude
sense override. `plnsns.c` special-cases Earth alone. Actual locked-oracle calls
confirmed missing PM gives `MISSINGDATA` for Moon/Sun and succeeds for Earth.
This prerequisite is documented in both public method JSDoc entries. See
[pgrrec](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pgrrec_c.html) and
[recpgr](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recpgr_c.html).

The pinned implementations require `re > 0` and `f < 1`, and allow negative
flattening and altitude. Body strings reach CSPICE unchanged, including numeric
IDs and supported aliases. Both language/native boundaries reject embedded NUL
rather than allowing a truncated body name. Invalid names and scientific shape
parameters still reach their actual SPICE errors. Source review also distinguishes
an unrecognized character override (`INVALIDOPTION`) from a numeric override,
which is not found by the character lookup and falls through to PM lookup.
The numeric override and zero PM-rate branches are source-reviewed; the
registered cases do not separately cover them.

`srfrec` instead interprets longitude eastward and latitude **planetocentrically**,
using the ray from the center through a triaxial ellipsoid with current
`BODY<ID>_RADII`. Its latitude is not a spheroid normal's latitude. The oblate
[4,4,2] fixture and a literal pi/4 ray-intersection check distinguish those
meanings. Changing pool radii changes the next result, and clearing/reloading
restores the original result. See
[srfrec](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfrec_c.html).

## Authored fixture and isolation

`packages/py-parity-checking/fixtures/kernels/coordinate-conventions.tpc` contains
invented test constants under the repository MIT license, with no measurements:

- Bodies 9901001/9901002 have named aliases, PM rates +2/-3 and radii [3,2,1]/[4,4,2].
- Body 9901003 has an EAST override without PM and spherical radii [2,2,2].
- Sun/Moon have arbitrary positive PM coefficients to exercise their exceptions.

Its SHA-256 is `fac67e4f3d3cf3f5c3d6f3e6aef13a6ca67bb0c3f00b09c6a4dc1d32a21ea345`.
Cases load this file or author pool values directly; no LSK, SPK or external
planetary dataset is needed. The existing Node/WASM and Python case lifecycles
clear kernels and reset errors before each case, and perform best-effort cleanup
in finalization. Focused tests reset/clear in `finally` and dispose clients.
Explicit workflows observe override/radii changes and restoration instead of
merely calling cleanup. These are shared-state observations, not a claim that
simultaneous clients have independent SPICE pools.

Actual `srfrec` pool-error cases distinguish absent radii (`KERNELVARNOTFOUND`),
two radii (`INVALIDCOUNT`), four (`ARRAYTOOSMALL`), nonpositive axes
(`BADAXISLENGTH`) and character radii (`TYPEMISMATCH`). Same-client focused tests
repair the pool and call a valid conversion, checking recovery. They also reject
fractional/out-of-range body IDs while live cases exercise both signed32 limits.

## Independent numeric observations

The parity owner executed all 57 registered workflows through the new Python
decoder/handler: 38 successful finite-output scenarios and 19 expected errors.
They contain 188 steps: 152 new-routine calls and 36 existing state controls.
The locked environment was SpiceyPy 6.0.3 / Python 3.12.15 with N0067 library
SHA-256 `3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
Its top-level wrappers were inspected and invoke the corresponding C entrypoints.
These oracle observations are separate from the integration owner's backend runs.

The scoped `coordinate-conventions-overflow.test.ts` executes the same ten
observations independently against that oracle, encoding finite/NaN/signed
infinity categories without losing any scalar. Let `M` be the largest finite
double:

| Actual oracle input                                | Observed output                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `recazl([M,M,M], ...)`, all four flag combinations | Infinite range; azimuth pi/4 or 7*pi/4; elevation ±0.6154797086703873. |
| `recrad([M,M,M])`                                  | Infinite range, RA pi/4, declination +0.6154797086703873.              |
| `pgrrec("EARTH",0,0,M,M,0)`                        | `[Infinity,0,0]`.                                                      |
| `pgrrec("EARTH",0.7,-0.4,M,M,0)`                   | `[Infinity,Infinity,-1.4001093611154486e308]`.                         |

Three companion observations using `M/4` are finite controls. These ten calls
leave the SPICE failure flag false. By contrast, the registered
`coords-vectors-recpgr-finite-input-too-large-error` calls
`recpgr("EARTH",[M,M,M],3,0.2)` and observes `INPUTSTOOLARGE`. No adapter replaces
this error with fabricated coordinates or rejects successful infinite output.
The ordinary JSON workflow output cannot encode nonfinite values, so the scoped
extreme test supplements the registered cases without changing global comparison.

Normal comparisons retain `atol=rtol=1e-12`. The focused public test separately
rescales tiny distance outputs before comparing every component to the live
oracle, and multiplies the tiny positive near-axis RA by 1e15. These assertions
avoid treating tiny values as indistinguishable from zero. Literal sign, quadrant,
ray-intersection and ownership checks supplement independent output comparisons.
The 12 public tests, two ten-observation extreme tests, 26 WASM allocation tests
and direct native wrapper tests are traced by the audit; execution status is
recorded separately by the integration owner.

The first actual WASM allocation run exposed a test cleanup defect: it called a
kernel-pool method unavailable in this baseline. An intermediate replacement was
also unavailable. The repair uses existing `tspiceCall0(module,
module._tspice_kclear)`, the real kernels-domain cleanup path, and asserts the
fixture pool entry is absent afterward. Allocation failure/recovery and scientific
assertions remain unchanged. This narrow repaired test finding does not claim a
production repair; its rerun and required-lane observations are recorded separately.

## Pinned source review

The N0067 source archive is selected by the existing dependency manifest.
In its `src/cspice` directory, reviewed source SHA-256 values are:

| File       | SHA-256                                                            |
| ---------- | ------------------------------------------------------------------ |
| `pgrrec.c` | `07fed39992a2cb5acb9ab4b3493c20b732702014368c4f5b742bc5754d69a342` |
| `recpgr.c` | `43f385cb16306cacf3af682bb50609ad6d08fc37ab928a5b21dd10fc1dd633e9` |
| `plnsns.c` | `608940aa4ba1a9d8c2174f76d8dba44eec31a07c0140f72e291d001460522a90` |
| `srfrec.c` | `5aae379b70e7c50e180b86fc9d2b2b69b9a9b2e4f7ccb5e4c8969183bd81eab3` |

`pgrrec.c` lines 654–703 and `recpgr.c` lines 678–726 show override lookup,
PM prerequisite and exception ordering. `plnsns.c` lines 213–241 show the
Earth-only shortcut and numeric second-coefficient lookup. `srfrec.c`
lines 357–372 obtains validated radii through `zzgftreb_`, constructs a direction
through `latrec_` and calls `edpnt_`. No TypeScript replacement algorithm or
new exclusion was introduced.
