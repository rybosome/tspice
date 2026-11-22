# Polynomial expansion semantics and numerical evidence

A16 adds six canonical routines through the existing flat raw coordinate API.
Degree is inferred as `coefficients.length - 1`, including any trailing zero
coefficients. Arrays are readonly inputs; every result array, root pair and
result object owns its storage. All inputs must be finite numbers with the
shapes and integer bounds below. Actual numeric outputs retain NaN, infinity
and signed zero. No scientific formula is reconstructed in TypeScript.

| Method                    | Basis and complete result                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `chbval(cp,x2s,x)`        | `cp[i]` multiplies first-kind `T_i(s)`; returns the value.                                                |
| `chbint(cp,x2s,x)`        | Same expansion; returns `{p,dpdx}`, derivative with respect to `x`.                                       |
| `chbder(cp,x2s,x,nderiv)` | Same expansion; returns `[p,p',...,p^(nderiv)]`, derivatives with respect to `x`; workspace is internal.  |
| `chbigr(cp,x2s,x)`        | Same expansion; returns `{p,itgrlp}`, integral with respect to `x`, zero at `x2s[0]`.                     |
| `polyds(coeffs,nderiv,t)` | `coeffs[i]` multiplies `t^i`; returns value and successive derivatives in ascending order.                |
| `rquad(a,b,c)`            | Roots of `a*x^2+b*x+c`; returns `{root1:[real,imaginary],root2:[real,imaginary]}` in actual CSPICE order. |

## Transformation and reliable use

For all four Chebyshev routines, `x2s=[midpoint,radius]` maps the independent
variable to `s=(x-midpoint)/radius`. The constant coefficient is the full `T_0`
coefficient; it is not silently halved. Reliable-use acceptance stays in the
normalized closed interval `[-1,1]` and uses a nonzero radius. A shifted midpoint
and a radius other than one distinguish derivatives in `x` from derivatives in
`s`. `chbder` scales derivative `k` by the successive radius powers; `chbigr`
multiplies the integral by the radius and chooses its integration constant at
the midpoint. Every returned value, derivative and integral field is compared.

The error-free evaluator trio `chbval`/`chbint`/`chbder` directly receives finite
transformations and abscissae without clamping or new interval errors. Negative
nonzero radius reverses orientation and is covered within normalized range.
A zero radius does not define a valid normalization, and extrapolation can grow
rapidly; their passage through the raw boundary is not a claim of reliable
scientific evaluation there. High degree, large coefficients and derivative
scaling can overflow or lose accuracy even inside normalized range. Acceptance
does not use invalid-normalization or out-of-range examples as evidence of a
reliable domain. [chbder](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbder_c.html)
and [chbint](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbint_c.html).

`chbigr` has genuine source checks: inferred negative degree from empty
coefficients signals `SPICE(INVALIDDEGREE)`, and zero/negative radius signals
`SPICE(INVALIDRADIUS)`. The C header's `INVALDDEGREE` spelling is a typo; pinned
`chbigr.c` signals `INVALIDDEGREE`, confirmed by the locked oracle. A non-null
dummy coefficient buffer for the empty case is never read before that error.
The raw adapter preserves these genuine errors instead of preempting them with
a different validation result. [chbigr](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbigr_c.html).

## Defined counts and workspace

Coefficient count is at most 2,147,483,647, giving inferred degree at most
2,147,483,646. This keeps the Chebyshev source's `degree+1` signed arithmetic
safe. `chbval`, `chbint` and `chbder` require nonempty coefficients because their
source unconditionally reads coefficient zero. `chbigr` and `polyds` preserve
their meaningful empty-coefficient paths with valid dummy storage.

`chbder` accepts integer order `0..715827881`. Pinned workspace indexing uses
`3*i+2`, so the next integer order would overflow signed32 indices. It needs
`3*(nderiv+1)` workspace doubles and `nderiv+1` output doubles. `polyds` accepts
negative signed32 orders and nonnegative orders at most 2,147,483,646. Its
inclusive initialization loop would overflow the final increment at
`INT32_MAX`. The bounds are checked before large allocations or entry access;
tests reject synthetic impossible dimensions without executing undefined loops.

