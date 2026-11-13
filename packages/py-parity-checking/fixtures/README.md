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

### Synthetic SPK audit fixtures

`generate-audit-spk.py`, executed with the locked SpiceyPy sidecar, creates
`audit-ephemeris.bsp` (5120 bytes), `audit-ephemeris-priority.bsp` (4096 bytes),
and `audit-ephemeris-empty.bsp` (3048 bytes). These contain only project-authored
polynomial states, arbitrary signed object/center IDs, explicit TDB-second bounds,
coverage gaps and a competing segment. They contain no mission observations or
external scientific dataset and are distributed under the repository's MIT
license. The generator independently checks complete IDs, intervals, state values,
segment metadata and load-order priority. The empty file is a valid DAF/SPK with
no arrays, closed through SpiceyPy's DAF close solely during fixture generation.
Writer parity cases independently create their own scratch files through the
actual raw writer and actual SpiceyPy writer; the checked-in inputs are not
substitutes for observing those newly written files.
