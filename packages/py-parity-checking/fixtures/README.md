# Fixture provenance

`fixtures/kernels` in this package is self-contained by design.

- Copied from `packages/tspice/test/fixtures/kernels`:
  - `naif0012.tls`
  - `kernel-pool-parity.tpc`
  - `pck00010.tpc`
  - `de440s.bsp`
  - `apophis_g_25000mm_rad_obj_0000n00000_v001.bds`
  - `file-io-minimal.bsp` (from `frames-minimal/earthstns_itrf93_201023.bsp`)
  - `file-io-minimal.bds` (from `dsk-minimal/apophis_g_25000mm_rad_obj_0000n00000_v001.bds`)
- Copied from `packages/tspice/test/fixtures/kernels/mgs-minimal`:
  - `mgs_sclkscet_00061.tsc`
  - `mgs_hga_hinge_v2.bc`
- Added package-local fixed EK fixture:
  - `py-parity-minimal.ek`
- Added package-local ids-names fixture:
  - `ids-names-body399-vars.tpc`

The EK fixture is generated once via SpiceyPy tooling and checked in. Tests that exercise file-creation routines may generate scratch DLA/DSK outputs under `fixtures/kernels/generated/`; these are ignored and are not input fixtures.

`kplfrm-minimal.tf` is an existing project-authored synthetic frame definition for `TSPICE_PARITY_TOPO` relative to J2000. It contains an arbitrary test frame ID and fixed rotation angles, with no mission observations or external scientific dataset. The kplfrm audit reuses this unchanged fixture; it introduces no new kernel data.

### Synthetic surface-geometry audit fixtures

`generate-audit-geometry.py`, run with locked SpiceyPy/CSPICE N0067, creates
`audit-geometry.tf` (1273 bytes), `audit-geometry.bsp` (4096 bytes), and
`audit-geometry.bds` (8192 bytes). The FK contains arbitrary body/frame IDs,
fixed orientations and invented radii; seven SPK segments contain exclusively
constant/linear authored states; the DSK is an outward-oriented eight-triangle
octahedron. These inputs contain no mission observations or external scientific
dataset and are distributed under the repository's MIT license. The generator
independently verifies analytic ellipsoid/plate radial intersections and literal
total/annular occultation codes. Angle tests use triangle-interior points to
avoid the undefined normals at DSK ridges/vertices. Canonical plane case inputs
are serialized results of actual locked SpiceyPy NVC2PL, with no kernel data.