WASM retains the existing 256 MiB **per-buffer** cap, including coefficient,
output and derivative workspace buffers. That means at most 33,554,432 doubles
per buffer, with the workspace making the effective `chbder` order limit
11,184,809 and the output making the `polyds` nonnegative order limit 33,554,431.
These policy ceilings do not promise that maximum-sized calls fit available
memory or have been executed. Native/shared C also checks byte arithmetic.
Negative-order output still has valid sentinel storage; an empty public array
is not a null C output pointer.

## Ordinary polynomial and quadratic boundaries

Pinned `polyds` returns immediately without writing output when `nderiv<0`.
The public result is a new empty array, after the actual canonical call. With
nonnegative order and empty coefficients, inferred degree `-1` leaves all
requested outputs initialized to zero. Nonempty coefficients retain ascending
power order and all derivative entries, including entries above the degree.
High derivative orders can produce rapid factorial growth and floating overflow;
these actual outputs are preserved. [polyds](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/polyds_c.html).

`rquad` preserves the two formula branches rather than sorting roots. For a
negative quadratic coefficient, the first root's imaginary component can be
negative. Real, complex-conjugate, repeated and zero roots retain both fields.
A linear equation (`a=0,b!=0`) returns the same root twice in distinct arrays;
`a=b=0` signals `SPICE(DEGENERATECASE)` even if the constant is also zero.
Pinned source scales coefficients only when scaling does not erase a nonzero
coefficient. It computes the smaller real root through the root product when
possible to reduce cancellation. No root-overflow check is added, and no
JavaScript quadratic formula substitutes for CSPICE.
[rquad](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rquad_c.html).

## Independent oracle route and ownership

Locked SpiceyPy 6.0.3 has all six wrappers. Inspected source calls the canonical
symbols and supplies explicit integer/scalar arguments; the sidecar passes the
inferred degree in each wrapper's actual argument position (`chbigr` takes it
first). Both root arrays, both integral/derivative object fields and every
requested derivative are retained. No wrapper presence alone certifies parity.

The `polyds` wrapper cannot return negative-order results: order -1 reaches C but
its zero-length output converter raises `IndexError`; smaller orders fail the
negative-length allocation. The narrow
[independent route](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/polynomial_oracle.py)
loads `CDLL(libspice._name)` and declares the exact `polyds_c` ABI as
`(double*,int,int,double,double*) -> void`. It invokes the actual symbol only for
negative orders, with valid source/output objects and preceding guards, then
asserts every sentinel unchanged and checks actual SPICE status. The empty
return has no numerical components to synthesize. Nonnegative orders remain on
SpiceyPy, including an unread dummy coefficient for degree -1. All guards run
before scientific invocation; rejected wrapper inputs are not oracle executions.

Production paths similarly invoke the canonical C symbol. Native owns input,
workspace and output buffers under the existing global SPICE mutex. Shared C
checks pointers/counts, invokes actual CSPICE and captures/resets errors; the
adapters read and publish outputs only after successful status checking. WASM
uses transactional allocation and copies output before freeing storage.
Caller arrays, repeated calls and returned-array mutation have separate ownership
checks; allocation fault/error recovery is independent of scientific parity.
All numeric inputs are project-authored and kernel-free, with no external fixture
or retained scientific resource.

## Upstream quadratic checkout diagnostic

The actual N0067 `rquad_c.c` error branch checks in `rquad_c`, signals
`DEGENERATECASE`, then checks out `rquad`. This unchanged toolkit typo can write
`SPICE(NAMESDONOTMATCH)` and the mismatched names directly to the current error
device. Pinned `trcpkg.c` explains the behavior: checkout diagnostics use
`WRLINE` rather than signaling a new SPICE error, and the current frame is
popped even when its name does not match. Thus the output can bypass the normal
`ERRPRT NONE` reporting selection. The raw call remains the canonical entrypoint;
there is no toolkit patch, replacement root/error logic or global setting change.

