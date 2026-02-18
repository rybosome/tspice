# ephemeris-de440s kernel fixture pack

Deterministic SPICE kernels used by parity scenarios (SPK read/query APIs).

## Contents

- `ephemeris-de440s.tm` (meta-kernel)
- `de440s.bsp`
  - NAIF generic planetary ephemeris (DE440S)
  - Type: SPK
- `pck00010.tpc`
  - NAIF generic planetary constants kernel
  - Type: text PCK

## Provenance

Downloaded from NAIF public "generic_kernels":

- `pck00010.tpc`
  - https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc
- `de440s.bsp`
  - https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp

## sha256

- `pck00010.tpc`: `59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2`
- `de440s.bsp`: `c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2`
