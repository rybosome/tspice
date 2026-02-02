# `docs/`

This directory contains repository documentation that’s meant to be **stable**, **linkable**, and **low-duplication**.

If you’re adding a new README for a package/app, start with the conventions + template below.

## Start here

- **How to be effective in this repo:** [`how-to-be-effective.md`](./how-to-be-effective.md)
- README conventions: [`readme-conventions.md`](./readme-conventions.md)
- README template: [`README_TEMPLATE.md`](./README_TEMPLATE.md)

## CSPICE / NAIF policy & disclosure

These are the canonical docs for compliance / redistribution concerns:

- Disclosure text + NAIF links: [`cspice-naif-disclosure.md`](./cspice-naif-disclosure.md)
- Project policy / interpretation: [`cspice-policy.md`](./cspice-policy.md)

Related repo-level files:

- Third-party notices: [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)
- Backend notices:
  - Node backend: [`../packages/backend-node/NOTICE`](../packages/backend-node/NOTICE)
  - WASM backend: [`../packages/backend-wasm/NOTICE`](../packages/backend-wasm/NOTICE)

## Architecture docs (mostly live with the code)

Most architecture and developer-facing details are in the package READMEs:

- Public API facade: [`../packages/tspice/README.md`](../packages/tspice/README.md)
- Backend contract + types: [`../packages/backend-contract/README.md`](../packages/backend-contract/README.md)
- Native backend: [`../packages/backend-node/README.md`](../packages/backend-node/README.md)
- WASM backend: [`../packages/backend-wasm/README.md`](../packages/backend-wasm/README.md)

## Images

`docs/images/` holds images used by the repo root README (and other docs).
