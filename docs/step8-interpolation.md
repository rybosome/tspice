# Interpolation semantics and numerical evidence

A17 adds six canonical routines through the existing flat raw coordinate API.
Every route uses the actual CSPICE entrypoint. Point counts/dimensions are
inferred from complete readonly arrays, input order is preserved, and numerical
outputs retain actual NaN, infinity and zero signs. No sorting, deduplication,
clamping or replacement interpolation formula is introduced.

| Method                       | Inputs and complete output                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `hrmesp(first,step,yvals,x)` | Equal nodes `first+i*step`; interleaved value/first-derivative pairs; returns `{f,df}`.                |
| `hrmint(xvals,yvals,x)`      | Explicit distinct nodes with interleaved value/derivative pairs; returns `{f,df}`.                     |
| `lgresp(first,step,yvals,x)` | Equal nodes with one value per node; returns the scalar Lagrange value.                                |
| `lgrind(xvals,yvals,x)`      | Corresponding nodes/values; returns `{p,dp}`.                                                          |
| `lgrint(xvals,yvals,x)`      | Corresponding nodes/values; returns the scalar Lagrange value.                                         |
| `qderiv(f0,f2,delta)`        | Endpoint vectors separated by `2*delta`; returns every midpoint derivative estimate in an owned array. |

All numeric inputs are finite. Hermite ordinates are `[f0,df0,f1,df1,...]`, so
`hrmesp` requires even length and `hrmint` requires exactly twice as many ordinate
entries as nodes. Lagrange node/value arrays have equal lengths. Derivatives
are with respect to the supplied abscissa, not node index or a normalized
coordinate; changing step or node scale must preserve those units. Each returned
object and the derivative vector owns its data. All scientific inputs are
project-authored and kernel-free.

## Point ordering, spacing and scientific errors

Equal-spacing routines allow a negative step and retain the supplied orientation.
A zero step produces actual `SPICE(INVALIDSTEPSIZE)`, including a single-node
request. All five interpolation routines pass zero nodes to actual CSPICE and
receive `SPICE(INVALIDSIZE)`; valid non-null sentinel storage avoids introducing
a pointer error before that scientific check. Explicit-node Hermite/Lagrange
routines signal `SPICE(DIVIDEBYZERO)` for repeated abscissae. Length mismatch,
incomplete Hermite pairs and nonfinite values are separate wrapper errors.

The primary Lagrange contracts specify distinct **increasing** explicit nodes.
The raw adapter preserves them without sorting or deduplication; acceptance uses
the documented ordered domain apart from genuine duplicate-error cases. Hermite
explicit-node ordering is preserved with its supplied value/derivative pairs.
Single-node Hermite interpolation retains the supplied derivative; single-node
Lagrange interpolation is constant, with zero derivative where returned.

No routine clamps the query to the sample interval. Extrapolation, high degree,
small point separation and large intermediate products can amplify rounding or
overflow. Ordinary fixtures must make both the value and derivative observable
rather than relying only on interpolation at a sample. Actual error recovery is
checked separately from invalid-shape guards. References:
[hrmesp](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmesp_c.html),
[hrmint](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmint_c.html),
[lgresp](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgresp_c.html),
[lgrind](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrind_c.html),
and [lgrint](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrint_c.html).

## Hidden workspace and signed-index limits

The bounds account for the actual pinned C and translated Fortran expressions,
not merely public array dimensions:

| Routine  | Maximum native/shared-C count | Source reason                                                                                              | WASM effective count ceiling |
| -------- | ----------------------------: | ---------------------------------------------------------------------------------------------------------- | ---------------------------: |
| `hrmesp` |              67,108,863 nodes | C wrapper stores `32*n` internal workspace bytes in `SpiceInt`.                                            |             8,388,608 nodes. |
| `hrmint` |             357,913,941 nodes | Unreduced translated index can reach `6*n-1` before subtracting its offset; workspace holds `4*n` doubles. |             8,388,608 nodes. |
| `lgresp` |             268,435,455 nodes | C wrapper stores `8*n` internal workspace bytes in `SpiceInt`.                                             |            33,554,432 nodes. |
| `lgrind` |             715,827,882 nodes | Unreduced translated index can reach `3*n`; workspace holds `2*n` doubles.                                 |            16,777,216 nodes. |
| `lgrint` |             268,435,455 nodes | C wrapper stores `8*n` internal workspace bytes in `SpiceInt`.                                             |            33,554,432 nodes. |
| `qderiv` |      2,147,483,646 components | Translated `vlcomg` uses an inclusive signed loop counter.                                                 |       33,554,432 components. |

WASM retains a 256 MiB **per-buffer** policy, including hidden workspace that
CSPICE allocates internally. Checked size arithmetic and source-specific bounds
run before giant traversal/allocation or scientific calls. These are ceilings,
not promises of practical memory or executed maximum-size support. Boundary tests
use synthetic lengths and valid sentinel buffers to reject out-of-domain counts
without executing undefined arithmetic.

`hrmesp_c`, `lgresp_c` and `lgrint_c` allocate their own toolkit workspace and
free it after the underlying routine, including its scientific error path.
`hrmint` and `lgrind` receive separate adapter-owned workspace. The toolkit
wrappers can signal `SPICE(MALLOCFAILED)` on internal allocation failure;
source inspection of that branch is distinct from deliberately injecting such
a failure. Adapter `_malloc` fault tests must not be described as exhaustive
fault injection into CSPICE's internal allocator.

