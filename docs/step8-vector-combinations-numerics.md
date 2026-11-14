# Step 8 vector combination observations

A09 forwards each raw operation to the corresponding CSPICE routine. Its
semantic review distinguishes reference prose, the pinned N0067 implementation,
and independently observed execution. The observations below do not establish
universal behavior across toolkit versions or compiler builds.

## `vperp` with a zero reference vector

The [NAIF `vperp_c` reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vperp_c.html)
describes the component of `a` perpendicular to `b`. Its particulars say a zero
`b` returns `a`. The same prose is present in the pinned source header, but the
function body returns a zero vector if either input's largest absolute
component is zero. Those are different observable results for nonzero `a`.

The raw contract follows the pinned compiled implementation. It does not
replace that operation with a mathematical decomposition or silently copy `a`
to match the reference prose. The registered
`coords-vectors-vperp-zero-input-and-zero-reference` workflow observes zero on
either side and both sides. The ordinary nonzero projection and perpendicular
cases remain separate, including reversed operands, orthogonality, scaled
inputs and scaled/sign-reversed references.

Source inspection used the macOS arm64 N0067 distribution selected by
`scripts/cspice.manifest.json`. SHA-256 fingerprints identify the inspected
artifacts:

| Artifact                                                   | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Extracted `src/cspice/vperp_c.c`                           | `63d0c20367c31527835f27f30a2e860213aa80ae490b7487a41c6127fede1a95` |
| Extracted `lib/cspice.a`                                   | `f3a1adf1742c7a63c390834f4227936a36e3c18dd78bf427bc96a04b703946f3` |
| Locked SpiceyPy 6.0.3 `spiceypy.py`                        | `86aaf23ee18e1ba86ebdc97a69d1d3c533136b98ac833195eeb29824ff76f420` |
| Inspected macOS arm64 oracle `spiceypy/utils/libcspice.so` | `3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523` |

The Python wrapper calls `libspice.vperp_c` directly and retains all three
output components. A direct call to `spiceypy.vperp([1,-2,4], [0,0,0])` in the
fingerprinted oracle returned `[0,0,0]`, with `spiceypy.failed()` false. The probe
used Python 3.12.15 and locked SpiceyPy 6.0.3 on macOS arm64. This agrees with
the pinned C body and contradicts the header's zero-reference prose.

This is an oracle observation, not certification of the tspice backend paths.
Current-source local and canonical CI observations belong in the maintained
per-backend audit before any verification claim.

## Finite-input numerical extremes

Direct calls to the same oracle produced the following results. `MAX` denotes
`1.7976931348623157e308` and `MIN` denotes `5e-324`; `2I` is the diagonal matrix
with all three diagonal entries equal to two. Every call left `failed()` false.
The table uses output classes where a long finite value is unimportant. The
focused live test retains complete unrounded results for its own 15-observation
workflow. The large parallel `vperp` call below is an additional exploratory
oracle observation; it is not included in that focused workflow.

| Call                                                          | Observed output                 |
| ------------------------------------------------------------- | ------------------------------- |
| `vlcom(2, [MAX,-MAX,0], 1, [MAX,-MAX,1])`                     | `[+Infinity,-Infinity,1]`       |
| `vlcom3(2, [MAX,-MAX,0], 1, [MAX,-MAX,1], 0.5, [MAX,-MAX,2])` | `[+Infinity,-Infinity,2]`       |
| `vproj([MIN,0,0], [1,0,0])`                                   | `[NaN,NaN,NaN]`                 |
| `vperp([MIN,0,0], [1,0,0])`                                   | `[NaN,NaN,NaN]`                 |
| `vproj([MAX,MAX,0], [1,1,0])`                                 | `[+Infinity,+Infinity,NaN]`     |
| `vperp([MAX,MAX,0], [1,1,0])`                                 | `[0,0,0]`                       |
| `vrel([MAX,0,0], [-MAX,0,0])`                                 | `NaN`                           |
| `vrotv([MAX,MAX,0], [0,0,1], 0.25)`                           | `[finite positive,+Infinity,0]` |
| `rotvec([MAX,MAX,7], 0.25, 3)`                                | `[+Infinity,finite positive,7]` |
| `vtmv([MAX,MAX,MAX], 2I, [1,1,1])`                            | `+Infinity`                     |

These observations are scoped to the fingerprinted oracle. They motivate live
classification of nonfinite values before JSON encoding and comparison of all
decoded fields. They do not authorize rewriting the scientific results,
dropping components, rejecting otherwise accepted finite input, or claiming
universal cross-build equality. The raw shim still calls the actual CSPICE
operation. Backend execution and same-client recovery require their own test
evidence.

## Numerical comparison scope

The reference routines perform floating-point arithmetic. Finite inputs do not
guarantee finite outputs, exact cancellation, or identical arithmetic across
compilers. A09 retains the existing shared comparator and preserves every
result component. Focused tests rescale tiny linear/projection/perpendicular
components and multiply the nearby-large-vector relative difference by `1e15`
before comparing to the same live oracle results. Registration under an absolute
tolerance alone is not credited with establishing those nonzero values.

`vrotv` rotates a vector actively in the right-handed sense, while `rotvec`
expresses it in coordinates rotated by the supplied angle. Positive angles
therefore give opposite vector motion about the same axis. `rotvec` preserves
CSPICE's modulo-three handling of signed 32-bit integer axis indices. These
conventions are tested as returned components, not by replacing results with
orientation-invariant norms. `vtmv` uses unequal vectors and a nonsymmetric
matrix so transposition or operand-order mistakes change the scalar result.
