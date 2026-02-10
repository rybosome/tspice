# frames-minimal fixture pack

This directory is a small, self-contained SPICE **fixture pack** for tests.

## Contents

- `frames-minimal.tm` — meta-kernel that loads this pack
- `earth_topo_201023.tf` — Earth topocentric station frame definitions (FK)
- `earthstns_itrf93_201023.bsp` — Earth station position ephemerides (SPK)

## Provenance

- `earth_topo_201023.tf`
  - Source: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/stations/earth_topo_201023.tf
- `earthstns_itrf93_201023.bsp`
  - Source: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/stations/earthstns_itrf93_201023.bsp

## sha256

- `frames-minimal.tm`: `7e1fb4f5825efccd39500091a4af17a25286616b0cedb3f9d4854f4d224ec36a`
- `earth_topo_201023.tf`: `85e32d0e226ab8cbce8cdcb4c0d3e259dcb10e372481af0989ddd63c523f2029`
- `earthstns_itrf93_201023.bsp`: `31a8cd1bed985fd15bf1a1cdd00416d0104e365e33672d746e704ef1b6157270`

## License-ish note

These kernels are redistributed here only for testing/verification convenience. They were downloaded from NAIF's public servers.
