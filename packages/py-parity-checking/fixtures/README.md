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

The Step 7 file-reader fixtures `audit-two-segment.bsp` (4096 bytes) and
`audit-empty-daf.bsp` (3048 bytes) are project-authored synthetic DAF/SPK data,
MIT-licensed with the repository. `generate-audit-daf.py` generates and validates
them using the locked SpiceyPy 6.0.3/CSPICE N0067 sidecar. The two segments use
invented body IDs 9100001/9100002, J2000, and small linear state samples at ET
0–2 and 10–12. No external observations are incorporated. The empty DAF is
closed via `dafcls`; `spkcls` intentionally requires at least one segment.

From the repository root, regenerate in a task-owned directory with:

```bash
uv run --locked --project packages/py-parity-checking/sidecars/spiceypy python packages/py-parity-checking/fixtures/generate-audit-daf.py /tmp/tspice-authored-daf
```

Reader scenarios create empty DLA outputs only under case-scoped scratch refs.
Both execution paths close outstanding file handles before removing scratch,
including workflow failures. Backend-owned staged inputs are cleared/disposed
by the existing case lifecycle. The unchanged existing DSK fixture supplies a
real eight-field DLA descriptor for comparison; no new scientific dataset is
added.

### Step7 authored DSK query fixtures

`kernels/audit-empty-dsk.bds` (3072 bytes) and
`kernels/audit-multi-dsk.bds` (11264 bytes) are project-authored synthetic data
under this repository's MIT license. The checked-in `generate-audit-dsk.py` uses
locked SpiceyPy6.0.3/CSPICE N0067 to create and read back an empty DSK and four
invented tetrahedron segments with body/surface pairs (399,71), (399,72),
(499,73), (399,71). Vertices, plates, bounds and epochs are invented constants;
these contain no observations and use no external scientific data. Duplicate
segments distinguish set unions and temporary capacity before deduplication.
Regenerate from this package using the command in the script docstring.

### Step 7 authored EK lifecycle fixtures

`kernels/audit-tables-one.ek` (32,768 bytes) and
`kernels/audit-tables-two.ek` (23,552 bytes) are authored MIT synthetic data, generated
and independently read back by `generate-audit-ek.py` using locked SpiceyPy 6.0.3/
CSPICE_N0067. Invented scalar integer rows populate three/two physical segments
with shared AUDIT_SHARED and distinct AUDIT_ALPHA/AUDIT_BETA table names. There
are no external observations. Duplicate logical table names distinguish segment
counts from loaded-table counts. Regeneration is documented in the script.

### Step 7 authored EK column/query fixture

`kernels/audit-query.ek` (25,600 bytes) is a project-authored synthetic seven-column,
three-row table, generated by `generate-audit-ek-query.py` with locked SpiceyPy
6.0.3 / CSPICE N0067. It contains arbitrary keys, fixed/variable vectors, SQL NULLs,
integer limits and a 1,024-character literal. The generator checks actual long
string/numeric/NULL outputs. No external observations or datasets are included;
the fixture and generator are distributed under the repository MIT license.
Creation workflows additionally write disposable scratch files on each backend.

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

The CK audit adds exclusively project-authored synthetic fixtures under the
repository MIT license: `audit-pointing.bc`, `audit-pointing-priority.bc`,
`audit-pointing-empty.bc`, and `audit-ck-clock.tsc`. `generate-audit-ck.py` writes
Type3 CKs using the locked SpiceyPy writer. Arbitrary signed instruments, quaternion
angles, constant rates, interpolation gaps and competing priority segments contain
no mission observations or external scientific dataset. The empty CK contains a
DAF header with no segments. The handwritten clock makes encoded1000ticks equal
ET0 and one tick equal one TDB second; no leap-second data is needed. Generator
assertions check actual complete coverage/IDs/clock, pointing/AV and the physical
state derivative. Binary fixtures are generated inputs, never hand edited. These
small authored data are distributable as MIT test material; provenance is explicit
for the repository's normal maintainer fixture review.

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

### GF analytic search fixtures

The GF audit reuses the exact MIT-authored `audit-geometry.tf`,
`audit-geometry.bsp`, `audit-geometry.bds` and `generate-audit-geometry.py`
from the geometry audit (#704). Arbitrary body IDs, invented radii and linear
ephemerides contain no mission observations or external scientific data.
Only the FK/SPK are loaded for GF; the DSK accompanies the reproducible generator.
Distance roots follow a quadratic norm; point separation follows an arctangent.
Fresh-process tests compare actual reporter stdout and persistent GF settings
against locked SpiceyPy, with no scientific operation replaced by a formula.

`kernels/surface-translation.tpc` is an authored test fixture under the
repository license. Its surface IDs and names are artificial. Two body IDs
exercise independent namespaces, alternate spellings and numeric-name precedence;
it contains no shape or observational data.
