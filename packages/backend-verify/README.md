# backend-verify (legacy parity path)

Parity execution is now owned by `packages/parity-checking`.

- Run parity via root `pnpm test:verify`.
- Direct package entrypoint: `pnpm -C packages/parity-checking test`.

This package remains as a compatibility shim during migration and should not be used as the parity owner.
