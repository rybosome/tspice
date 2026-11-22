# Sorted array bounds

The six raw methods search a caller-supplied array in nondecreasing order
and return a zero-based integer index. The `lstle*` routines include equality
and return the last duplicate equal to the key. The `lstlt*` routines stop
before the entire group equal to the key. An empty array or a key below the
first qualifying element returns −1. For example, with `[1,2,2,4]` and key
2, the inclusive result is 2 and the strict result is 0.

Order is a caller precondition. The adapters preserve it. Integer searches
require signed 32-bit keys and elements. Double searches accept signed zero,
subnormals, finite extrema and infinities. NaN cannot participate in the
documented order and is rejected during validation. No tolerance is applied to
comparisons of values separated by a single binary64 step. The returned index
is always compared exactly. Routine-specific error paths require no fabricated
scientific errors for valid sorted input.
[NAIF inclusive numeric search](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstled_c.html)
and [strict numeric search](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstltd_c.html)

For character searches, each key and row is well-formed UTF-8 without embedded
NUL. Empty strings are valid. CSPICE uses unsigned bytes and extends shorter
strings with ASCII spaces for comparison. Trailing spaces therefore compare
equal. The tab byte sorts below a space, ASCII case is significant, and
supplementary characters use their UTF-8 byte order. Keys longer than any
row retain their complete encoded content.

The C input table is rectangular. Each row occupies
`max(2, longest row in UTF-8 bytes + 1)` bytes. The adapters fill the remainder
of the character area with spaces and place NUL in the final byte. The
N0067 implementation of `lstlec_c` compares first and last rows using
`strlen`, but its middle-row comparison passes the full character area
`arrlen-1`. Early NULs followed by zero bytes change that comparison for
some valid keys. The strict `lstltc_c` uses `strlen` for its middle row
as well. Both methods receive the same correctly padded table.

For rows `["A","B\t","B","Z"]`, the packed bytes are
`41 20 00 42 09 00 42 20 00 5a 20 00`. With key `"B\t"`, the canonical
inclusive search returns 1 and the strict search returns 0. The same inclusive
routine on ordinary zero-padded rows returns 2 in the locked library. A
focused probe retains both observations and the actual row bytes.
[NAIF character comparison and order](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstlec_c.html)
and [independent layout probe](../packages/py-parity-checking/test/sorted-bounds.test.ts)

Each array length is captured once and entries are copied into owned storage.
WASM caps each allocated buffer at 256 MiB, including the complete character
table. The terminated key and rectangular table each fit signed 32-bit byte
counts and the minimum row width is two, even for zero rows. Empty queries
use valid non-null storage. The six genuine empty lookups return −1. Type,
NaN, embedded NUL, unpaired-surrogate and unsafe-size failures are adapter
boundary checks. The independent sidecar also rejects unsorted fixtures.

All six pinned SpiceyPy 6.0.3 high-level wrappers call their respective
canonical C symbol and return its complete integer result. The sidecar's
character helper fills only the input representation. Its numeric helper
checks the documented ordering, types and dimensions. Header, wrapper and
test inspection found no numerical search implemented in those helpers.
[Independent sorted-input validation and row encoding](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/sorted_bounds_oracle.py)

The 44 registered workflows make 282 actual search calls. Duplicate runs,
all-equal inputs, even/odd lengths, between-element queries, adjacent doubles,
text controls and UTF-8 order distinguish the strict and inclusive predicates.
Focused public tests add eight ordered-infinity/signed-zero results per
backend. Independent byte, empty-buffer and guard checks supplement the
registered cases. The WASM suite covers 20 failed acquisitions, six successful
cleanups and two buffer-size/boundary checks. All inputs are authored and
kernel-free.

Focused compiled validation passed 88 registered Node/WASM comparisons, 11
public/oracle tests, 26 native and 28 WASM checks. The native ownership
assertion now calls `Object.is` before invoking the test matcher, preserving
the input read counts that this check measures. Fresh full local lanes and
canonical CI remain pending.
