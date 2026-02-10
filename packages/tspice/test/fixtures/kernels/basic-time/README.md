# basic-time fixture pack

This directory is a small, self-contained SPICE **fixture pack** for tests.

## Contents

- `basic-time.tm` — meta-kernel that loads this pack
- `naif0012.tls` — NAIF leapseconds (LSK)

## Provenance

- `naif0012.tls`
  - Source: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls
  - Notes: NAIF "generic kernels" are publicly distributed for use with SPICE.

## sha256

- `basic-time.tm`: `10edd6044022a7f83eb33986865364e4a7e69dc53f837644b56ee2f55ee90779`
- `naif0012.tls`: `678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b`

## License-ish note

These kernels are redistributed here only for testing/verification convenience. They were downloaded from NAIF's public servers.