## Quadratic midpoint derivative

`delta` is half the endpoint separation and may have either sign. Actual
`qderiv` computes `(0.5/delta)*f2 + (-0.5/delta)*f0` through translated `vlcomg`.
Although algebraically equivalent, subtracting the endpoint vectors first and
dividing later can change overflow, underflow and cancellation. The raw path
retains the source operation order and every component, including positions
beyond a three-vector shape.

Zero delta produces genuine `SPICE(DIVIDEBYZERO)`. The primary contract explicitly
does not define portable behavior for dimension below one, so empty vectors are
rejected before C rather than accepted as a scientific empty-result case.
Endpoint vectors must have equal positive lengths. This precondition does not
exclude the routine or weaken its defined-domain oracle comparison.
[qderiv reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qderiv_c.html).

## Independent routes, ownership and source evidence

Locked SpiceyPy 6.0.3 has all six wrappers. Inspected source calls each actual
canonical symbol. Equal-spacing point counts are inferred from complete arrays,
explicit-node counts come from `xvals`, and the derivative dimension comes from
`f0`. The sidecar validates complete Hermite pairs, corresponding lengths,
source-safe counts and finite entries before invoking those wrappers. Empty
interpolation tables retain actual invalid-size errors; unsupported empty
`qderiv` calls are rejected independently. No substitute numerical algorithm or
new C oracle binding is needed for this family.

Every returned field reaches comparison: both `{f,df}` or `{p,dp}` entries,
scalar values, and the complete `qderiv` vector. Native uses owned input/output
and explicit workspace storage under the existing global SPICE mutex. Shared C
validates dimensions/pointers, calls actual CSPICE, captures/resets errors and
returns status; adapters publish results only after successful status. WASM
checks buffer bounds, uses transactional allocation and copies output before
release. Public clients are disposed and repeated scientific failures must
leave valid-call recovery intact.

The native array-copy helper now consumes the previously validated count for
each argument, including both entries per Hermite node. If a paired array changes
during preparation, missing entries fail finite-value validation before CSPICE.
The [adapter and actual-addon regressions](../packages/backend-node/test/interpolation-domain.test.ts)
cover all four explicit paired-input methods. Valid input layouts and scientific
output semantics are unchanged.

The six registered files contain 53 scenarios and 132 actual calls: 121 succeed
and 11 signal genuine SPICE errors. The [focused public checks](../packages/py-parity-checking/test/interpolation.test.ts)
make tiny ordinates observable by rescaling outputs, and distinguish change in
abscissa units from change in ordinates. The [tagged probes](../packages/py-parity-checking/test/interpolation-extremes.test.ts)
compare 13 complete observations per backend, including nonfinite results.
With maximum finite values the five interpolators can return positive infinity
while a returned derivative remains maximum-finite. For `qderiv`, maximum-finite
opposite endpoints and half-spacing preserve components near ±1 and a nonzero
subnormal component; minimum-positive half-spacing on `[0,1]`, `[1,2]` yields
two NaNs without a SPICE failure. Finite controls are retained. The
[allocation suite](../packages/backend-wasm/test/interpolation-allocations.test.ts)
targets 27 adapter allocation-failure positions across the six methods, successful
paths, checked byte ceilings, genuine errors and owned-copy recovery.

Independent source smoke used Python 3.12.15, SpiceyPy 6.0.3 and macOS arm64
`libcspice.so` SHA-256
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
All registered calls, tagged observations and the focused oracle guard/recovery
program ran against that installed library. Shape, finite-input and count
guards are not counted as scientific calls. Compiled backend evidence remains
separate from this independent smoke.

The inspected N0067 source hashes are:

| File         | SHA-256                                                            |
| ------------ | ------------------------------------------------------------------ |
| `hrmesp_c.c` | `2af9487db4e91372debfcd18af272873fb3b774f454d8d9920710d028204d9d8` |
| `hrmesp.c`   | `ce7832e7f2b0b48bf7e4b3b1ca9e1f4f6d1c7b0db129f6228e61a48aec7ca7b9` |
| `hrmint.c`   | `6ef4e2b9015db2b60d114ccded44f7ef80d5c9a846d52e26b95a43205b18b5ab` |
| `lgresp_c.c` | `8219071899b17f73ecbbed9a00af217a278a9e5272e883439c4ff6eb2a2c88a5` |
| `lgresp.c`   | `9ea7d622702e4f5508b2d0030a94b0b60a7061ce58ffc7cd7418799c2e83894e` |
| `lgrind.c`   | `2874ee2bd38f65f64f32f2116799a5fe8382de72d5aa7741a9d71ac05ea76773` |
| `lgrint_c.c` | `f3802c5862bc240c51a927a0ab5f6c9865871c842b24bc2deb9ee1b5568294a2` |
| `lgrint.c`   | `42c2992cc4a270240717636e3de6354f2c362e1d355f5bb179cacfecaca253de` |
| `qderiv_c.c` | `d8031da7ea23159845b678c3becd515dad5bfb63411355889083ebfe39c96002` |
| `qderiv.c`   | `d99d0b9f7d7a94b1fd696166f0040c438286ff4fa9b5184a026d8ed74bbb60d7` |
| `vlcomg.c`   | `7b4f8b0395ec988ab5ac6595dcf5abca7a326f83c51a3171802be034baba61be` |

Source review does not establish final backend verification. Fresh required local and observed canonical CI evidence remains separate and must match the final source digest.
