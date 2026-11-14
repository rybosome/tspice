# Scalar math semantics and independent oracle

A03 adds nine direct raw routines: `brcktd_c`, `brckti_c`, `convrt_c`, `sumad_c`,
`sumai_c`, `maxd_c`, `maxi_c`, `mind_c` and `mini_c`. The
[per-routine audit](../data/parity-audits/a03-scalar-math.json) records all 47
registered scenarios and 373 actual routine calls, including seven genuine
conversion-error cases. None needs a kernel or external data fixture. Independent
oracle observations and source review are distinct from fresh compiled-backend
and canonical CI verification.

## Canonical variadic calls

SpiceyPy 6.0.3 has no top-level wrappers for these four min/max functions. The
new [independent binding](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/scalar_math_oracle.py)
loads `ctypes.CDLL(libspice._name)`, the exact library selected by the locked
SpiceyPy installation. It uses each actual `maxd_c`, `maxi_c`, `mind_c` or
`mini_c` symbol. Its fixed prototype is `[ctypes.c_int]`; return types are
`c_double` for doubles and `c_int` for integers. Every following argument is an
individually boxed scalar of the corresponding type. The fixed-argument
prototype matters on Apple's arm64 variadic ABI. The binding checks 4-byte
integers and 8-byte doubles; it passes neither an array pointer as varargs nor
a mismatched count. No Python/JavaScript min/max or tspice library supplies the
oracle result.

NAIF's portable domain permits at most 30 values and requires the count to match
the actual scalar arguments. Zero values return zero. See
[maxd](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxd_c.html),
[maxi](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxi_c.html),
[mind](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mind_c.html) and
[mini](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mini_c.html).
The production shared shim uses four explicit 0–30 switches. Source inspection
confirmed that each of the 124 arms names the correct canonical function and
passes the exact count followed by indices `0..count-1` in order. The explicit
calls also preserve the existing ledger's source-call visibility without
weakening its recognizer. Every result comes from CSPICE, including the empty
case; the switches only adapt the calling convention.

