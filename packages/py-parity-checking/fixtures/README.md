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

### Step 7 authored frame utility fixture

`kernels/audit-frames.tf` is handwritten synthetic FK text under repository MIT.
Its arbitrary static negative frame ID, distinct class ID, center/body alias and
preferred-frame override distinguish every lookup field. A three-axis class5
Euler frame has arbitrary polynomial angles/rates and produces nonzero state
velocity derivatives at negative, zero and positive TDB epochs. No mission
observations or external data are included. The class-ID name is supplied for
the actual TK engine; NAME binding keys respect the32-byte kernel-pool limit.
Standalone tests verify literal metadata, load/unload state, complete inverse
state products and position finite differences independently of live parity.
