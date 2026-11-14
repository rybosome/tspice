# Appending, testing membership and copying ordinary cells

B01 adds seven raw operations to the existing cells/windows domain. The caller
creates ordinary character, double or signed-integer cells with the corresponding
kit allocator and releases them with `freeCell`. A live owner token identifies
each cell. B01 uses the ordinary-cell and window distinction introduced in B03.
[Parent PR #722](https://github.com/rybosome/tspice/pull/722)

| Operation                   | Observable result                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `appndc(item, cell)`        | Places up to width minus one bytes in the next character row. The row has a terminating NUL.       |
| `appndd(item, cell)`        | Appends one ordered binary64 value, including either infinity and either sign of zero.             |
| `appndi(item, cell)`        | Appends one signed 32-bit integer.                                                                 |
| `elemc(item, cell)`         | Searches for the entire UTF-8 key, case-sensitively. Right-hand ASCII blanks are insignificant.    |
| `elemd(item, cell)`         | Tests exact numeric membership. The two signs of zero compare equal.                               |
| `elemi(item, cell)`         | Tests exact signed-integer membership.                                                             |
| `copy(source, destination)` | Copies all elements in order into an existing same-kind cell, retaining its capacity and set flag. |

## Set flags and text

Appending preserves duplicates and order. A duplicate or descending input
clears a previously true set flag. The character comparison uses the full
untruncated key and preceding stored row before writing the fixed-width result.
A full cell raises `SPICE(CELLTOOSMALL)`, including for an attempted duplicate.
An empty set returns false for membership. A cleared flag raises `SPICE(NOTASET)`.
Calling `valid` on initialized rows sorts, deduplicates and establishes a set.
[APPNDC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/appndc_c.html)
[ELEMC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/elemc_c.html)

The character cell getter and SpiceyPy’s default cell iterator right-trim
whitespace for display. Raw membership provides an independent observation of
the underlying bytes. A cell containing `"A\t"` accepts that full key and
`"A\t  "`, and rejects `"A"`. A successful character copy, including self-copy,
can strip trailing ASCII spaces during Fortran-to-C conversion. The tests
observe the tab, leading blank and a multibyte accented character through a
second cell with a different row width.

For all three types the destination retains its own set flag. For example,
appending `[-9, 7, 7]` and reducing cardinality to two leaves sorted unique
data with a false flag. Copying these two values to a fresh integer cell
permits membership on that destination. Copying them back to the first cell
raises `NOTASET` on subsequent membership until explicitly revalidated.
This example keeps the physical data sorted for every binary search.

## Caller-sized copies and errors

N0067 `copyd_` and `copyi_` write the fitting prefix and its count to the
translated control area before raising `SPICE(CELLTOOSMALL)`. The outer
`copy_c` synchronizes the C descriptor only on success. With source
`[-19, 3, 46]` and a two-row destination previously holding `[72]`,
`card(destination)` remains one, and the first visible value becomes −19.
A second copy from that destination into a fresh four-row witness returns
`[-19, 3]`. An initially empty destination still reports zero through
`card` after the same failure, and the second copy again exposes two
initialized rows. Both outcomes also hold for `[-12.75, 3.125, 8.5]` in a
double cell. Setting cardinality to two explicitly exposes both fitting rows.
Setting it to zero resets the logical and translated counts for a fresh append.

Character copy first builds temporary Fortran cells. The outer routine only
maps those rows back after success, so a failed capacity or width check retains
the existing destination rows. ENCHAR encodes the controls in five payload bytes.
Either participating row width needs at least six bytes including its C NUL.
Too little control space can signal `SPICE(INSUFFLEN)`. When the controls
fit, an insufficient number of rows signals `SPICE(CELLTOOSMALL)`. Significant
payload bytes that do not fit a narrower row signal `SPICE(ELEMENTSTOOSHORT)`
in this release, while trailing ASCII blanks may be dropped successfully.
[NAIF COPY](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/copy_c.html)

The public signature pairs two ordinary cells of the same type. Signed integers
use the full SpiceInt range. Unordered NaN and malformed JS text fail wrapper
validation. A string payload and its NUL must fit signed32. When a successful
character append would split a UTF-8 scalar at the row boundary, the shim
rejects it before mutation. Full-cell errors remain observable through CSPICE.
The shim bounds binary-search indices, character offsets and copy workspace
products before dispatch. Numeric copy validates the translated size and
cardinality against live storage, including a legitimate partial write.
Wrong-kind ordinary cells reach the toolkit’s `TYPEMISMATCH` checks in direct
compiled tests. Window, expired and foreign handles fail ownership checks.

## Independent observations

SpiceyPy 6.0.3 calls the six canonical append and member routines. Its
`sp.copy(cell)` allocates a new cell of the source size and width. To exercise
a prepopulated, undersized or aliased destination, the sidecar binds the locked
library’s `void copy_c(SpiceCell *, SpiceCell *)` and passes the two caller-owned
cells. On ordinary successful inputs the focused tests also compare the
convenience wrapper. The oracle checks the toolkit error state after each direct
call. Inputs are project-authored literals and require no kernels or filesystem
fixtures. [Oracle binding](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/cell_array_oracle.py)
[Public cross-backend tests](../packages/py-parity-checking/test/cell-array-behavior.test.ts)

Seven registered case files contain 68 workflows and 321 steps. Of those steps,
307 call B01 methods, eight call `valid`, three call `size` and three call
`card`. The 25 expected terminal errors comprise 14 `NOTASET`, nine
`CELLTOOSMALL`, one `ELEMENTSTOOSHORT` and one `INSUFFLEN`. The other 43
workflows succeed. The existing comparator checks ordered visible contents and
boolean results. Focused tests compare arrays exactly and explicitly tag
infinities and negative zero, preserving values ordinary JSON cannot encode.

Local execution on both compiled backends passed 136 registered comparisons
and eight additional public tests. The native domain suite passed 22 tests.
The WASM suite passed 21, including allocation-failure cleanup and recovery
after a real capacity error. A headless Chrome inline Web Worker exercised all
seven operations, infinity, the hidden terminal tab, `NOTASET`, recovery with
`valid` and release of the owned cells. The stacked working tree contains 182
contract-present routines and 1,255 registered scenarios. The maintained
audit records source-bound required-lane evidence separately.
[Native domain suite](../packages/backend-node/test/cell-arrays-domain.test.ts)
[WASM allocation suite](../packages/backend-wasm/test/cell-arrays-allocations.test.ts)
