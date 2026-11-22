# General-vector semantics and numerical evidence

A10 adds fifteen general-dimensional CSPICE routines through the existing flat
`raw` coordinate API. Each path calls its actual `_c` entrypoint; the general
routines are not implemented by padding to three components, looping over a
three-vector API, or replacing the mathematics in TypeScript. The
[batch audit](../data/parity-audits/a10-general-vectors.json) records each routine's
registered observations and source-bound execution status separately.

## Dimensions, empty vectors and ownership

All vector inputs are readonly dense arrays of finite numbers. The dimension is
inferred from the array length, and every paired input must have the same length.
`vlcomg(a,v1,b,v2)` alternates coefficients and vectors; its adapter supplies the
inferred dimension to CSPICE's dimension-first C signature. Coefficients are
finite numbers. Inputs remain unchanged and every returned array owns its storage,
including the `unit` array within `unormg`'s `{unit,norm}` result.

Empty calls still invoke the actual CSPICE routine with dimension zero. Native
input/output vectors reserve at least one double, and WASM allocates at least
one double per vector buffer. This valid non-null storage is a sentinel, not an
extra public component; output arrays are sliced/copied using the original zero
dimension. This avoids null buffers without inventing scientific empty results.

| Empty call family                                                         | Pinned result          |
| ------------------------------------------------------------------------- | ---------------------- |
| `vaddg`, `vequg`, `vhatg`, `vlcomg`, `vminug`, `vprojg`, `vsclg`, `vsubg` | New empty array.       |
| `vdistg`, `vdotg`, `vnormg`, `vrelg`, `vsepg`                             | Zero scalar.           |
| `vzerog`                                                                  | `false`.               |
| `unormg`                                                                  | `{unit: [], norm: 0}`. |

`vzerog` deliberately differs from applying JavaScript `every` to an empty array:
the pinned routine returns false for nonpositive dimension. For a nonempty vector
it compares every component exactly to zero; either zero sign counts, but even a
minimum subnormal is nonzero. See
[vzerog](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vzerog_c.html) and
[unormg](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unormg_c.html).

## Defined dimension and byte limits

The signed32 dimension ceiling is 2,147,483,647 for thirteen routines. `vprojg`
and `unormg` instead cap at 2,147,483,646: their pinned translated Fortran paths
use one-based signed loop counters with `i <= ndim` followed by increment. At
`INT32_MAX` that final increment would overflow. `vprojg_c` calls `vprojg_`, which
uses the translated dot/scale loops; `unormg_c` calls `unormg_`, including its norm
and output loops. Those routines' bound is checked before allocation or scientific
execution. The other direct C loops use zero-based counters and do not share
that exact terminal-increment issue.

WASM's existing 256 MiB **per-buffer** cap is tighter: 33,554,432 doubles. Byte
counts use checked arithmetic, and shared C also rejects dimensions that would
overflow `size_t` byte multiplication. These bounds are preconditions, not claims
that maximum-sized calls are practical or tested. Guard tests must reject
out-of-domain dimensions without allocating giant vectors or executing undefined
C loops. Pair-length mismatch is a wrapper error; callers cannot separately
supply a count that exceeds their actual arrays.

## Numerical behavior of the general routines

`vaddg`, `vsubg`, `vminug`, `vsclg` and `vlcomg` preserve component order and actual
CSPICE arithmetic. `vequg` is an exact owned copy. `vdotg` accumulates products in
component order, retaining cancellation, overflow and underflow. `vnormg` scales
components before forming the norm; `vdistg` scales differences, but subtraction
itself can overflow before scaling. A final norm beyond double range is still
infinite. `vhatg` divides by that computed norm, so an overflowed norm can give a
zero normalized array. `unormg` returns both actual outputs rather than deriving
one from the other in JavaScript.

