# String tokenization and lexical scans

A20 adds nine raw methods to the string domain introduced in A18. Words,
delimiters, truncation and scanner positions use UTF-8 bytes. All fixtures are
repository-authored string literals and need no kernels.
[Parent PR #719](https://github.com/rybosome/tspice/pull/719)
[Public contracts](../packages/backend-contract/src/domains/strings.ts)

| Raw method                            | Inputs and observable result                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `nextwd(input, nexlen?, reslen?)`     | Splits the first ASCII-space-delimited word from the left-justified remainder. Each returned string has an independent byte capacity. |
| `nthwd(input, nth, worlen?)`          | Returns the word and its zero-based start byte. A shortened word retains its start. A missing ordinal gives an empty word and −1.     |
| `lparse(list, delim, nmax, itemln?)`  | Uses the first delimiter byte. Returns the actual item count and every ordered item, including empty fields.                          |
| `lparsm(list, delims, nmax, itemln?)` | Uses the set of delimiter bytes, with special blank handling when ASCII space belongs to that set.                                    |
| `lx4dec(input, first)`                | Scans a decimal mantissa. Returns the inclusive last byte and the scanner's separate character count.                                 |
| `lx4num(input, first)`                | Scans a number with an optional complete signed E or D exponent. Incomplete exponent text stays outside the accepted prefix.          |
| `lx4sgn(input, first)`                | Scans an optionally signed integer at the exact supplied byte offset.                                                                 |
| `lx4uns(input, first)`                | Scans unsigned digits. The caller initializes both empty-input outputs to the documented miss.                                        |
| `lxqstr(input, qchar, first)`         | Scans a quoted string using an ASCII quote byte, including doubled embedded quotes.                                                   |

## Capacities and bounds

Capacities count UTF-8 bytes, including the trailing NUL. The default row or
word width holds the entire input and at least one output character. Complete
tabs and newlines survive decoding. A capacity or delimiter that splits a UTF-8
scalar raises a representation error. A nonpositive list count returns zero
items before width or delimiter checks. With a positive count, the row width
must be at least two. Empty input then gives one empty item. Nonempty input
with an empty delimiter signals `SPICE(EMPTYSTRING)`.
[NEXTWD](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nextwd_c.html)
[LPARSE](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lparse_c.html)
[LPARSM](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lparsm_c.html)

Storage for a positive list request uses at most input bytes plus one rows,
with width bounded by the full input byte count plus one (minimum two).
The rectangular allocation is limited to 256 MiB on both backends. Invalid
widths reach CSPICE with a non-null sentinel. Token input has at most
INT32_MAX−2 bytes before the one-based parser advances its cursors. WASM's
per-buffer allocation cap also applies to inputs.

A scanner call starting outside the supported text uses an equivalent
out-of-range canonical scan before returning the caller's miss position. For
nonempty input, first=INT32_MIN gives last=−2147483649 and nchar=0. Empty
LX4DEC, LX4NUM and LX4SGN return −1 and zero regardless of offset. Empty
LXQSTR reports first−1 and zero. Pinned LX4UNS returns without writing either
slot on an empty word. Both the adapter and independent oracle initialize
them to the documented first−1 and zero before calling. The JS result can
represent the full predecessor exactly.
[LX4UNS](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4uns_c.html)
[Shared C adapters](../packages/backend-shim-c/src/domains/strings.c)

## Scientific observations

N0067's signed leading-dot mantissa branch advances past both sign and dot,
scans the digits, then adds one to the count. The inclusive location still
reaches the last digit. The initial live run exposed a Node validation error
on two grammar cases because the adapter required nchar to equal the inclusive
span. The corrected adapter checks the numeric bounds of each field and
preserves the two scientific outputs. An accepted exponent recalculates the
whole LX4NUM token length. The original workflows and global comparator are
unchanged. [Native regression](../packages/backend-node/test/string-tokenization-domain.test.ts)
[LX4DEC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4dec_c.html)
[LX4NUM](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4num_c.html)

| Input, first byte | LX4DEC (last, nchar) | LX4NUM (last, nchar) |
| ----------------- | -------------------- | -------------------- |
| `-.25`, 0         | (3, 3)               | (3, 3)               |
| `x+.5`, 1         | (3, 2)               | (3, 2)               |
| `x-.25D+`, 1      | (4, 3)               | (4, 3)               |
| `x+.5D2`, 1       | (3, 2)               | (5, 5)               |

SpiceyPy 6.0.3 has no high-level NEXTWD or NTHWD wrapper. Its LPARSE wrapper
chooses an internal row width and both list wrappers strip terminal whitespace.
The sidecar binds those four canonical functions in the locked toolkit
library with explicit dimensions, reads exact output bytes and checks
scientific status before decoding. Five ordinary scanner wrappers supply
both integer outputs directly, with a narrowly typed direct call for the
untouched empty LX4UNS outputs.
[Independent oracle](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/token_oracle.py)

The 62 registered workflows contain 330 new-method calls, including eight
expected toolkit error workflows. Both real backends passed all 124 registered
comparisons after the Node correction. All four supplementary public tests,
21 native-domain tests and 49 real-heap WASM tests passed. The WASM suite
includes nine successful calls and 38 individual failed allocation positions,
as well as cleanup after a toolkit diagnostic or invalid UTF-8. The first
allocation test run instrumented Emscripten's lazy allocator before resolving
its exported alias. Priming the allocator made the test count the actual
acquisitions and releases. The real Chrome inline worker also exercised all
nine methods on the same compiled WASM artifact.
[Public ownership and recovery tests](../packages/py-parity-checking/test/string-tokenization-public.test.ts)
[WASM allocation suite](../packages/backend-wasm/test/string-tokenization-allocations.test.ts)