Each min/max routine has 60 registered arity observations: empty and singleton,
then first-position and last-position extrema at every length 2 through 30.
Focused live comparisons require exact equality of all outputs. Additional
cases cover mixed signs, repeated values, signed32 bounds, maximum finite doubles
and subnormals. Boundary tests reject length 31 without invoking undefined C
behavior. The original ABI availability investigation remains in
[PR #707](https://github.com/rybosome/tspice/pull/707); this batch turns that
investigation into a maintained sidecar path and executable parity cases.

## Ordered sums and safety boundaries

Pinned `sumad_c` and `sumai_c` start at zero and add each array entry in order.
Empty arrays call the actual routines with count zero. The arrays are readonly
at the API boundary and copied into backend-owned input storage. The sum routines
accept lengths above 30; registered 64-element examples distinguish them from
the variadic cap. See [sumad](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sumad_c.html)
and [sumai](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sumai_c.html).

`sumai` requires every prefix sum to fit signed32, not just the final mathematical
sum. For example, `[2147483647,1,-1]` is rejected before C accumulation despite
its representable final total. The JS guard's individual additions are exact
because each prior accepted prefix and input is signed32. The shared C guard
uses `int64_t` and stops immediately on an out-of-range prefix. Direct native
and WASM shim tests exercise that protection without executing undefined
`sumai_c` overflow. The independent oracle guard likewise rejects before
`sp.sumai`; for valid inputs it returns the actual library result, not its
validation accumulator. These are wrapper-safety checks and are not scientific
parity cases for undefined behavior.

Array counts must fit signed32. WASM additionally checks the existing 256 MiB
per-buffer limit before reading array entries or allocating memory: at most
33,554,432 doubles or 67,108,864 integers fit that buffer policy. Tests use sparse
arrays one element above those bounds and observe zero allocator calls; native
adapter tests similarly reject a length of 2,147,483,648 before reading entries.
These rejection tests do not claim successful allocation at the maximum sizes.
Zero-length buffers reserve one element so cleanup remains well-defined.
Malformed/sparse arrays and invalid integer values are rejected without coercion.

`sumad` retains ordered floating arithmetic. `[1e16,1,-1e16]` returns zero,
whereas `[1e16,-1e16,1]` returns one. With `M` the largest finite double, the
independent scoped probe observed:

| Actual call        | Result                                                       |
| ------------------ | ------------------------------------------------------------ |
| `sumad([M,M])`     | Positive infinity.                                           |
| `sumad([-M,-M])`   | Negative infinity.                                           |
| `sumad([M,M,-M])`  | Positive infinity; later subtraction does not undo overflow. |
| `sumad([M/4,M/4])` | Finite `M/2` control.                                        |
| `sumad([-0])`      | Positive zero from the initial accumulator.                  |

No compensated or reassociated sum replaces this behavior. The actual failure
flag remains false for these floating observations. Successful nonfinite results
are preserved by the adapters.

## Bracketing and unit conversion

`brcktd` and `brckti` preserve an in-range value and otherwise select the nearer
endpoint, regardless of endpoint order. Collapsed intervals return their sole
endpoint. Registered cases distinguish reversed endpoints, exact boundaries,
interior/exterior inputs and numeric extremes; double cases also retain fractions
and subnormals. Integer inputs must be signed32. See
[brcktd](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/brcktd_c.html) and
[brckti](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/brckti_c.html).

`convrt` uses the pinned toolkit's angle, distance and time tables. Unit strings
are passed unchanged: case and trailing blanks are accepted, leading blanks are
rejected, and unsupported singular `METER` is not treated as `METERS`. Unknown
units signal `UNITSNOTREC`, incompatible dimensions `INCOMPATIBLEUNITS`, and each
empty-string position `EMPTYSTRING`. NUL and nonstring rejection happens before
the native string boundary. Same-client tests observe a valid conversion and
cleared failure flag after scientific errors.

The locked oracle confirmed `AU -> KM` as `149597870.6136889` and
`TROPICAL_YEARS -> SECONDS` as `31556925.97632`. These are pinned historical
estimates, not replacements with modern astronomical definitions or the separate
`tspice.raw.tyear()` constant. `YEARS` uses Julian years. NAIF requires callers
to avoid conversion overflow; the scientific acceptance cases respect that
restriction. Adapter tests preserve numeric results, but do not establish a
scientific guarantee outside the documented domain. See
[convrt](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/convrt_c.html).

## Observations and comparison scope

The parity owner executed the complete case set through the new independent
Python decode/handler path: 366 successful finite calls and seven expected
conversion errors. These observations and the tagged probes used the existing A08
sidecar venv (Python 3.12.15 / SpiceyPy 6.0.3, macOS arm64), with `PYTHONPATH`
pointing to A03 source to exercise its new decoder, handlers and bindings. That
observation environment is separate from the integration owner's A03 required-lane
installation. Ten public tests supplement ordinary case comparison. The
scoped extreme test makes twelve independent live observations per backend,
using explicit input/output tags so JSON does not lose negative zero or infinity.
It observes `brcktd(-0,-1,1)` as negative zero, singleton negative zero for both
double extrema routines, first-zero tie preservation for `maxd`, and last-zero
tie preservation for `mind`. Every zero result is checked with `Object.is` against
the actual independent oracle. A separate test checks eight invalid-domain guards;
those blocked inputs do not count as actual scientific calls.

Normal scalar comparison remains `atol=rtol=1e-12`. Focused live equality
strengthens integer, selected-value and finite-extreme cases; conversion outputs
are rescaled before comparison so a tiny nonzero result cannot be accepted as
zero. No global tolerance or transport behavior changes. The 37 WASM checks
exercise allocation rollback/success, shared-C integer protection and preallocation
size checks; native tests trace argument/result validation and direct shared-C
recovery. Actual backend execution and required local/CI results are recorded
separately by the integration owner.

## Source provenance

Review used the repository's pinned N0067 headers and implementations, plus
locked SpiceyPy 6.0.3 source. Its ordinary `brcktd`, `brckti`, `convrt`, `sumad`
and `sumai` wrappers call the corresponding canonical C symbols. The four
min/max names are absent from its top-level wrapper module. The previously
inspected macOS arm64 oracle library SHA-256 is
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`;
platform execution is still subject to the required CI matrix.

Pinned `src/cspice` source hashes inspected for this review:

| File        | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| `sumad_c.c` | `0a40543542a3b7029fd6aa153dfca24b114c4ce1189410725e61641e5e831dac` |
| `sumai_c.c` | `7ba7ccaa94a87ec91aa47192226ff5d2a2fb16c309f58d05b5d86e323301f978` |
| `maxd_c.c`  | `6840678428518384979d786960247c8fd566ce06980b659531c974ae2da6224d` |
| `maxi_c.c`  | `67fb1d2453231270ce5f54ce573ff953c9419f1cf6bbec96c95aff356bba200a` |
| `mind_c.c`  | `d57746a5c3fd004118a659c62762405667ac50ba29af5cc0738ceb3d3438075a` |
| `mini_c.c`  | `f967f4624e8bd1c92da33240620ff3627efd4a858bcefa67355c09a531fedc9e` |
| `convrt.c`  | `370f6268c7158b858f82bfa22a1209770a164779ab978bfc586347d344d8bd68` |

`sumad_c.c`/`sumai_c.c` lines 155–163 show the actual ordered accumulators.
The extrema routines' `va_start`/`va_arg` loops consume individual scalars;
`convrt.c` contains the constants table. No routine exclusion, alternate
mathematical implementation or ledger acceptance relaxation was introduced.