`vprojg` uses ordinary `dot(a,b)/dot(b,b)` followed by scaling `b`. If its computed
denominator is zero, including underflow for a tiny nonzero vector, the scale is
zero. Dot overflow and division limits remain observable. This source path is
not assumed numerically identical to three-component `vproj`.
[vprojg reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vprojg_c.html).

`vrelg` returns zero when the computed distance is zero; otherwise it divides
that distance by the larger computed norm. Its nominal mathematical range [0,2]
is not a clamp on raw floating results at extreme magnitudes.
[vrelg reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vrelg_c.html).

Pinned `vsepg_c` first computes both norms and returns zero if either is zero.
It branches on the **raw dot product**, then uses reciprocal norms and an inverse
sine of a normalized sum/difference. A zero dot product selects pi/2. Dot-product
underflow can therefore select pi/2 for tiny parallel vectors. Nearly parallel
or opposed inputs can lose precision, and the source does not clamp inverse-sine
arguments or repair nonfinite intermediate arithmetic. This is the actual general
routine, not the numerically different three-component `vsep` algorithm.
[vsepg reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vsepg_c.html).

## Independent route and source review

Locked SpiceyPy 6.0.3 has wrappers for all fifteen names. Source inspection confirms
each calls the corresponding canonical C symbol. Most infer dimension from their
input; `vlcomg` takes it explicitly, so the sidecar must pass the validated vector
length first. `unormg` returns vector and norm, both of which must reach comparison.
No wrapper presence alone establishes correctness or execution coverage.

The nine vector-output wrappers expose a concrete zero-dimension defect: they
call the correct C routine, then raise `IndexError` while converting a zero-length
ctypes output array. The new
[independent binding](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/general_vector_oracle.py)
uses `ctypes.CDLL(libspice._name)` only for these empty vector results. Each
signature matches the actual canonical C symbol, including dimension-first
`vlcomg_c` and the separate norm pointer for `unormg_c`; return types are void.
Valid dummy storage has an additional guard before each passed pointer, and
assertions verify that neither input nor output vector storage was written at
dimension zero. The empty output shape has no numerical elements to invent;
`unormg`'s norm is read from the actual C output. Nonempty vector calls and scalar
empty calls retain the actual SpiceyPy wrappers. This repairs the independent
oracle's representation boundary, not CSPICE semantics or the public backend.
The binding also validates equal lengths, finite entries and the per-routine
safe dimension before any scientific call.

The pinned N0067 `src/cspice` sources inspected include:

| File         | SHA-256                                                            |
| ------------ | ------------------------------------------------------------------ |
| `vprojg.c`   | `8bcbe6c155bcd4efde9bcc8bdfa40206b05f1b19852dfdd3cee4a094ef6e682e` |
| `vdotg.c`    | `49ff06645866ef0ba20ada1697372c5e036f512ae30643ef91d8d992a04650b1` |
| `vsclg.c`    | `ea28f36132a7b6e2d721029d7493de4dd65027847342af1c34944e7ab6fb0f3f` |
| `unormg.c`   | `4761dff280de1dabb641b17508d06c8649e1cd3045f24e374db6fc0a941255dc` |
| `vnormg.c`   | `52955cf12311ddf0445328d6e9827901b09be3273a0d34d66a19082202d536a9` |
| `vnormg_c.c` | `77ee4c5d0d721cfb43606f162964473b6bc4b66975aec6283ef03bd9cde59646` |
| `vdistg_c.c` | `19e4de4b0c3c3acd1c68a88f8d312a3432f37750c39fa9f14bc2f13ce04e3da4` |
| `vsepg_c.c`  | `3bb5bcee5509194d1ecb1b7b7aec13e7bec9288f62bfbea18e190e07f7d560ce` |
| `vzerog_c.c` | `00201b3e67ed2bfad96bc5b329449462cb8ef5a591dd7f1a8c38a1a97812d268` |

