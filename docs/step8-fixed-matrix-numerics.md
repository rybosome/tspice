# Step 8 fixed-matrix semantics

A12 calls the actual CSPICE routines and preserves complete scalar, boolean and
matrix results. The following distinctions come from the primary references
and the pinned N0067 source. Execution evidence remains separate in the
per-backend audit.

## Inverse and rotation criteria

[`invert_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invert_c.html)
uses the strict test `abs(det(m)) < 1e-16`. A matrix passing that test produces
an all-zero result as a successful call. Both signs of a determinant at exactly
the threshold proceed through the cofactor calculation. This behavior depends
on the determinant's magnitude, not only mathematical singularity, and the
adapter does not substitute a different inversion algorithm.

[`invort_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invort_c.html)
transposes and scales the original columns: each output row is the corresponding
input column divided by that column's squared norm. It is an inverse when the
columns are orthogonal and nonzero; orthogonality is not checked. A nonorthogonal
input still yields this scaled transpose. A zero column signals
`SPICE(ZEROLENGTHCOLUMN)` and a column too small to reciprocate signals
`SPICE(COLUMNTOOSMALL)`. These are genuine CSPICE errors, distinct from `invert`'s
successful zero-matrix result.

[`isrot_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrot_c.html)
checks inclusive intervals for column norms and the determinant after unitizing
columns. It uses the caller's tolerances; it does not apply a stricter
orthogonality test. Negative finite tolerances reach CSPICE and signal
`SPICE(VALUEOUTOFRANGE)`. Nonfinite tolerance inputs are rejected at the existing
JavaScript boundary before that scientific call.

## Diagonalization retains both outputs

[`diags2_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/diags2_c.html)
uses the upper-triangular entries of its 2x2 input. The finite lower-left entry
is accepted but ignored; the adapter does not average the off-diagonal entries
or reject their inequality. Both returned matrices use flat row-major order.
For the symmetric matrix represented by the upper triangle,
`diag = transpose(rotate) * symmat * rotate`.

CSPICE chooses a rotation of smallest absolute angle. The wrapper retains its
eigenvalue order and eigenvector signs rather than sorting or canonicalizing
them. Tests compare all four entries of each output; an invariant such as the
eigenvalues or reconstruction alone would not establish that both outputs were
mapped correctly. Diagonal, repeated-eigenvalue, negative-eigenvalue and scaled
inputs have separate scenarios.

## Matrix output representation

Finite inputs can produce `NaN` or infinities through CSPICE's arithmetic.
`brandMat3RowMajorResult` validates exactly nine numeric entries and copies them
into owned row-major storage while preserving these values and signed zero.
Malformed shapes, missing entries and nonnumeric values are still rejected.
The existing `brandMat3RowMajor` and matrix input validators remain finite-only;
a nonfinite matrix result is therefore observable but cannot be reused as a
valid finite input without satisfying that contract.

The result helper changes representation handling, not scientific arithmetic.
The C shim still calls the matching CSPICE operation, and the independent oracle
calls its own library. Nonfinite observations require classification before JSON
encoding, with every decoded matrix entry retained. The shared comparator is
unchanged. Tiny finite determinants, traces, inverse entries and eigenvalues
receive separate scaled live comparisons so a zero cannot pass merely because
the ordinary absolute tolerance is larger than the expected value. Copy,
transpose and identity cases receive additional exact live comparisons;
signed zero is also checked literally.

## Independent oracle observations

Direct probes used locked SpiceyPy 6.0.3 with Python 3.12.15 on macOS arm64.
The inspected `spiceypy/utils/libcspice.so` SHA-256 was
`3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523`.
The new ordinary workflows returned 87 finite successful new-routine results
and eight expected SPICE errors: one zero-column and one too-small-column error
at each of the three positions, plus the two negative-tolerance errors. The
additional `error.reset` control in an identity workflow is not a new-routine
call. Zero matrix with `ntol=dtol=1` and reflection with `ntol=0, dtol=2` both
returned true.

The scoped 14-observation extreme test retains these eight observations and six
finite controls. `MAX` is the maximum finite double, `diag(s)` has three equal
diagonal values `s`, `all(s)` fills all nine entries with `s`, and
`q = 0.7071067811865475` is the observed rotation component. All these calls left
`failed()` false.

| Actual oracle call                      | Observed result                                 |
| --------------------------------------- | ----------------------------------------------- |
| `det(diag(1e200))`                      | `+Infinity`                                     |
| `trace(diag(MAX))`                      | `+Infinity`                                     |
| `diags2([MAX,MAX,MAX,MAX])`             | `diag=[0,0,0,+Infinity]`, `rotate=[q,q,-q,q]`   |
| `invert(diag(1e200))`                   | NaN diagonal entries, zero off-diagonal entries |
| `invert(diag(MAX,MAX,1))`               | Last diagonal entry NaN; other entries zero     |
| `mtxm(all(MAX),all(2))`                 | All nine entries `+Infinity`                    |
| `mxmt(all(MAX),all(2))`                 | All nine entries `+Infinity`                    |
| `invort([[MAX,0,0],[MAX,1,0],[0,0,1]])` | Rows `[0,0,0]`, `[0,1,0]`, `[0,0,1]`            |

The live comparison retains every entry, including finite values and signed
infinity classes. These are observations of the fingerprinted library, not a
promise of identical floating-point results under every compiler configuration.

An actual-backend recovery check initially used signed-zero-sensitive deep
equality between `invert(ident())` and `ident()`. Cofactor signs produce negative
zero in some inverse entries, while the identity routine emits positive zero.
Recovery now requires exact numeric equality (`===`) for all nine entries. No
returned value is normalized, and complete oracle comparisons and the separate
copy/transpose signed-zero checks remain unchanged.

## Inspected source identity

Source review used the macOS arm64 N0067 distribution selected by
`scripts/cspice.manifest.json`. These SHA-256 fingerprints identify the source
that defines the thresholds and column/error behavior above:

| Source file in the toolkit | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `src/cspice/invert_c.c`    | `f500a3326a84501591f2ac830a8ec43dddad5c3e5d3c0c80d104d81a934f329d` |
| `src/cspice/invort.c`      | `3a1213bff713e494f1df359782379b81c3e5756b8d272ad571993ce099f41277` |
| `src/cspice/isrot_c.c`     | `9ae9fd625cdb55003012d5b52b73ed6ab0c6227076f7f17e1878275d67d7315a` |
| `src/cspice/diags2_c.c`    | `e1aeb5c6f87665828921bf049a25b407dd11d9b2c7e671c449a476f10768ca60` |

Source inspection and assertion registration do not certify execution on either
tspice backend or on another compiler/platform. Verification requires fresh
source-bound local and observed canonical CI evidence.
