# CSPICE usage & distribution policy

This document describes how `tspice` uses and redistributes artifacts derived from the NAIF SPICE Toolkit (CSPICE).

The authoritative source for CSPICE redistribution and derived works is the NAIF “Rules Regarding Use of SPICE”:

- https://naif.jpl.nasa.gov/naif/rules.html

This policy is written to make the project’s intent explicit for contributors and downstream users.

## Key rules and how `tspice` applies them

### Prohibition on mirror-style redistribution

NAIF prohibits redistributing the SPICE Toolkit as an unmodified, stand-alone product, or acting as a mirror without prior written approval.

> “You may not redistribute the SPICE Toolkit as an unmodified, stand-alone product, or as from a mirror site, without prior written approval from the NAIF Manager.”

**Project constraint:** `tspice` must not become an alternative distribution channel for CSPICE as a stand-alone toolkit.

### Allowance for derived tools and third-party interfaces

NAIF explicitly permits including SPICE Toolkit modules (source and/or object form), documentation, and some SPICE programs as part of a package supporting a SPICE-based tool, including providing a new third-party interface.

> “It is entirely appropriate to include SPICE Toolkit modules (source and/or object form), documentation, and some SPICE programs as part of a package supporting a customer-built SPICE-based tool… This includes providing a new 3rd-party interface.”

**Project interpretation:** embedding CSPICE-derived components behind a higher-level TypeScript interface is an allowed use case, as long as CSPICE remains subordinate to the derived tool and is not packaged as a general-purpose toolkit.

## Project decision

`tspice` will:

- Distribute embedded, compiled CSPICE-derived components in:
  - native `.node` form (optional, platform-specific)
  - `.wasm` form (portable)
- Treat CSPICE strictly as an internal implementation dependency
- Expose only the project’s TypeScript API as the supported interface

The CSPICE toolkit is not presented, packaged, or documented as a stand-alone or reusable toolkit.

## Rationale

This approach is intended to remain consistent with the NAIF rules because:

- The distributed artifacts are object or transformed forms, not canonical CSPICE source distributions
- The embedded CSPICE components are not independently useful outside the project’s API
- The package should not reasonably be used as a substitute for obtaining CSPICE from NAIF
- The project constitutes a third-party interface, which NAIF explicitly permits

## Export control considerations

NAIF distributes SPICE worldwide and describes the toolkit as publicly available under U.S. export laws.

**Project position:**

- `tspice` does not include controlled data
- `tspice` does not include military-specific functionality
- Users remain responsible for compliance with export regulations applicable to their own use cases

## Required notices and disclosure

For the canonical disclosure text and pointers to backend-specific notices, see:

- [`docs/cspice-naif-disclosure.md`](./cspice-naif-disclosure.md)

For backend-specific authoritative redistribution details, see the backend package `NOTICE` files:

- [`packages/backend-node/NOTICE`](../packages/backend-node/NOTICE)
- [`packages/backend-wasm/NOTICE`](../packages/backend-wasm/NOTICE)

For repository-wide third-party notices, see:

- [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)

## Non-goals and explicit exclusions

This project does not aim to:

- Provide a drop-in CSPICE development kit
- Replace or mirror NAIF’s CSPICE distribution
- Support use of embedded CSPICE-derived components outside the `tspice` API
- Accept or distribute modified CSPICE source as a public toolkit
