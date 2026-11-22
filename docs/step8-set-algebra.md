# Ordinary set algebra

B02 adds eleven CSPICE N0067 operations on the character, double and integer
cells created and freed by the existing kit. It builds on the public cell
handles, append, membership and inspection operations in [#728](https://github.com/rybosome/tspice/pull/728).
No kernels, files or external data are needed. Each workflow uses its own
cells, and the runner frees them in reverse acquisition order on success and error.

## Results and ownership

| Method                       | Observable result                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `diff(a, b, result)`         | Members of A absent from B, in increasing order.                                                               |
| `inter(a, b, result)`        | Members common to both sets.                                                                                   |
| `sdiff(a, b, result)`        | Members in exactly one of the sets.                                                                            |
| `union(a, b, result)`        | All members, with common elements appearing once.                                                              |
| `set(a, op, b)`              | A boolean. The eight operators are `<`, `<=`, `=`, `<>`, `>`, `>=`, `&` for overlap, and `~` for disjointness. |
| `removc`, `removd`, `removi` | Remove one member, shifting later members and reducing cardinality. A miss leaves the cell unchanged.          |
| `ordc`, `ordd`, `ordi`       | Return a zero-based index. Empty cells and absent members return −1.                                           |

The four writers accept separately allocated, same-type inputs and a same-type
caller-owned result. They replace the result's old contents and set its set
flag. The input sets must already be sorted and unique. If an application
previously used `copy` or `scard` to change their contents independently of
the flag, it can use `valid` to establish sorted, unique storage before set
operations. NAIF describes distinct input sets and explicitly requires a
distinct result. Both JS backends and the shared C boundary guard output
aliasing before mutation. Self-comparison in `set` is supported.

The ordinary-cell registry rejects window and expired handles. WASM also
checks the owning module. The native addon resolves the opaque tokens and
performs the entire operation under the CSPICE mutex. Character arguments
are NUL-free, valid UTF-8. Integer items fit signed SpiceInt. Ordered double
members can include infinities, either sign of zero and subnormals. The shared
boundary bounds signed row offsets, search indices, control areas and union
excess counters before dispatch. It checks for NaN in double input sets before
the translated merge loops. Unordered values are outside the supported domain.

## Capacity, widths and errors

The four writers may return `SPICE(SETEXCESS)` after writing the prefix that
fits. Both numeric and character outputs can retain the previous descriptor
cardinality and acquire a true set flag. For numeric cells the translated
control cardinality can already reflect the fitting prefix. The character
`F2C_MAP_CELL` macro copies and repacks temporary rows even with an outstanding
translated error, and synchronizes the public descriptor only after success.
The focused test seeds a two-slot result with a cleared set flag and a visible
cardinality of one. After each writer reports overflow, the first member is
visible through `card`, the getter and the matching raw ordinal. An explicit
`scard(2, result)` exposes both initialized members. `scard(0, result)` followed
by a successful intersection demonstrates recovery with the same handles.

These observations apply to the translated capacity error. CSPICE also
checks the input set flags and all declared element types before entering the
merge. Different types yield `SPICE(TYPEMISMATCH)`. Input cells with an unset
flag yield `SPICE(NOTASET)`. A valid `set` relation on empty cells can be false
or true depending on the operator. Unsupported operator tokens produce
`SPICE(INVALIDOPERATION)`, and an empty operator produces `SPICE(EMPTYSTRING)`.

Character conversion requires enough room for the Fortran ENCHAR five-byte
control encoding, in addition to the C NUL. A shorter test width reaches
`SPICE(INSUFFLEN)`. For character `diff` the declared output row must be as
wide as A. For the other three writers it must be as wide as both inputs.
Shorter rows can produce `SPICE(ELEMENTSTOOSHORT)` even when the particular
member values would fit. The C conversion trims trailing ASCII spaces in
written rows. Raw ordinal probes distinguish a retained tab from space and
from the shorter key. The kit character getter and SpiceyPy display getter
both trim trailing whitespace, so the tests observe raw comparisons too.
[NAIF set operations](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/sets.html)

## Independent observations

The locked SpiceyPy 6.0.3 wrappers for `diff`, `inter`, `sdiff` and `union`
allocate their own result cells. The sidecar binds the four public symbols
from that installed library with three typed `SpiceCell*` arguments and a
void return. It passes its own input and destination descriptors and checks
the scientific error state immediately. The public tests cross-check successful
destinations against the standard high-level wrappers. All other operations
use the matching locked wrappers, including `sp.set_c`. No output is inferred
from Python or JavaScript set arithmetic.
[Independent binding](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/set_algebra_oracle.py)

All 192 compiled comparisons passed across 96 registered cases. The 1,049
steps include 553 B02 calls and 33 scenarios with expected toolkit errors.
Six supplementary tests compared both operand orders, full retained values,
signed zeros, infinities, subnormal and adjacent doubles, significance of
terminal tabs, destination set-flag changes, and same-client recovery.
Exact tagged comparisons complement the existing numerical comparator.
[Public tests](../packages/py-parity-checking/test/set-algebra-behavior.test.ts)

Seventeen native tests passed, including two exercising the compiled addon.
Thirty actual WASM tests passed across eleven normal calls, eighteen separate
failed allocation positions and one structured error, recovery and handle
ownership test. Real headless Chrome exercised all eleven methods through the
inline worker, inspected all four complete output sets, checked removal and
ordinals for all three types, recovered from an invalid relation and freed
all five owned cells. Required full-lane and remote CI executions are recorded
separately against their exact source.
[Native tests](../packages/backend-node/test/set-algebra-domain.test.ts) · [WASM tests](../packages/backend-wasm/test/set-algebra-allocations.test.ts)
