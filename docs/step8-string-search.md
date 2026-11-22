# String search positions and row lookup

The position methods return a zero-based UTF-8 byte index. All six use a
signed32 inclusive start and return −1 when either operand is empty or a
search misses. They preserve the caller’s case, whitespace and byte sequence.
A leading BOM participates in the search.

| Method                       | Candidate                                                            |
| ---------------------------- | -------------------------------------------------------------------- |
| `cpos(text, chars, start)`   | First byte in `chars` at or after `start`.                           |
| `cposr(text, chars, start)`  | Last byte in `chars` at or before `start`.                           |
| `ncpos(text, chars, start)`  | First byte outside `chars` at or after `start`.                      |
| `ncposr(text, chars, start)` | Last byte outside `chars` at or before `start`.                      |
| `pos(text, substr, start)`   | First complete literal byte substring beginning at or after `start`. |
| `posr(text, substr, start)`  | Last complete literal byte substring beginning at or before `start`. |
| `esrchc(value, values)`      | First equivalent row in caller order, or −1.                         |

`cpos("ı", "ñ", 0)` returns 1 because the two UTF-8 sequences share the
continuation byte B1. `posr("ababa", "aba", 1)` returns 0 while a start of
2 returns 2. Reverse substring search bounds the first byte of a possible
match, allowing the remainder of the match to extend past the start.
[CPOS](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cpos_c.html)
[POSR](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/posr_c.html)

## The maximum signed start

The six N0067 C wrappers add one to a nonempty search’s start before calling
SPICELIB. The signed32 maximum would overflow that addition. The shim maps
only `2147483647` to `2147483646`. Each terminated input fits signed32,
so the largest legal byte index is `2147483645`. Both carriers exceed
every possible position. Forward searches return −1. Reverse searches begin
at the final byte, or at the last complete substring’s possible start.
The pinned routine still computes every result. The independent caller
uses representable starts only. A separate public check compares the extreme
carrier to the safe near-end oracle result.

## Equivalent rows

`esrchc` compares each row through CSPICE’s `eqstr_c`. Empty and nonempty
whitespace-only rows are distinct. For nonempty text, ASCII case and C
whitespace are ignored, even within a name. The host C locale determines
byte whitespace classification. Accented case mappings and Unicode
normalization forms retain their original UTF-8 bytes.
[ESRCHC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/esrchc_c.html)
[EQSTR](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/eqstr_c.html)

Node and WASM snapshot the array length and each caller entry once.
Each row ends in NUL within a zero-filled table whose stride is the larger
of two bytes and the maximum UTF-8 row length plus one. Empty input has
logical count zero and a one-byte physical sentinel. The table must fit
signed32 because the pinned C routine multiplies row number by stride
in signed arithmetic. Each WASM allocation is limited to 256 MiB.
Embedded NUL and unpaired UTF-16 surrogates fail representation validation.

## Independent observations

The locked SpiceyPy 6.0.3 wrappers call the six matching position routines.
For `esrchc_c`, the sidecar separately binds a NUL-terminated key, two
signed 32-bit dimensions, a pointer to row storage and a signed 32-bit
return value. Its independent row allocation uses UTF-8 byte widths and
checks the actual library error state after the call. SpiceyPy’s ordinary
row wrapper also runs on eligible nonempty ASCII tables and must agree.
That wrapper’s Python-character width calculation, minimum width and
empty-sequence handling prevent its use across the full public domain.
[Locked oracle implementation](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/string_oracle.py)

The registry contains 56 authored workflows with 407 target calls. Each
routine has eight workflows. The four set searches exercise 59 calls each,
the two substring searches exercise 61 each, and row lookup exercises 49.
The inputs are repository-authored literals with no external kernels,
scientific measurements or filesystem effects. The runner compares each
integer output. Its 1e−12 relative and absolute tolerances distinguish
adjacent integers across signed32. Focused public tests also compare complete
integer arrays exactly. No representable search input in these workflows
signals a toolkit error. The recovery test uses an existing wildcard routine
to create a genuine error before exercising the searches again.
[Public oracle comparisons](../packages/py-parity-checking/test/string-search.test.ts)

The 112 registered Node/WASM comparisons and seven focused public/oracle tests
passed. An actual Chrome public client loaded localhost WASM in a real inline
worker and exercised all seven methods, including the maximum start and
empty versus blank rows. The compiled native boundary passed 28 A19 tests. The regenerated WASM module
passed 38 A19 tests, including failure at each allocation, post-failure reuse,
exact stride bytes and read-once rows. The two suites also passed their
37 native and 38 WASM inherited A18 cases. The maintained audit records
final backend verification separately on the combined source.
[Native boundary](../packages/backend-node/test/string-search-domain.test.ts)
[WASM allocation tests](../packages/backend-wasm/test/string-transforms-allocations.test.ts)
