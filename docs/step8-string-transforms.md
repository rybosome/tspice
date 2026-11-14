# String transformations and matching

The eight flat raw methods in `StringsApi` operate on NUL-terminated UTF-8
byte strings. The typed contract accepts well-formed JavaScript strings and
rejects unpaired UTF-16 surrogates and embedded NUL. A delimiter or wildcard
is a separate one-byte ASCII argument. The NUL scalar is valid there and
cannot occur in the text. Encoding preserves an initial U+FEFF and every
trailing byte through the terminator.

| Method                          | Byte-level result                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cmprss(delim,n,input,lenout?)` | Keeps at most `n` bytes in each run of `delim`. A nonpositive `n` removes the delimiter. Capacity includes the terminator and must be at least 1.                               |
| `eqstr(a,b)`                    | Ignores ASCII letter case and C whitespace throughout nonempty strings. Two empty strings compare equal. An empty string and a nonempty whitespace-only string compare unequal. |
| `iswhsp(input)`                 | Accepts the empty string and strings consisting entirely of C whitespace. Portable C whitespace includes tab, newline, vertical tab, form feed, carriage return and space.      |
| `lastnb(input)`                 | Returns the last byte index whose value differs from ASCII space. Empty and all-space inputs return −1. A trailing tab is significant.                                          |
| `lcase(input,lenout?)`          | Changes only ASCII A–Z to lowercase. Preserves all remaining bytes, including trailing whitespace. Capacity must be at least 2.                                                 |
| `ucase(input,lenout?)`          | Changes only ASCII a–z to uppercase. Preserves all remaining bytes, including trailing whitespace. Capacity must be at least 2.                                                 |
| `matchi(input,templ,wstr,wchr)` | Compares literals ignoring ASCII case. Wildcard token recognition uses the exact supplied byte.                                                                                 |
| `matchw(input,templ,wstr,wchr)` | Compares literals case-sensitively. Wildcard token recognition uses the exact supplied byte.                                                                                    |

`eqstr_c` and `iswhsp_c` call C's `isspace` on unsigned bytes. The runtime's
C locale controls classification. The registered controls distinguish portable
C whitespace, visible characters and UTF-8 bytes. `lastnb_c` skips
only byte 0x20 and returns a zero-based byte position. For example, the last
nonblank byte of `"é  "` has index 1.

Both matching routines discard leading and trailing ASCII spaces in the input
and template. Internal bytes and control whitespace retain their significance.
The string wildcard matches zero or more bytes, the character wildcard consumes
one byte and literal matches are anchored to the significant input. Multibyte
characters therefore need multiple character wildcards. The source scans for
the string wildcard before consuming a single-character token when their bytes
coincide. Empty input or template signals `SPICE(EMPTYSTRING)`. Nonempty
all-space inputs reach CSPICE's blank-template logic.
[NAIF wildcard matching](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/matchi_c.html)

The three output transformations never expand the input. The default output
capacity accommodates the entire encoded string plus terminator and the
routine's minimum buffer size. A smaller signed 32-bit `lenout` truncates
the right side by bytes. A larger request uses the smallest sufficient
allocation. Values below the minimum reach canonical CSPICE and produce
`SPICE(STRINGTOOSHORT)` with valid sentinel storage. Encoding and allocation
guards precede calls. The encoded input plus terminator must fit a signed
32-bit integer. WASM also enforces its existing 256 MiB per-buffer limit.
[NAIF compression](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cmprss_c.html)

The locked SpiceyPy 6.0.3 wrappers for `cmprss`, `lcase` and `ucase` call
the correct C symbols, then decode with ignored errors and strip terminal
whitespace. The independent oracle therefore binds those same symbols using
the library already loaded by SpiceyPy, checks the toolkit error status and
retains every byte through the first terminator. The five boolean/index
wrappers call the canonical symbols and preserve their complete results.
The audited independent smoke used Python 3.12.15 and the macOS ARM64
`libcspice.so` with SHA-256
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
[Independent byte oracle](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/string_oracle.py)

A truncated prefix can end inside a UTF-8 scalar. For `"éX"` at capacity 2,
the C buffer contains byte `c3` followed by NUL. For `"😀X"` at capacity 4,
the bytes before NUL are `f0 9f 98`. Both real adapters reject these
unrepresentable JavaScript results with `TypeError` after the successful C
call. Capacities ending on a complete boundary decode normally. The exact-byte
probe also retains the tab, carriage return and newline in the result for
`"A\t\r\n"`. Backend errors leave subsequent valid calls usable.
[Exact-byte checks and public error recovery](../packages/py-parity-checking/test/string-transforms.test.ts)

The eight registered files contain 64 scenarios and 274 canonical calls,
including 12 expected SPICE errors. Exact comparison covers every character,
boolean and integer byte offset. The exact-byte test checks 18 independent C buffer observations and three
high-level wrapper results. Native code owns its strings and result storage under
the existing SPICE mutex. WASM allocation tests cover 27 acquisition failures,
eight successful routes and three resource/encoding/bounds checks. The workflow
uses authored text and requires no kernels. Source-bound local and CI evidence
is recorded separately in the batch audit.

Focused compiled validation passed all 128 registered backend comparisons, 11
public/oracle tests, 38 WASM allocation and encoding checks and 37 native tests.
These results cover the toolkit error recovery, strict string decoding and
the direct adapter boundaries. The maintained audit requires fresh full local
lanes and observed CI for final source verification.

The worker test loads the production browser worker entry over a connected test
channel using structured cloning. Worker metadata discovers all eight raw
methods. It exercises real WASM through the asynchronous facade and checks
text including terminal whitespace, a multibyte byte index, predicate results
and EMPTYSTRING recovery. The channel uses the in-process test harness.
[Worker method discovery and RPC checks](../packages/tspice/test/string-transforms-worker.test.ts)

A separate browser check bundled the public client with the workspace esbuild, served the checked-in WASM asset over localhost, and used headless Chrome with a fresh profile. The real inline blob worker returned exact trailing whitespace, multibyte indices, both match modes and the expected error followed by a clear error state. The committed worker test separately exercises the same entrypoint and all eight methods over an isolated message channel.
