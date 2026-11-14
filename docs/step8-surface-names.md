# Surface-name and ID translations

These four raw methods resolve surface IDs in the context of a body. Their
mappings come from the parallel kernel pool arrays `NAIF_SURFACE_NAME`,
`NAIF_SURFACE_CODE` and `NAIF_SURFACE_BODY`. The authored fixture assigns
two spellings to code 91 on Earth, repeats “Shared” for two bodies, and
assigns the string “00091” to code 765 on Earth. These records exercise
lookup priority and normalization without representing measured surfaces.
[Fixture source](../packages/py-parity-checking/fixtures/kernels/surface-translation.tpc)

| Method   | Inputs                                               | Result                                    |
| -------- | ---------------------------------------------------- | ----------------------------------------- |
| `srfc2s` | Surface code, signed body ID, optional byte capacity | `{surface, isName}`                       |
| `srfcss` | Surface code, body string, optional byte capacity    | `{surface, isName}`                       |
| `srfs2c` | Surface string and body string                       | `{found: true, code}` or `{found: false}` |
| `srfscc` | Surface string and signed body ID                    | `{found: true, code}` or `{found: false}` |

An assigned name retains the toolkit’s output spelling and sets `isName`.
An unassigned ID returns its decimal representation and clears that flag.
The body-string output routine also returns this fallback for an unrecognized
nonempty body. In the other direction, a recognized body is required by
`srfs2c` even when the surface string is numeric. CSPICE first searches
normalized names within the specified body, then tries its own integer parser.
The assigned “00091” consequently resolves to 765 through the fixture.
The routines maintain a watched cache of these associations. The workflows replace
assignments, clear the kernel pool and reload the fixture before comparing
outputs again.
[NAIF surface string and body translation](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfs2c_c.html)

The default output buffer has 37 bytes, including NUL, for the pinned
36-byte surface-name field. A smaller supported capacity preserves the
actual prefix and the independent name flag. Capacities below two reach
CSPICE and signal `SPICE(STRINGTOOSHORT)`. Both input strings and successful
output strings must be representable in UTF-8. A prefix splitting a
multibyte character is rejected by strict decoding. The independent
`srfc2s_c` and `srfcss_c` bindings use bounded byte storage with canaries,
read to the first terminator and preserve trailing tabs and the separate
flag. The name-to-code oracle calls each locked SpiceyPy wrapper under
`no_found_check()` to retain its actual found bit and toolkit diagnostics.
[Independent surface oracle](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/surface_oracle.py)

## Signed surface hash boundary

Pinned N0067 `zzhashi.c` computes the signed absolute value of an integer
before reducing it modulo the table size. Its 32-bit arithmetic cannot
represent the absolute value of −2147483648. `zzsrftrn.c` hashes a direct
surface ID in the code-to-name lookup. `zzsrfini.c` also hashes surface IDs
while building lookup tables for both directions. A kernel can therefore
supply the unsafe input even when every scalar in the immediate call is
otherwise valid.

The shared adapter checks direct surface IDs before code-to-name calls
and reads the current numeric surface-code pool in bounded chunks before
lookup. In the signed range, GIPOOL rounds to nearest, with ties away from
zero. Pool values from −2147483648 through −2147483647.5 inclusive would
produce the unsafe ID and are rejected. This applies to the surface-code
column. The body ID is a separate key. The reverse integer parser can return
−2147483648 from text when it has not been inserted as a hashed surface ID.
The sidecar guards the same unsafe inputs independently. Wrapper rejection
does not claim an observed scientific output from an undefined hash call.
[Shared hash guard and canonical calls](../packages/backend-shim-c/src/domains/ids_names.c)

Missing mapping variables, incorrect variable types, unequal array sizes
and blank assigned names are distinct toolkit errors in the registered
workflows. With no associations loaded, an unresolved name and a decimal
surface-ID fallback are valid outputs. An empty input C string signals
`SPICE(EMPTYSTRING)` on the applicable methods.
[Surface-name contract](../packages/backend-contract/src/domains/ids-names.ts)

## Failed mapping refresh and observed outputs

After a successful lookup initializes the tables, replacing the numeric
code column with character data triggers `SPICE(BADVARIABLETYPE)` on the
next lookup. In the pinned implementation `ZZCVPOOL` consumes the watch
notification before `ZZSRFKER` validates the changed columns. The previously
built hash table survives this particular error. The following calls to
each of the four operations still see the old associations. Another
watched assignment, unloading and reloading are checked explicitly.
This sequence depends on the prior successful initialization and the
specific mutation.
[Same-session lookup and refresh checks](../packages/py-parity-checking/test/surface-names.test.ts)

The compiled-path test suite includes a 2,001-element code column, which
signals `SPICE(TOOMANYSURFACES)`, and out-of-range doubles in the code
column, which signal `SPICE(INTOUTOFRANGE)`. An in-range value of
−2147483647.49 rounds to −2147483647, including for body ID −2147483648.
Independent strictly decoded bytes preserve an initial UTF-8 BOM and a
terminal tab that the high-level Python string conversion strips. Split
multibyte prefixes are tested separately from CSPICE errors.
[Byte, numeric-boundary and oracle-guard checks](../packages/py-parity-checking/test/surface-names.test.ts)

The 46 registered workflows comprise 204 explicit steps, with 120 calls
to the four new surface routines and 26 expected toolkit-error workflows.
The independent characterization uses the locked SpiceyPy 6.0.3 library
on Python 3.12.15, macOS arm64, SHA-256
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
Unsafe hash inputs are tested through pre-dispatch guard rejection.
Scientific comparison uses the actual canonical symbols on supported inputs.
[Registered surface translation dispatch](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/handlers/ids_names.py)

The focused compiled runs passed 92 registered Node/WASM comparisons, 7
public/oracle tests, 28 native tests and 24 WASM tests after introduction of
the direct and pool-backed surface hash guard.
