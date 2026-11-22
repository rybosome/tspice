# Window algebra

The raw methods operate on existing `SpiceWindow` handles. The existing
window allocator takes maximum interval count. A canonical double window
stores two endpoints per interval in sorted order and represents closed
intervals, including singletons. Each input window must satisfy the documented
window preconditions before use. The caller owns the result window for
complement, difference, intersection and union. That result must have
sufficient capacity and be distinct from every input. A binary operation may
receive the same handle for both input operands.

| Method   | Observable effect or result                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wncomd` | Write the closed complement inside the supplied left and right bounds to the result. Boundary points can be present in both the original and its closed complement.             |
| `wncond` | Move each left endpoint to the right by the left adjustment and each right endpoint to the left by the right adjustment. Remove inverted intervals and retain valid singletons. |
| `wndifd` | Write the closure of the difference of the input windows in the supplied order.                                                                                                 |
| `wnelmd` | Test membership of a point, including either endpoint of a closed interval.                                                                                                     |
| `wnexpd` | Expand intervals by the independent left/right amounts and merge overlapping or touching results.                                                                               |
| `wnextd` | Replace each interval with a singleton at its selected left or right endpoint.                                                                                                  |
| `wnfild` | Fill adjacent gaps whose measure is at most the supplied threshold.                                                                                                             |
| `wnfltd` | Remove intervals whose measure is at most the supplied threshold.                                                                                                               |
| `wnincd` | Test whether one stored interval contains the complete supplied interval.                                                                                                       |
| `wnintd` | Write the intersection to the caller's result window, retaining touching-point singletons.                                                                                      |
| `wnreld` | Evaluate the supplied window set relation, accounting for proper versus non-strict containment.                                                                                 |
| `wnsumd` | Return total and average measure, population standard deviation and the endpoint offsets of the first shortest and longest intervals.                                           |
| `wnunid` | Write the union to the caller's result window with merging subject to the pinned full-capacity behavior documented below.                                                       |

A mutation returning void is observed through subsequent actual window reads.
Inputs and output handles retain their own identities. An error can change
the contents of a result window. The post-error probes below retain the
inputs, destination, and capacity across each read and recovery.

`wnsumd_c` returns zero-based offsets into the endpoint array. For a nonempty
window an offset of 2 identifies the second interval's left endpoint. Equal
measures select the first shortest or longest interval. For an empty window
the translated routine initializes both indices to zero and the C wrapper
decrements them, giving −1 for each offset. The three measure fields are
zero. A valid nonempty window made entirely of singletons can also have zero
total measure, with actual endpoint offsets for its first interval.
[NAIF window summary](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnsumd_c.html)

The locked high-level SpiceyPy output-window wrappers choose their own
capacity, so the independent oracle binds `wncomd_c`, `wndifd_c`, `wnintd_c`
and `wnunid_c` from the library already loaded by SpiceyPy and passes the
actual preallocated result cell. It inspects the toolkit error status after
the call. The existing cell/window lifecycle owns the input and result
objects. The high-level `wnextd` wrapper accepts uppercase L/R only. The
oracle uses the actual symbol for other single ASCII selectors so lowercase
and invalid selectors retain canonical behavior. The remaining routines
use the installed canonical SpiceyPy wrappers directly.
[Independent result-cell and endpoint-selector bindings](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/window_algebra_oracle.py)

## Output capacity and failure state

A bounded test calls the four output routines with
A = [1,3], [7,11], [23,27] and B = [2,4], [6,8], [20,24], [28,30].
The result has space for one interval and starts either empty or populated
with [101,102]. Each call raises `SPICE(WINDOWEXCESS)`. The C wrappers
skip copying the translated routine’s final control values back to the C
descriptor on failure. A generic `card` therefore reads its starting
endpoint count, zero or two. A window-specific `wncard` reads one interval,
and `wnfetd` retrieves the actual pair written.

| Operation                 | Interval read after the error |
| ------------------------- | ----------------------------- |
| Complement of A on [0,30] | [0,1]                         |
| A minus B                 | [1,2]                         |
| A intersect B             | [2,3]                         |
| A union B                 | [1,3]                         |

The shim keeps the registered window’s bounded control state available for
subsequent window reads. Explicitly setting the result’s cardinality to zero
and then inserting [−9,−7] yields that single interval in every probe.
[Independent caller-owned result and recovery checks](../packages/py-parity-checking/test/window-algebra.test.ts)

The actual N0067 union can also succeed with a capacity-dependent result.
For [0,4] and [2,8], a result with space for two intervals contains [0,8].
With space for one it contains [0,4]. With logical capacity zero it is
empty. Once the last interval fills the output, the translated routine
updates its local end variable for a later overlap without writing the new
right endpoint into the result. The API passes the chosen capacity to
CSPICE unchanged.
[Registered union cases](../packages/py-parity-checking/src/cases/cells-windows/wnunid.cases.json)

## Bounds, selectors and statistics

The adapters take finite scalar bounds, points, signed margins and
thresholds. Negative margins may reverse contraction or expansion. Both
operations drop inverted intervals, retain singletons and merge intervals
that come to touch. A `wnincd` query with reversed endpoints still evaluates
the supplied pair of inequalities in the pinned routine. Its ordinary
interval-inclusion interpretation applies to ordered bounds.
[NAIF interval inclusion](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnincd_c.html)

An unknown single-byte endpoint selector signals
`SPICE(INVALIDENDPNTSPEC)`. Window relations allow trailing blanks. An
unsupported or leading-blank relation gives `SPICE(INVALIDOPERATION)`,
and the empty C string gives `SPICE(EMPTYSTRING)`. The API rejects a
malformed or NUL-containing relation string before calling the toolkit.
The lifetime and kind of each opaque window handle are checked separately.
[Raw cell and window API](../packages/backend-contract/src/domains/cells-windows.ts)

The odd-cardinality test inserts one interval, sets the generic endpoint
cardinality to one, and calls only the summary operation on that state.
The pinned routine diagnoses `SPICE(INVALIDCARDINALITY)` before traversing
an incomplete pair. For one interval from −DBL_MAX to DBL_MAX, the locked
library gives infinite measure and average, NaN standard deviation, and
two index values of zero. This follows its binary64 endpoint subtraction,
sum and squared-sum calculation. Focused comparisons inspect the five
fields independently, including exceptional doubles. Finite-input
expansion and contraction can likewise produce infinite endpoints.
[Tagged output and small-scale summary checks](../packages/py-parity-checking/test/window-algebra.test.ts)

The 78 registered workflows contain 536 explicit steps, including 207 calls
to the 13 B03 operations and 329 setup, inspection or lifecycle steps. Ten
workflows expect a genuine CSPICE error. The parity sidecar uses SpiceyPy
6.0.3. Independent local characterization used Python 3.12.15 on macOS arm64
with library SHA-256
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
The focused oracle also checks eight post-error states, logical-zero
allocation, alias rejection and the typed output fields above.
[Window workflow handlers](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/handlers/cells_windows.py)

Both implementations keep initialized backing storage for a logically empty
window because the pinned union begins by reading its first storage slot.
The sidecar retains the original capacity and guards attempted resizes
against that allocation. Shared window-allocation consumers for geometry,
ephemeris and frame workflows use the same scoped helper.
[Window allocation and physical bounds](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/window_algebra_oracle.py)

The focused compiled runs passed 156 registered Node/WASM comparisons, 45
native tests, 11 public/oracle tests and 37 WASM allocation and ownership
tests. Source-bound verification uses the full required local runs and
observed canonical CI captured in the routine audit.

A separate real-browser check used the workspace esbuild to bundle the public
client, served the generated WASM over localhost, and used headless Chrome
with a fresh profile. The inline worker allocated three owned windows, inserted
intervals, returned [0,8] for their union, returned measure 8 and endpoint offsets
0/0, included the closed endpoint, and successfully freed each window.
