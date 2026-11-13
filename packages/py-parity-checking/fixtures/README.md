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
