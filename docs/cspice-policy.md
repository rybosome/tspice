# CSPICE usage & distribution policy

This document describes how `tspice` uses and redistributes artifacts derived from the NAIF SPICE Toolkit (CSPICE).

The authoritative source for CSPICE redistribution and derived works is the NAIF “Rules Regarding Use of SPICE”:

- https://naif.jpl.nasa.gov/naif/rules.html

Last checked: 2026-01-16

This policy is written to make the project’s intent explicit for contributors and downstream users.

This document is an internal project interpretation of the NAIF rules and is not a legal restatement. In any conflict, the NAIF rules remain authoritative.

Maintainers should revisit this policy whenever CSPICE packaging or embedding strategies change (for example, new artifact formats or redistribution patterns).

## Key rules and how `tspice` applies them

### Prohibition on mirror-style redistribution

NAIF prohibits redistributing the SPICE Toolkit as an unmodified, stand-alone product, or acting as a mirror without prior written approval.

> “You may not redistribute the SPICE Toolkit as an unmodified, stand-alone product, or as from a mirror site, without prior written approval from the NAIF Manager.”

**Project constraint:** `tspice` must not become an alternative distribution channel for CSPICE as a stand-alone toolkit.

### Allowance for derived tools and third-party interfaces

NAIF explicitly permits including SPICE Toolkit modules (source and/or object form), documentation, and some SPICE programs as part of a package supporting a SPICE-based tool, including providing a new third-party interface.

> “It is entirely appropriate to include SPICE Toolkit modules (source and/or object form), documentation, and some SPICE programs as part of a package supporting a customer-built SPICE-based tool… This includes providing a new 3rd-party interface.”

**Project interpretation:** this project is operated under the assumption that embedding CSPICE-derived components behind a higher-level TypeScript interface is within the type of use cases that NAIF’s rules intend to allow, provided CSPICE remains subordinate to the derived tool and is not packaged as a general-purpose toolkit.

## Project policy

`tspice` is intended to:

- Distribute embedded, compiled or otherwise transformed CSPICE-derived components in:
  - native `.node` form (optional, platform-specific)
  - `.wasm` form (portable)
- Not distribute canonical or unmodified CSPICE source or toolkit archives as part of any published artifact
- Treat CSPICE strictly as an internal implementation dependency
- Expose only the project’s TypeScript API as the supported interface

The CSPICE toolkit is not presented, packaged, or documented as a stand-alone or reusable toolkit.

## Contributor constraints

To maintain alignment with the NAIF rules above, contributors must not:

- Add raw or unmodified CSPICE toolkit archives/sources as published artifacts of this repo
- Add API surfaces or documentation intended to expose CSPICE as a general-purpose toolkit outside the `tspice` TypeScript interface

## Intended downstream usage

This project is intended to be used as a dependency in applications and services that need SPICE functionality via the `tspice` TypeScript API.

If you need CSPICE itself as a general-purpose toolkit, obtain it directly from NAIF.

## Rationale

This approach is intended to remain consistent with the NAIF rules because:

- The distributed artifacts are object or transformed forms, not canonical CSPICE source distributions
- The embedded CSPICE components are not independently useful outside the project’s API
- The package should not reasonably be used as a substitute for obtaining CSPICE from NAIF
- The project constitutes a third-party interface, which NAIF explicitly permits

## Export control considerations

NAIF distributes SPICE worldwide and describes the toolkit as publicly available under U.S. export laws.

**Project position (subject to periodic review):**

- `tspice` is intended not to include controlled data
- `tspice` is intended not to include military-specific functionality
- Users remain responsible for compliance with export regulations applicable to their own use cases

When adding kernels, datasets, or example data:

- PR authors should explicitly mention export control considerations in the PR description
- Maintainers should verify and document export control considerations during review
- Maintainers should ensure contributor docs and PR templates include an explicit reminder to flag export control considerations

Maintainers should re-evaluate this section if adding new datasets, kernels, or example data.

## Required notices and disclosure

For the canonical disclosure text and pointers to backend-specific notices, see:

- [`docs/cspice-naif-disclosure.md`](./cspice-naif-disclosure.md)

For backend-specific authoritative redistribution details, see the backend package `NOTICE` files:

- [`packages/backend-node/NOTICE`](../packages/backend-node/NOTICE)
- [`packages/backend-wasm/NOTICE`](../packages/backend-wasm/NOTICE)

For repository-wide third-party notices, see:

- [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)

## Non-goals and explicit exclusions

The following non-goals are chosen specifically to stay within NAIF’s rules regarding redistribution and third-party interfaces.

This project does not aim to:

- Provide a drop-in CSPICE development kit
- Replace or mirror NAIF’s CSPICE distribution
- Support use of embedded CSPICE-derived components outside the `tspice` API
- Accept or distribute modified CSPICE source as a public toolkit

Relaxing these non-goals would require re-evaluating compliance with the NAIF “Rules Regarding Use of SPICE”.

## Maintenance

- Re-check the NAIF rules when changing CSPICE packaging/embedding strategies, and periodically to detect policy drift.
- When moving or renaming any referenced notice or disclosure files, update the links in this document in the same PR.
