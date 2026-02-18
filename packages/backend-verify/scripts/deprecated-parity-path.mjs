#!/usr/bin/env node

console.warn(
  "[backend-verify] parity execution has moved to packages/parity-checking. " +
    "Use `pnpm test:verify` (root) or `pnpm -C packages/parity-checking test`.",
);
process.exit(0);