`vprojg.c` lines 258–265 show the actual dot/scale path; `unormg.c` lines
239–259 show norm/output handling and one-based loops. `vzerog_c.c` lines
308–326 show the empty-vector exception and exact component predicate. These
source observations establish the review rationale; actual local and observed
canonical CI evidence remains separately required before verification.

## Observed comparisons and scope

The frozen registry contains 82 scenarios and 205 actual new-routine calls, all
with successful scientific outcomes. It covers dimensions 0, 1, 2, 4 and 7,
order-sensitive inputs, last-component contributions, zeros, axes, cancellation,
and both large and small scales. Focused live checks rescale tiny outputs,
including squared scales for dot products and the roughly `8e-15` nearby-vector
`vrelg` result. Exact comparisons preserve finite extrema and minimum subnormals.

The tagged test route separately preserves all scalar, vector and object fields
that ordinary JSON cannot carry faithfully. Its 22 observations include the
following actual pinned-oracle results, where `M` is `Number.MAX_VALUE`:

| Observation                                                                         | Result                                                                                               |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Component arithmetic `vaddg`, `vsubg`, `vsclg`, `vlcomg` with signed `M` components | Signed infinities in overflowing entries; every remaining finite component is retained and compared. |
| `vdotg([M,M],[2,2])`                                                                | Positive infinity.                                                                                   |
| `vdistg([M,0],[-M,0])`, `vrelg` on the same pair                                    | NaN.                                                                                                 |
| `vnormg([M,-M,0,0])`                                                                | Positive infinity.                                                                                   |
| `vhatg([M,-M,0,0])`                                                                 | `[0,-0,0,0]`.                                                                                        |
| `unormg([M,-M,0,0])`                                                                | `{unit:[0,-0,0,0],norm:Infinity}`.                                                                   |
| `vprojg([M,M],[1,1])`                                                               | `[Infinity,Infinity]`.                                                                               |
| `vprojg([M,M],[M,M])`                                                               | `[NaN,NaN]`.                                                                                         |
| `vsepg([M,M],[-M,-M])`                                                              | Zero after norm overflow.                                                                            |
| `vequg([-0,+0,1,-1])`, `vminug` on the same input                                   | Exact signed copy and `[+0,-0,-1,+1]`, respectively.                                                 |

Seven finite controls using `M/4` distinguish intermediate overflow from normal
large-input behavior. These are observations of the actual pinned builds, not a
promise that every ill-conditioned combination has identical rounding across
all compiler builds. In particular, the dot overflow probe uses same-sign
products rather than asserting compiler-independent cancellation of infinite
products. The tagged comparator checks NaN, infinity and zero signs exactly,
finite nonzero values with relative-only `1e-12` tolerance, and every array length
and object field. The global parity tolerance remains unchanged.

Independent source smoke used Python 3.12.15 and SpiceyPy 6.0.3 in the existing
A08 sidecar environment, with A10's decoder, handlers and independent bindings.
Its macOS arm64 `libcspice.so` SHA-256 is
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
All 205 registered calls, 22 tagged observations, and the separate empty/guard
program succeeded there. The latter invokes all nine canonical empty vector
routines and checks six precondition rejections; rejected inputs do not count as
scientific CSPICE executions. The integration owner's branch-local environment
and required lanes remain separately recorded execution evidence.

At the source-freeze checkpoint the integration owner reported 164 live
registered Node/WASM scenario comparisons, 12 public tests, three extreme/oracle
guard tests, 73 WASM allocation/boundary tests, 116 native boundary tests
(114 adapter mocks and two actual-addon tests), and two actual-backend RPC tests
passed. The RPC test sends dynamic seven-component arrays, an empty `unormg`
object, infinities, NaNs and negative zero through the real value codec and
`structuredClone` using connected worker test endpoints. It verifies this
serialization boundary, not browser delivery or real worker startup.
These focused results are progress evidence; final source-bound required local
lanes and observed canonical CI still govern audit verification and PR readiness.
