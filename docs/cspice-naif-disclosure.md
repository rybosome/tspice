# CSPICE / NAIF disclosure

`tspice` includes or links against components derived from the NAIF CSPICE Toolkit to provide SPICE functionality behind its TypeScript API. It is not a general-purpose distribution of CSPICE.

The exact form of CSPICE-derived components varies by backend. For the authoritative backend-specific integration and redistribution details, see the backend package `NOTICE` files.

Use of CSPICE (including CSPICE-derived artifacts from this project) is subject to the NAIF rules linked below.

- NAIF rules: https://naif.jpl.nasa.gov/naif/rules.html
- Official NAIF toolkit download site: https://naif.jpl.nasa.gov/naif/toolkit.html

For third-party notices and additional details, see [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) and the backend package `NOTICE` files ([`packages/backend-node/NOTICE`](../packages/backend-node/NOTICE), [`packages/backend-wasm/NOTICE`](../packages/backend-wasm/NOTICE)).
