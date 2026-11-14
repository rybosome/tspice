# State derivative semantics and numerical evidence

A11 adds `ducrss`, `dvcrss`, `dvdot`, `dvhat`, `dvnorm` and `dvsep` through the
existing flat raw coordinate API. Each adapter calls the actual canonical CSPICE
entrypoint. Inputs are readonly six-number states `[x,y,z,dx,dy,dz]`, with the
last three entries differentiated with respect to one common parameter. That
parameter is normally time, but the routines do not impose it. Inputs use
compatible frames and units; `dvsep` additionally assumes a common observer and
epoch. Authored numerical states require no kernels or external fixtures.

The scalar results are actual CSPICE values. State outputs are new owned
six-element arrays, preserving every position and derivative component. Input
validation requires finite numbers in every slot. Numeric output validation
preserves actual NaN, infinity and zero signs instead of imposing the input
restriction on computed results. This does not remove a routine's documented
caller restrictions or make an undefined mathematical derivative well defined.

## Routine semantics and caller domain

| Routine         | Actual operation and distinguished boundary                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dvcrss(a,b)`   | Position cross product and `cross(a.velocity,b.position) + cross(a.position,b.velocity)`. Operand reversal changes signs; zero position can still leave a nonzero derivative.                                                                                            |
| `dvdot(a,b)`    | Derivative of the position dot product: six ordered products combining each position with the other state's derivative. This is not a six-dimensional dot product. NAIF requires magnitudes that avoid intermediate overflow.                                            |
| `ducrss(a,b)`   | Unit cross direction and its derivative after the pinned internal whole-state scaling described below. NAIF still requires magnitudes that avoid intermediate overflow.                                                                                                  |
| `dvhat(state)`  | Unit position and its derivative. Pinned source calls `unorm`, then removes the velocity component along the unit direction and scales by reciprocal position norm. If the computed norm is zero, it returns zero position and copies the original derivative unchanged. |
| `dvnorm(state)` | Dot product of the derivative with the unit position; computed zero position norm returns zero. Actual normalization/dot rounding and magnitude limits remain visible.                                                                                                   |
| `dvsep(a,b)`    | Negative derivative of the normalized-position dot product divided by the normalized-position cross norm. An exactly zero computed cross returns zero; otherwise pinned `ZZDIV` guards the quotient.                                                                     |

The usual unit-direction outputs are dimensionless with inverse-parameter
units for their derivatives. `dvnorm` has the original derivative units;
`dvdot` and `dvcrss` carry products of position units and their derivative units.
The explicit zero-position and zero-cross conventions retain the corresponding
source values even when the ordinary derivative formula is singular.
Primary references: [ducrss](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ducrss_c.html),
[dvcrss](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvcrss_c.html),
[dvdot](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvdot_c.html),
[dvhat](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvhat_c.html),
[dvnorm](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvnorm_c.html),
and [dvsep](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvsep_c.html).

## Pinned `ducrss` scaling at a zero cross product

The published prose describes the zero-cross output derivative in terms of the
original inputs. The pinned implementation first divides **all six components**
of each state by its largest absolute position component; a state with all-zero
position is left unscaled. It then calls `dvcrss` on those scaled states, followed
by `dvhat`. Thus a computed zero cross preserves the derivative of the scaled
cross, which can differ from the original-state derivative.

Independent locked-library observations make the difference explicit:

| Inputs                                    | `ducrss` result                   | `dvcrss` result      |
| ----------------------------------------- | --------------------------------- | -------------------- |
| `a=[2,0,0,0,2,0]`, `b=[4,0,0,0,0,4]`      | `[0,0,0,0,-1,-1]`                 | `[0,0,0,0,-8,-8]`    |
| `a=[0,0,0,0,2,0]`, same `b`               | `[0,0,0,0,0,-2]`                  | `[0,0,0,0,0,-8]`     |
| `a=[1,2,4,3,-5,7]`, `b=[2,4,8,11,13,-17]` | `[0,0,0,-4.8125,1.59375,0.40625]` | `[0,0,0,-154,51,13]` |

The raw API, JSDoc and tests retain this source behavior. No TypeScript
reconstruction substitutes the prose formula. Acceptance uses finite inputs
within the documented overflow restriction, including scaled states and
independently scaled derivatives. Internal scaling is not a guarantee against
reciprocal or later intermediate overflow for every finite input.

## `dvsep` guarded division and singular conditioning

Pinned `dvsep` normalizes both full states using `dvhat`, forms the position
cross, and returns zero only when that computed cross is exactly zero. Otherwise
it computes the two dot-product terms of the angular derivative and passes the
quotient to `ZZDIV`. The latter uses decimal logarithms with exponent derived
from the maximum double: it signals `SPICE(NUMERICOVERFLOW)` for a logarithmic
quotient above 308, and returns zero without error below -307. This is narrower
than merely checking whether a double result would be finite. Its denominator
zero branch signals `SPICE(DIVIDEBYZERO)`; that source branch is not itself a
claim of a registered reachable `dvsep` example.

For `a=[1,0,0,0,1.5e308,0]`, `b=[0,1,0,0,0,0]`, the actual oracle signals
`NUMERICOVERFLOW`, although the derivative component is finite. Changing that
component to `1e-308` yields zero; `1e-306` remains nonzero. Both signs of the
observable cutoff and actual error/reset recovery belong in acceptance. The
published header's general underflow/error wording does not override the pinned
zero-return implementation.

Mathematically collinear input positions need not produce an exactly zero cross
after floating normalization. For `a=[1,2,4,3,-5,7]` and
`b=[2,4,8,11,13,-17]`, the locked wheel returned approximately
`-82.09635620184109`. Division by `sqrt(21)` introduces non-dyadic unit components,
so a residual normalized cross can enter the quotient at this singular boundary.
This observation alone is not proof of a backend discrepancy, and it is not a
portable physical angular derivative. Compiler-dependent cancellation can
materially affect such results.

The registered singular-zero assertions therefore use exact axis-aligned
parallel and opposed positions. Mixed non-collinear states, near-parallel
nonzero cases and all six derivative components remain covered. No global
tolerance is widened, no angle or residual is clamped, no production arithmetic
is changed, and no eligible routine is excluded. The public caveat describes
the computed-cross condition rather than promising zero for every mathematical
collinearity on every compiler build.

## Direct routes and source evidence

Locked SpiceyPy 6.0.3 has all six wrappers. Inspected wrapper source validates
six-element inputs, calls the corresponding `libspice.<routine>_c`, and forwards
all six output entries or the scalar. No independent replacement binding or
scientific fallback is needed. Both TypeScript and Python dispatch preserve
state ordering and the distinction between vector and scalar results.

Native adapters validate every state entry, use fixed local six-double storage
under the existing global SPICE mutex, and copy result arrays. Shared C checks
non-null input/output pointers, uses local result storage, invokes the exact
canonical symbol and checks SPICE failure before publishing successful values.
Errors capture diagnostics and reset before throwing. WASM uses transactional
allocation, fixed-size state buffers and copies output before freeing memory;
allocation-failure and recovery tests remain separate from scientific parity.

The inspected pinned N0067 `src/cspice` source hashes are:

| File       | SHA-256                                                            |
| ---------- | ------------------------------------------------------------------ |
| `ducrss.c` | `27c600d4b6d51653720f8a0ebce0dd9f3afb39d6602b9fd43bc331354b254068` |
| `dvcrss.c` | `862c8dcdc3665d78c9a08608219d22e897bead296636d791142b804c409412b1` |
| `dvdot.c`  | `cdc49d9f02b510c94ca7f838332b96f3b85c7c4d18fe82c8581ec18304402f4a` |
| `dvhat.c`  | `9d9161fa01ca193663f18f937221de9827dd6fabab6ea21458199c50cb959a81` |
| `dvnorm.c` | `281466ec52b0108e46ccd2e83bedd99c105044e3be6bbc247cfe7ed6d88fb297` |
| `dvsep.c`  | `a588e34778fa494369dc7e93b6b9837d9f9c9ff56a2f96e56a8805c3f308d83f` |
| `zzdiv.c`  | `90decca484c9626d39e8e90d95e401d3eec81bdf23ef2a90625e9d75407f2ae3` |

Source review and independent observations do not establish final backend verification. The batch audit records source-bound required local and observed canonical CI execution separately.

## Observed comparisons and acceptance scope

The frozen registry contains 39 scenarios and 106 actual new-routine calls:
`ducrss` 6/17, `dvcrss` 6/17, `dvdot` 6/17, `dvhat` 6/15,
`dvnorm` 5/14 and `dvsep` 10/26 (scenarios/calls). Two calls are the genuine
signed `dvsep` overflow errors; the others succeed with complete finite outputs.
The independent smoke exercised the new Python decoder/handlers against locked
SpiceyPy 6.0.3, using the previously inspected Python 3.12.15 macOS arm64
library whose SHA-256 is
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
The branch's required local and CI environments remain separate execution records.

A test-only tagged route preserves all fields in twelve additional observations
per backend. It covers actual `dvcrss` position/derivative overflow, `dvhat`
reciprocal/norm limits and copied zero-position derivatives, and `dvnorm` signed
overflow and overflowing-position normalization, with finite controls. For a
minimum-subnormal position `[MIN,0,0]` and derivative `[0,1,0]`, the actual
`dvhat` output is `[1,0,0,NaN,Infinity,NaN]`. `dvnorm` on position `[1,1,1]`
and all-maximum positive or negative derivatives yields the corresponding signed
infinity. Zero-position `dvhat` preserves finite extrema, subnormals and negative
zero in its copied derivative. These probes deliberately do not violate the
caller overflow restrictions of `ducrss` or `dvdot`.

The tagged comparator checks every array component, shape, nonfinite value and
zero sign; finite nonzero outputs use relative-only `1e-12` tolerance. Ordinary
live tests separately rescale small state/derivative outputs and the signed
`dvsep` finite cutoff controls. An independent same-process oracle program also
observes each overflow exception, resets the actual oracle and confirms valid
call recovery. Rejected wrapper inputs and error-control steps are not counted
as additional registered scientific calls. Global comparison behavior is unchanged.

At source freeze the integration owner reported 78 live registered Node/WASM
scenario comparisons, 10 public tests, three extremes/oracle-recovery tests,
31 WASM allocation/boundary tests and 32 native boundary tests passed. The WASM
allocation test initially expected only the four routine buffers on a genuine
`dvsep` error; the existing structured error reader also allocates three buffers
for short, long and trace diagnostics. The assertion now counts all seven,
retains pointer/free accounting and error/recovery checks, and passes. No
production source or scientific assertion changed in that repair.

All audits remain reviewed pending fresh complete required local lanes and
observed canonical CI against the final source digest. Focused checks and source
inspection do not alone establish PR readiness.
