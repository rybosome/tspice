# General matrix operations

A13 exposes eight general-dimensional matrix operations through
`CoordsVectorsApi`. Each operand is a readonly flat array of finite doubles.
Explicit signed32 dimensions describe its row-major layout. The seven
array-returning methods allocate independently owned flat results. `vtmvg`
returns one number. These adapters reuse the general-vector input snapshots and
result handling from A10. [Parent PR #715](https://github.com/rybosome/tspice/pull/715)

Here `r` and `c` are output extents and `k` is the contracted extent for
products. Each dimension appears in canonical C argument order.

| Raw call               | Operand shapes                             | Output                    |
| ---------------------- | ------------------------------------------ | ------------------------- |
| `mequg(A, r, c)`       | A is r × c                                 | Copy with the same layout |
| `mtxmg(A, B, r, k, c)` | A is k × r, B is k × c                     | AᵀB, r × c                |
| `mtxvg(A, x, r, k)`    | A is k × r, x has length k                 | Aᵀx, length r             |
| `mxmg(A, B, r, k, c)`  | A is r × k, B is k × c                     | AB, r × c                 |
| `mxmtg(A, B, r, k, c)` | A is r × k, B is c × k                     | ABᵀ, r × c                |
| `mxvg(A, x, r, k)`     | A is r × k, x has length k                 | Ax, length r              |
| `vtmvg(y, A, x, r, c)` | y has length r, A is r × c, x has length c | yᵀAx, scalar              |
| `xposeg(A, r, c)`      | A is r × c                                 | Aᵀ, c × r                 |

## Dimensions and storage

Every dimension and exact input length is checked before reading an element or
allocating output. Each operand, output and applicable CSPICE temporary can
hold up to 33,554,432 doubles (256 MiB). Matrix-matrix operations also limit
the number of output rows to 33,554,432 because the C outer loop visits rows
even when the output has zero columns. An unused axis can reach INT32_MAX
on an empty `mequg` or `xposeg` without traversing it. Products and derived
offsets are bounded before entering pinned C. The coverage ledger follows the
directly included shape-check helper and requires each matrix method's
corresponding scientific entry point on both backends. Removing the native
MTXMG call or its shape-check header fails the ledger regressions.
[Shared shape checks](../packages/backend-shim-c/include/tspice_matrix_shapes.h)
[Ledger regressions](../scripts/coverage-ledger.test.mjs)

All eight routines support zero extents with valid physical storage for
each logical empty buffer. An empty output has zero logical components. A
nonempty product with zero contracted extent receives a zero in every output
element. A zero-extent `vtmvg` gives scalar zero. N0067 `mxmg_c` and
`mtxmg_c` also define a negative contracted dimension as an empty contraction.
The adapters forward that original signed dimension and require empty
inputs. N0067 `xposeg_c` returns without writing when either dimension is
nonpositive. Other negative dimensions are rejected by the public boundary.
In particular, `mequg_c` passes the signed row–column product to a byte-copy
macro. [MXMG](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mxmg_c.html)
[MTXMG](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mtxmg_c.html)
[XPOSEG](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xposeg_c.html)

The five matrix-matrix and matrix-vector products allocate their own
temporary buffer in the toolkit and can signal `SPICE(MALLOCFAILED)`.
For an empty output, the pinned implementation can request zero bytes and
inspect the allocator's returned pointer. Both tested runtimes succeeded
for these calls. Adapter allocation failures are injected separately and
the acquired WASM temporaries are released at every tested position.

## Independent observations

SpiceyPy 6.0.3 infers dimensions for most matrix operations from nested
sequences. The sidecar reshapes validated positive input to the declared
extents, calls the corresponding high-level wrapper and checks the resulting
shape before flattening. For zero or supported negative extents it binds
the canonical symbols in the same locked library using their exact argument
order, a non-null initialized sentinel for an empty input, and caller-sized
output. It verifies the sentinel on logically empty output calls.

MEQUG needs an additional distinction. The locked high-level wrapper passes
its dimensions as `nc, nr`, while the header specifies `nr, nc`. Their
product gives the same copy count on supported positive inputs. The
sidecar binds the C entry point in header order for every call and compares
a positive nonsquare result byte-for-byte with the ordinary wrapper,
including a negative zero. [MEQUG](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mequg_c.html)
[Independent oracle](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/general_matrix_oracle.py)

The eight case files contain 60 workflows and 132 actual new-method calls.
Nonsquare inputs distinguish AB, AᵀB and ABᵀ. Distinct row/column extents,
permuted basis vectors, singleton dimensions, ordered cancellation and
products with tiny entries make transposition, stride and contraction order
observable. Two public cross-backend suites check independently owned
buffers and identities including (AB)ᵀ = BᵀAᵀ, (AB)x = A(Bx), and
yᵀ(AB)x in both contraction directions.

Ordinary workflow comparison retains the existing absolute and relative
tolerances. Separate tests compare full-component dyadic results of order
2⁻⁶⁰⁰ exactly. Supplementary tests classify signed zero, signed infinities
and NaN on a private test wire. For instance, the observed pinned call
`vtmvg([2], [Number.MAX_VALUE], [0], 1, 1)` yielded NaN when its first
multiplication overflowed. Replacing the matrix entry by one quarter of that
value yielded zero. These are observed results of the tested builds at the
numeric boundary. NAIF advises callers to keep intermediate arithmetic in range.
[VTMVG](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vtmvg_c.html)
[Full-component and boundary tests](../packages/py-parity-checking/test/general-matrices.test.ts)
[Public composition and IEEE observations](../packages/py-parity-checking/test/general-matrix-public.test.ts)

Focused execution passed all 120 registered Node/WASM comparisons, 11
supplementary oracle/public tests, 19 native domain tests and 42 real WASM
heap tests. The native suite includes two compiled-addon tests. The WASM suite
covers 31 allocation faults, eight successes with owned results, and three
sentinel or validation tests. Every scientific fixture consists of
repository-authored literal inputs and requires no kernels. The stacked branch
has 185 implemented routines and 1,251 registered scenarios. Full required
lanes and canonical CI are tracked by source fingerprint.
[Native domain suite](../packages/backend-node/test/general-matrices-domain.test.ts)
[WASM allocation suite](../packages/backend-wasm/test/general-matrices-allocations.test.ts)

A headless Chrome inline Web Worker fetched the real WASM URL and exercised
all eight public operations. It checked the rectangular products, transpose,
both vector directions, a bilinear result of −506, an empty contraction,
invalid-shape rejection and a clear failure flag. The first attempt used a
415-byte TypeScript-only worker stub and timed out. The normal facade build
regenerated the combined worker, after which the same smoke test passed.
