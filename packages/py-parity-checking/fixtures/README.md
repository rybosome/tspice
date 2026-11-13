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
- Added package-local authored synthetic clock:
  - `audit-two-partition.tsc`: two fields (256 ticks per major unit), two
    partitions sharing encoded tick 1023, and a linear TDB correlation. It models
    no real spacecraft or measurements; its constants were authored for these
    tests and are distributed under the repository license.
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

`audit-ephemeris-observer.bsp` (4096 bytes), created by
`generate-audit-spk-observer.py` with locked SpiceyPy, supplies a separate arbitrary
observer with distinct quadratic motion in all three axes. This synthetic
MIT-authored input makes light-time and stellar corrections distinguishable in
every returned component. It avoids subtracting identical Y/Z polynomials into
near-zero roundoff residuals; no numeric comparator tolerance is changed. It
contains no mission observations or external scientific dataset.

Step 7 kernel audit fixtures `audit-empty.tm` and `audit-partial-error.tpc` are
project-authored synthetic text, distributed under this repository's MIT license.
The empty meta-kernel has no child files; the malformed PCK deliberately assigns
a valid variable before a numeric parse error. It tests CSPICE's partial-load
semantics rather than assuming rollback. `kernel-pool-parity.tpc` now has actual
single-backslash data/text directives; the former doubled directives left its
claimed values outside the data section. Live cases read all three variables.
Supplemental meta-kernel tests generate bounded path-symbol templates in scratch
storage, reusing the unchanged LSK and 25 KiB SPK fixtures, and remove them in
`finally`. There are no new scientific observations or downloaded datasets.

