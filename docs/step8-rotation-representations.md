# Rotation representations

A14 is stacked on A12’s fixed-matrix branch at
`a1127d866930e7e3be177d4fceee94a3a220b5c0`. It uses the same owned
row-major Mat3 result representation, which retains all toolkit double
outputs. Matrix inputs still require finite entries. The raw quaternion
is a four-number tuple in SPICE scalar-first order [w,x,y,z].
[A12 pull request](https://github.com/rybosome/tspice/pull/712)

| Method   | Scientific convention                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eul2m`  | Compose the three coordinate rotations in angle3, angle2, angle1 order, with matching numbered axes 1–3. All angle arguments are radians. Repetition is permitted. |
| `m2eul`  | Return three named radian angles for the requested axis order. Axis2 must differ from both neighbors. At nonunique decompositions angle3 is zero.                  |
| `m2q`    | Return a unit SPICE quaternion for the supplied rotation. Its scalar component is nonnegative. Check the actual selected representative at half turns.             |
| `q2m`    | Convert a scalar-first quaternion to a rotation. Ordinary nonzero scaling and sign reversal preserve the rotation. A zero quaternion returns identity.             |
| `qxq`    | Return the unnormalized Hamilton product q1 times q2. Swapping operands can reverse the sign of the cross-product component.                                       |
| `qdq2av` | Normalize q, conjugate it, multiply by dq and return −2 times the product’s vector part. The angular velocity is in radians per derivative-time unit.              |
| `raxisa` | Return an owned axis vector and an angle in [0,π]. Identity yields [0,0,1] and angle zero. A half turn admits either mathematical axis sign.                       |

For `m2eul`, the outer angles lie in (−π,π]. The middle angle lies in
[0,π] for repeated outer axes and [−π/2,π/2] for three distinct axes.
The tests exercise coordinate orientation, both families and singular
configurations. Rejected rotations signal `SPICE(NOTAROTATION)` where
applicable. Illegal numbered axes and forbidden Euler decomposition
sequences signal `SPICE(BADAXISNUMBERS)`.
[NAIF Euler decomposition](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/m2eul_c.html)

## Defined Euler matrix output

N0067 `eul2m_c.c` calls SPICELIB EUL2M into a private matrix, then runs
`xpose_c` on it before returning. EUL2M can signal an invalid-axis
error before filling that matrix. The shared tspice wrapper invokes the
same linked `eul2m_` with initialized column-major storage for every
input. It preserves the public `eul2m_c` checkin and checkout trace
frame and checks toolkit status before transposing the successful output
into row-major elements. The six other operations use their corresponding
public C entrypoints.

The pinned `SpiceZfc.h` declares the three `doublereal*` angles, three
`integer*` axes and `doublereal*` output of `eul2m_`. The macOS arm64
N0067 archive defines both `_eul2m_` and `_eul2m_c` under Mach-O
symbol spelling. The independently loaded SpiceyPy library calls its
public wrapper for known-valid inputs and the initialized SPICELIB
entrypoint for diagnostic cases. The mapping policy requires the actual
external scientific call and both outer trace calls.
[Scientific source route](../packages/backend-shim-c/src/domains/coords_vectors.c)
[Independent Euler oracle](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/rotation_oracle.py)

## Quaternion and matrix numerical behavior

The pinned quaternion-to-matrix routine computes squared components and
cross-products before multiplying by the reciprocal squared norm. Large
finite components can therefore overflow and produce NaN matrix entries.
Tiny finite inputs can lose their squared components to underflow and
return identity. The adapters preserve those actual entries through A12’s
owned result-branding helper. The contract represents the returned matrix
and the independent oracle observes every component.
[NAIF quaternion-to-matrix routine](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/q2m_c.html)
[Matrix result branding](../packages/core/src/spice-runtime/shared/mat3.ts)

The 41 registered workflows make 124 calls to these seven methods, with
11 expected toolkit-error outcomes. Focused public tests reconstruct
rotations from each representation and compare the Euler error’s short
message, long message and caller trace with the locked library. One
ordinary Euler result verifies that the independently typed linked route
agrees with the public wrapper.
[Public rotation and diagnostic checks](../packages/py-parity-checking/test/rotation-representations.test.ts)

The tagged numerical checks compare all components of seven actual
observations per backend. They include `q2m([1e200,0,1e200,0])`,
`q2m([1e-300,0,1e-300,0])`, and an ordinary-scale control. A large
Hamilton product produces infinite values, and the angular-velocity
conversion also retains overflow from scaling a large derivative. The
probe distinguishes infinities and NaN across the complete returned
shape. Signed zeros are treated as equal in this probe.
[Finite-input exceptional values](../packages/py-parity-checking/test/rotation-extremes.test.ts)

On the corrected Euler source, 82 registered comparisons, 22 native tests,
58 WASM tests and 6 public/oracle tests passed. All 24 inherited batch
fingerprints differ from the recorded A12 sources. The 664 earlier execution
observations remain historical in the combined review.
