# Observer-relative SPK geometry

Five raw ephemeris methods evaluate a target relative to an observer. Each returns an owned six-component `state` and a scalar one-way light time `lt` in seconds. The point coordinates and velocities supplied to the four Cartesian operations use km and km/s.

| Method   | Supplied point                                                             | Other endpoint | Output                                                |
| -------- | -------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| `spkcpo` | Observer fixed in its local frame                                          | Named target   | Target relative to the observer point                 |
| `spkcpt` | Target fixed in its local frame                                            | Named observer | Target point relative to the observer                 |
| `spkcvo` | Observer state at its own epoch, with constant velocity in its local frame | Named target   | Target relative to the moving observer                |
| `spkcvt` | Target state at its own epoch, with constant velocity in its local frame   | Named observer | Moving target relative to the observer                |
| `azlcpo` | Observer position fixed in a frame centered on its specified body          | Named target   | Topocentric range, azimuth, elevation and their rates |

## Frames and epochs

For Cartesian outputs, `OBSERVER` evaluates the output frame orientation at observer ET. `TARGET` uses the target epoch, ET minus the target light time for reception or ET plus that time for transmission. `CENTER` uses the frame center's corresponding signal time relative to the observer. With geometric `NONE`, all three loci use ET. The choice matters for a rotating output frame. A supplied position fixed in a rotating input frame also has inertial velocity. For a constant local velocity the toolkit propagates the supplied position from its own point epoch, then applies the frame state transform including the derivative of the orientation.

The authored `RELATIVE_SPIN` frame rotates about three axes and is centered on moving body 100002. In this frame the tests separate all three evaluation loci numerically, check the velocity by differentiating position, and independently apply `sxform` to the extrapolated geometric point. A fixed point agrees with the matching constant-velocity routine supplied a local velocity of zero. [Rotating frame fixture](../packages/py-parity-checking/fixtures/kernels/relative-observers.tf) [Public comparisons](../packages/py-parity-checking/test/spk-relative.test.ts)

## Local horizon coordinates

`azlcpo` returns range in km, azimuth and elevation in radians, then range rate in km/s and angular rates in rad/s. `azccw` selects counterclockwise azimuth and `elplsz` selects increasing elevation toward local +Z. For an off-axis ellipsoid site, local +Z follows the normal at the nearest surface point and local +X points along the projection of body-fixed north onto the tangent plane. On the body-fixed Z axis the toolkit uses its explicit north- or south-pole orientation. A vertical sight line can signal `POINTONZAXIS` during the angular-rate calculation. The tests compare every component for all four sign combinations and check rates by differentiating the corresponding range and angles. [Surface fixture generator](../packages/py-parity-checking/fixtures/generate-audit-geometry.py)

## Kernel dependence and scientific errors

All five methods bypass the optional transport result cache by default. Tests replace a target segment or a body-radius pool value on the same sync and async clients, repeat the identical query, restore the data and check the result. The adapters take a single snapshot of each input tuple and release their temporary storage on success and error. Finite maximal coordinates can produce infinite range or NaN state components during geometric extrapolation. A tagged independent comparison retains every component and the corresponding finite controls.

The shared shim checks original SPICELIB components before N0067 consumes output from a failed stellar-state or frame operation. It initializes the fixed or constant-velocity point callback under the same serialized toolkit state, checks the required observer velocity samples and evaluates the original light-time solution and stellar divisor. The target-point and observer-point branches use their respective toolkit routines. Local horizon construction checks the ellipsoid axes and nearest point, surface normal and local basis before using them. The successful result comes from the named public CSPICE entry in all five cases. The independent sidecar binds the corresponding checked prerequisites separately before asking the locked SpiceyPy wrapper to perform the successful calculation. Registered errors cover bad names, frame centers, frame loci, missing coverage, invalid options, invalid radii and a singular stellar derivative. A separate public test checks the caller trace and recovery. [Independent sidecar](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/relative_observer_oracle.py)

## Evidence

The batch has 79 workflows, 393 steps and 172 calls to the five new methods. Thirty-nine workflows end with an expected toolkit error. The two stellar target-error workflows create and close a type 8 moving-observer SPK in case-local scratch. The other orbits and the triaxial body model use project-authored fixtures. [SPK target generator](../packages/py-parity-checking/fixtures/generate-audit-spk.py) [Moving observer generator](../packages/py-parity-checking/fixtures/generate-audit-spk-observer.py)

On the rebuilt combined source all 158 new registered Node and WASM comparisons, 12 public tests, 16 native boundary tests and 50 WASM allocation and ownership tests passed. The inherited E08 suites also passed all 170 registered, 14 public, 25 native and 45 WASM checks. A real Chrome worker compared all five six-component states and light times to the independent library and recovered after a vertical sight line raised `POINTONZAXIS`. The final browser worker also interleaved an inherited SPKEZR call with a moving-point SPKCVO call, compared the complete results against independent plain and stellar corrections, and recovered from the blank-option diagnostic. The audit tracks full source-bound local and canonical CI evidence separately. [Routine records](../data/parity-audits/e09-spk-relative-observers.json)