The independent locked-wheel regression enters a named caller and repeats both
degenerate cases. Each captured primary exception retains short code
`SPICE(DEGENERATECASE)`, the original long message and the captured caller-to-
`rquad_c` trace. After the wrapper's reset, failure is false, the current trace
contains only the caller and its depth is one. A subsequent valid linear root
call succeeds. A fresh signal also captures only the caller, and matching caller
checkout leaves an empty trace/depth zero. The public backend regression checks
these primary fields, automatic reset, fresh-signal caller preservation and
empty final trace through the existing raw error API.

SpiceyPy 6.0.3 initializes its error device to `NULL`, so its usual wrapper is
quiet here. An isolated oracle subprocess sets the actual `errprt_c` entrypoint
to `NONE` and selects `SCREEN`, reproducing two identical checkout diagnostics
while preserving all primary errors and stack observations. Direct `errprt_c`
is necessary in that diagnostic-only setup because the inspected SpiceyPy
`errprt` wrapper mistakenly calls `errdev_c`. None of these isolated oracle
settings alter tspice production settings. Console output is therefore a known
device-dependent toolkit limitation, not a different scientific exception.

The maintained finding closes the missing diagnostic/state evidence through
`polynomial-rquad-trace.test.ts`; it **does not claim that the upstream typo or
its printed diagnostic was fixed**. Public JSDoc retains the limitation. The first public regression helper
incorrectly required empty optional long/trace fields to be present, while the
existing backend contract omits those empty optional fields. The helper now
validates present strings and maps only omitted empty fields to the oracle
representation; production behavior and diagnostic assertions are unchanged.
All three regressions then passed on actual Node/WASM and the isolated oracle.
Final source-bound required-lane and CI verification remains separate.

## Stable coefficient and transformation inputs

The four Chebyshev methods and `polyds` now read each supplied coefficient once
into an owned array and marshal only that validated snapshot. The Chebyshev
methods also snapshot both transformation entries. Counts, workspace sizes,
native arguments and WASM heap writes use the same captured inputs; a missing
entry fails before dispatch. The scalar `rquad` API has no array input.

The [native adapter regressions](../packages/backend-node/test/polynomial-expansions-domain.test.ts)
exercise all five array-bearing methods. Two [bounded WASM marshaling checks](../packages/backend-wasm/test/polynomial-input-snapshots.test.ts)
inspect the dispatched count and heap contents and cover missing-coefficient
rejection before allocation. Those instrumented checks do not replace the 46
registered scientific workflows. The correction changes only the typed
adapters; the original CSPICE calls, 131 live-call workload, numerical limits
and documented `rquad` trace diagnostic remain unchanged. Fresh required local
lanes and observed CI for this exact source are still needed.

## Pinned source evidence

The inspected N0067 `src/cspice` implementation hashes are:

| File                                     | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `chbder.c`                               | `a48da217593544bd0059589a8ba484f07390c4cfb469a694a76656efca9b42d6` |
| `chbigr.c`                               | `9c39fc53b59a7b47567ab0624082756c17860e51fc738799946a28f3e72db26a` |
| `chbint.c`                               | `0d37a160f6e5cf2542b21653631650df5db581f18e2d8012786d072ac77e99ca` |
| `chbval.c`                               | `6a79967ab05e127ebb36a898e7bbabca514ad02dc4b7dcbb4992e325f9d85180` |
| `polyds.c`                               | `56858441ce3c9eb33341daf3b444d48622657b081e2f573e1590752df8b5818c` |
| `rquad_c.c` (actual direct C entrypoint) | `880a4ce6bfc1edd4401266ac5fc7bb08e8c52c6640ba1894bfaa91463dd78f30` |
| `trcpkg.c` (traceback handling)          | `2a75b7d003525471894d79cd7d20b1a17e2cfed8f188844402ec8150d7fee484` |

