# Geometry quantities in CSPICE N0067

Three synchronous and worker-backed raw methods return angles in radians. Each takes a finite epoch in TDB seconds past J2000. The native addon holds the CSPICE process mutex through each call. The WASM adapter validates UTF-8 text, owns all per-call string and result buffers, and releases them on success, allocation failure and toolkit error.

| Method                                                                       | Measurement                                                                   | Fixture result at ET 0 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------: |
| `phaseq(et, target, illmn, observer, abcorr)`                                | Angle at the target between the illuminator and observer                      |    0.12458734013080974 |
| `lspcn(body, et, abcorr)`                                                    | Solar longitude from the ascending equinox in the instantaneous orbital plane |      2.071875507862086 |
| `trgsep(et, targ1, shape1, frame1, targ2, shape2, frame2, observer, abcorr)` | Center separation less the apparent angular radii of both targets             |   −0.17557087767604718 |

The first two values use body 100101 and geometric states. The phase uses the Sun and observer 100102. The third uses targets 100101 and 100103, two spheres and observer 100104.

## Scientific inputs and distinguishing observations

The repository-authored SPK contains seven linear or constant tracks covering −10,000 to +10,000 TDB seconds. All positions are in kilometres and velocities in km/s. The existing FK supplies synthetic radii. The new text PCK gives 100101 a north pole with right ascension 37° and declination 53°. The three fixtures are distributed under the repository MIT license. [Fixture provenance and regeneration](../packages/py-parity-checking/fixtures/README.md)

- **Phase.** Two sightlines at the target give exact zero and π for distinct collinear bodies. At ET 0, light-time correction changes the geometric phase by about 6.81×10⁻⁹ rad. Reception uses the target epoch displaced by target-to-observer light time for the illumination leg. A registered endpoint case exercises earlier SPK coverage. Tested errors include repeated bodies, missing translations, unavailable ephemerides and transmission corrections. [NAIF PHASEQ](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/phaseq_c.html)
- **Solar longitude.** The pole and heliocentric velocity/position define the equinox. Solar longitude moves from 1.92485875928 to 2.18967185132 rad between ET −8000 and +8000. The public test constructs that reference frame from the three-dimensional authored tracks. Changing the prime meridian leaves the longitude unchanged within round-off. A different pole can move it into the opposite quadrant. Geometric orbital-plane construction and the corrected Sun direction use distinct calls. [NAIF LSPCN](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lspcn_c.html)
- **Separation.** POINT uses the sightline to the center. SPHERE uses the greatest of the three positive radii and subtracts its apparent angular radius. For the mixed sphere/point fixture the geometric gap is `atan2(0.1 t,40) − asin(3/20)`. The tangent time is 60.68660849090083 TDB seconds. A millisecond on either side gives −2.4437509026×10⁻⁶ and +2.4437490900×10⁻⁶ rad. The contact value is zero to rounding. Tests cover center order, physical overlap, positive gaps, nonpositive radii, both required frame strings and observer on or inside a sphere. [NAIF TRGSEP](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/trgsep_c.html)

## Pinned implementation and independent oracle

N0067 `lspcn.c` reads intermediates after TIPBOD, SPKGEO and SPKEZR before checking their status. The adapter runs the same linked stages in the original order with initialized storage and status checks. TIPBOD supplies the north pole. SPKGEO, UCRSS and TWOVEC build the seasonal frame. SPKEZR supplies the corrected Sun vector. MXV and RECRAD give the solar longitude. The original body-name error text and outer trace are preserved, and the pinned public C entry still performs its early empty-body check. This scientific mapping is classified as composed on both backends. The independent locked library uses typed initialized preflight storage. After the prerequisites succeed, its public `sp.lspcn` supplies the actual comparison result. Expected error cases observe the first failed original stage or the original name diagnostic. The unchecked upstream error path is never executed. [Shared implementation](../packages/backend-shim-c/src/domains/geometry.c)

PHASEQ calls the pinned ZZBODS2C translation cache. On a name miss that cache can save an unspecified output code. The two real backends and the independent oracle resolve each name in initialized storage first and preserve the original error fields and calling trace on a miss. Established translations continue to the public PHASEQ routine for the full scientific result. TRGSEP’s argument strings are checked by the public C entry, including both frame strings. SpiceyPy 6.0.3 replaces both frames with `"NULL"`. The oracle binds the independent installed `trgsep_c` directly to preserve the caller's bytes, with double return type and one double plus eight string arguments. Empty frame cases observe `SPICE(EMPTYSTRING)`. Nonempty frame values do not change the result in N0067's two supported shape models. [Independent oracle](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/geometry_quantities_oracle.py)

An installed body mapping that rounds to signed minimum can reach an unrepresentable absolute value in the pinned body hash. PCK phase degrees are also converted to signed integers. Both adapters protect the supported domain before these operations. Boundary tests exercise guarded wrappers separately from ordinary toolkit errors. Well-formed UTF-8 arguments preserve all bytes, including non-ASCII frame names. Embedded NUL, unpaired surrogates and non-finite ET are rejected before dispatch. [Public regressions](../packages/py-parity-checking/test/geometry-quantities.test.ts)

## Validation

| Routine | Workflows | Workflow steps | Target calls | Expected terminal errors |
| ------- | --------: | -------------: | -----------: | -----------------------: |
| PHASEQ  |        17 |             57 |           37 |                       12 |
| LSPCN   |        15 |             92 |           37 |                        9 |
| TRGSEP  |        22 |             97 |           50 |                       15 |
| Total   |        54 |            246 |          124 |                       36 |

All 108 registered Node/WASM evaluations passed against locked SpiceyPy on macOS arm64. Eight supplementary public tests passed on the two backends. Seven Node tests include malformed return types, label/argument order, direct compiled addon validation, structured errors and recovery. Twenty-six WASM tests cover all twenty acquisition positions, three successes and three structured status/recovery profiles on the real heap. The existing scalar comparator uses absolute and relative tolerances of 10⁻¹². Public formula tests check absolute error below 2×10⁻¹³ rad and independently distinguish the sign of the gap around contact. The real Chrome inline worker compared all three quantities at two epochs, observed overlap and gap on either side of tangency, and recovered after missing orientation data. The complete required local lanes and inspected canonical CI are recorded separately in the maintained audit.

Generated WASM SHA-256 is `300e7d0e58c9df3706049d5051d5e349034ab71a530b3e9d65d22d0c3519ed4a`. The seasonal PCK SHA-256 is `bdf95bb20d551f756c448173658218a495b97d1762a7214672b4813ec84e90f6`. [Maintained audit](../data/parity-audits/e16-geometry-quantities.json)
