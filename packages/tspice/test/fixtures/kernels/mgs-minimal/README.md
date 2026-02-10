# mgs-minimal fixture pack

This directory is a small, self-contained SPICE **fixture pack** for tests that need an MGS CK + SCLK.

## Contents

- `mgs-minimal.tm` — meta-kernel that loads this pack
- `mgs_hga_hinge_v2.bc` — MGS CK (HGA hinge orientation)
- `mgs_sclkscet_00061.tsc` — MGS SCLK

## Provenance

These kernels were downloaded from the NAIF-hosted PDS archive for the MGS SPICE kernel set:

- `mgs_hga_hinge_v2.bc`
  - Source: https://naif.jpl.nasa.gov/pub/naif/pds/data/mgs-m-spice-6-v1.0/mgsp_1000/data/ck/mgs_hga_hinge_v2.bc
- `mgs_sclkscet_00061.tsc`
  - Source: https://naif.jpl.nasa.gov/pub/naif/pds/data/mgs-m-spice-6-v1.0/mgsp_1000/data/sclk/mgs_sclkscet_00061.tsc

## sha256

- `mgs-minimal.tm`: `51c1b8fb37506f5148c8e5646ff54549d623a87cd3ec2deb717614fd80c2dc80`
- `mgs_hga_hinge_v2.bc`: `c105b6e1058e2718280a411544d0546880741446b3da5dd7a431b3013bfdd2cd`
- `mgs_sclkscet_00061.tsc`: `ac8e7b07e21d32b2316030ef22c9f3ab4bdd9e4cdf233974bbc019ee4c319123`

## License-ish note

These kernels are redistributed here only for testing/verification convenience. They were downloaded from NAIF's public servers.
