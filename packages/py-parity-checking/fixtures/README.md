# Fixture provenance

`fixtures/kernels` in this package is self-contained by design.

- Copied from `packages/tspice/test/fixtures/kernels`:
  - `naif0012.tls`
  - `kernel-pool-parity.tpc`
  - `pck00010.tpc`
  - `de440s.bsp`
- Added package-local fixed EK fixture:
  - `py-parity-minimal.ek`

The EK fixture is generated once via SpiceyPy tooling and checked in so parity tests rely only on repository fixtures (no runtime fixture generation).