Source review and independent probes do not alone establish final backend verification. The maintained audit separately requires fresh full local lanes and observed canonical CI against the final source digest.

## Observed comparisons and acceptance scope

The frozen registry contains 46 scenarios and 131 actual new-routine calls:
`chbder` 8/24, `chbigr` 10/24, `chbint` 7/20, `chbval` 7/20,
`polyds` 6/21 and `rquad` 8/22 (scenarios/calls). Five calls are genuine
CSPICE errors: three degree/radius cases and two degenerate-equation cases.
Independent smoke through the new decoder/handlers observed all 126 successful
calls and all five errors using Python 3.12.15, locked SpiceyPy 6.0.3 and the
previously inspected macOS arm64 library SHA-256
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
The branch-local required lanes and CI remain separately recorded evidence.

Sixteen tagged observations per backend retain every field outside ordinary
JSON's finite-number representation, together with finite controls. Chebyshev
arguments remain within normalized range and all workspaces are bounded. With
`M=Number.MAX_VALUE`, coefficients `[M,M]` at normalized argument one produce:

| Routine               | Actual locked-oracle output     |
| --------------------- | ------------------------------- |
| `chbder`, order3      | `[Infinity,M,0,0]`.             |
| `chbigr`              | `{p:Infinity,itgrlp:Infinity}`. |
| `chbint`              | `{p:Infinity,dpdx:M}`.          |
| `chbval`              | `Infinity`.                     |
| `polyds`, order3, t=1 | `[Infinity,M,0,0]`.             |

With `cp=[0,1]`, zero midpoint/abscissa and a positive minimum-subnormal radius,
`chbder` order3 produces `[0,Infinity,NaN,NaN]`: successive radius powers can
underflow even though the normalized evaluation argument is zero. `chbint`
retains its corresponding infinite derivative. No zero-radius case is needed
to observe these actual numerical limits.

`rquad(MIN,1,M)` returns `{root1:[NaN,0],root2:[-Infinity,0]}` and the linear
`rquad(0,MIN,1)` returns two `[-Infinity,0]` pairs. Finite controls include large
coefficients with safe scaling, ordinary complex roots and every field of the
polynomial controls. Exact negative-zero root fields are retained rather than
normalized. These are pinned observations; they do not promise stable rounding
for every ill-conditioned coefficient set across all compiler builds.

The tagged comparator checks full array/object shapes, all fields, nonfinite
classifications and zero signs exactly; finite nonzero values use relative-only
`1e-12` tolerance. Focused ordinary live tests rescale small coefficients,
successive radius powers, integrals and both very unequal quadratic roots. The
global comparator remains unchanged. A separate independent program invokes six
negative-order canonical calls with sentinel checks, rejects five unsafe
count/order inputs before C, and verifies genuine error/reset/recovery. Those
control calls are separate from registered coverage counts.

Source-level tests include twelve public tests, three extremes/oracle-guard
tests, 35 WASM allocation/boundary tests (25 fault positions, six successful
routes and four boundary/error/sentinel/copy checks), and native adapter/addon
boundary tests. The additional RPC regression sends ordered complex pairs with
negative leading coefficient, every derivative-order entry, both integral fields
and negative-order empty output through the real RPC codec and `structuredClone`
using connected worker test endpoints. It does not claim browser delivery or
actual worker startup. Runtime and final source-bound verification results are
recorded separately by the integration owner.

At the completed focused checkpoint, the integration owner reported 92 live registered Node/WASM comparisons, 12 public tests, three extremes/oracle-guard tests, 35 WASM allocation/boundary tests, 31 native boundary tests, two actual RPC tests and all three diagnostic/trace regressions passed. No production scientific workaround or toolkit/global-setting change was made. Full required local lanes and observed canonical CI remain pending; these audits stay reviewed.
