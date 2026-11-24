# Spacecraft-clock ticks, formatting and partitions

The four raw methods extend the existing time API. A spacecraft ID selects
a clock configuration from the SCLK kernel pool. Authored type-1 fixtures
control clock fields, tick rates, offsets and partition boundaries. A clock
whose time system requires UTC/TT conversion can also need a leapseconds
kernel. Epoch values are ephemeris seconds past J2000.
[NAIF encoded clock ticks](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sce2t_c.html)

## Defined output and trace for sce2t

N0067 `src/cspice/sce2t_c.c` declares a private `SpiceDouble loc_sclkdp`
without initialization. It calls `sce2t_(&sc, &et, &loc_sclkdp)`, then
unconditionally copies the temporary to the caller. A failing SPICELIB
path can return before writing the value. Initializing the _caller's_
output cannot initialize this private temporary.

The supported alias calls `sce2t_`, the linked N0067 routine invoked by
the public C wrapper. It supplies initialized output storage and preserves
the surrounding `sce2t_c` trace frame. The scientific computation stays
in the same SPICELIB implementation, including type-1 dispatch and integral
encoded ticks. Output is published only after a successful toolkit status.
The error probes use the independently loaded library with defined output
storage. Ordinary supported success probes may use the public SpiceyPy
wrapper.
[NAIF SCE2T implementation interface](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/FORTRAN/spicelib/sce2t.html)

The shared shim checks at compile time that the SPICELIB integer type matches
the 4-byte `SpiceInt` and that its floating type matches `SpiceDouble` and C
`double`. The pinned `SpiceZfc.h` declares
`int sce2t_(integer *sc, doublereal *et, doublereal *sclkdp)`.
The local macOS arm64 N0067 archive and independent locked SpiceyPy library
both expose the public and translated symbols. In each case
`nm -gU` reported text definitions for `_sce2t_` and `_sce2t_c`, with the
Mach-O leading underscore. The WASM build compiles the pinned translated
source, and the built module exports `tspice_sce2t`. The shim’s tokenized
C body calls `chkin_c`, `sce2t_` and `chkout_c`. Static declarations and
exports are supplemented by each platform’s actual execution evidence.

The coverage ledger records this as an alias on Node and WASM. Its
source traversal requires a real call to the reviewed external
`sce2t_` symbol, and the explicit policy requires both outer trace
calls. The other three methods use their corresponding public C
entrypoints. The audit’s local and canonical CI requirements apply to
all four routes.
[Maintained mapping policy](../data/coverage-ledger-policy.json)

## Raw clock fields and partition endpoints

`scfmt` accepts finite raw clock ticks. It uses the configured field widths,
moduli, offsets and delimiter. It rounds fractional ticks to the nearest
integer with half-ticks away from zero. A negative rounded result raises
`SPICE(VALUEOUTOFRANGE)`. The output omits a partition number. The optional
signed byte capacity includes NUL and defaults to 2048. A capacity below
two signals `SPICE(STRINGTOOSHORT)`. A buffer below the nominal field
width signals `SPICE(SCLKTRUNCATED)`. When a value exceeds its nominal
width, the pinned routine can truncate the final string assignment. The
tests check these paths separately.
[NAIF raw tick formatting](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scfmt_c.html)

The formatter in N0067 SC01 uses 30-byte local fields and a conversion with 14 significant
digits. It computes field widths using a logarithm and combines
the loaded moduli to decompose ticks. The shared shim and independent
oracle check for unsafe logarithm inputs, nonfinite modulus products,
component bounds approaching 10²⁸ with a rounding margin, and a possible
multi-field remainder overflow near the largest finite double. The guard
operates before the formatter. Supported ticks and the actual field string
still go through the canonical routine. Storage for a very large caller
capacity is bounded at 3100 bytes, which holds all ten possible nominal
finite-double field widths and delimiters.
[Shared clock wrapper](../packages/backend-shim-c/src/domains/time.c)

`scpart_c` does not receive a capacity argument. Both backends reserve
the complete pinned maximum of 9,999 doubles for each output array
before the call. They return owned arrays of exactly the reported length.
Raw readings retain their order, including repeated or decreasing starts
at clock resets, fractional values and values above signed32. The exposed
arrays do not reference the temporary buffers.
[NAIF partition outputs](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scpart_c.html)

`sctiks` parses raw field strings with the configured hierarchy and field
offsets. Physically meaningful field strings can produce raw counts
outside an individual partition’s range. Extra fields, forbidden clock
characters and strings with an encoded partition prefix can signal
`SPICE(INVALIDSCLKSTRING)`. A zero-length C string receives
`SPICE(EMPTYSTRING)`. All four methods exclude the most negative signed
32-bit spacecraft ID because the pinned clock code negates the ID to
construct kernel pool variable names.
[NAIF raw string parsing](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sctiks_c.html)

## Type-1 state after partition inspection

With complete type-1 metadata and a nominal clock type of 2, fresh
`sce2t`, `scfmt` and `sctiks` calls signal `SPICE(NOTSUPPORTED)`.
`scpart` dispatches directly to SCPR01. A successful partition read sets
the shared SC01 previous-spacecraft value. A following SCTY01 query for
that spacecraft can take its cache shortcut and use type-1 data. In the
authored sequence the two partition arrays are [0,1024] and [1023,4095],
then `scfmt(…,258)` returns `000001.002`. The formatter's bounded field
check must account for this state even when the nominal type currently
stored in the pool is 2.
[Registered partition-cache sequence](../packages/py-parity-checking/src/cases/time/scpart.cases.json)

For the two-field clock with 256 ticks per major unit, the true parser
can return positive infinity from finite fields. The string `1e307:0`
overflows the double-precision weighted sum. Its controls `1e305:0` and
`0:1e307` yield approximately 2.56×10³⁰⁷ and 10³⁰⁷, respectively. The
audit compares the actual exceptional or finite result without clamping
the raw tick count.

## Independent observations

The 49 registered workflows contain 195 explicit steps, including 120
new-method invocations and 26 genuine toolkit-error workflows. They make
34 SCE2T calls, 41 SCFMT calls, 13 SCPART calls and 32 SCTIKS calls. One
SCFMT call belongs to the partition-cache sequence in the SCPART file.
The independent oracle checks SCE2T's protected SPICELIB route first.
Only confirmed successes also call the locked public wrapper and compare
the returned integral tick exactly. This adds a diagnostic cross-check
within an invocation.

The error probe brackets a caller trace around a missing-clock error and a
non-TDB missing-LSK error. The first trace includes `sce2t_c → SCE2T →
SCTYPE → SCTY01`. The second includes `sce2t_c → SCE2T → SCET01 → UNITIM`.
After recovery, a new signaled error shows only the caller frame. After
matching caller checkout, its trace is empty. The partition test compares
all 9,999 starts and stops, then checks `SPICE(TOOMANYPARTITIONS)` at
10,000 before restoring valid raw values.
[Complete clock output and same-session recovery checks](../packages/py-parity-checking/test/sclk-additions.test.ts)

The corrected focused runs passed 98 registered actual Node/WASM comparisons,
7 public/oracle tests, 22 native tests and 17 WASM tests. These results
supplement the source-bound full required local lanes and observed CI
required for verification.
