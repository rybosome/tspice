# @rybosome/tspice-native-darwin-x64

## Overview

Platform-specific package that points to a prebuilt `tspice` Node native addon (`tspice_backend_node.node`) for **macOS (darwin) / x64**.

This is not meant to be imported directly by most users.

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](../../docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

See [`NOTICE`](./NOTICE) in this package for authoritative licensing and redistribution information.

## Purpose / Why this exists

This package exists so package managers can install the correct prebuilt native addon for the current platform.

**Who should touch this:** generally only release / native-backend maintainers. This package is primarily a thin wrapper around a platform build artifact.

## How it fits into `tspice`

- `@rybosome/tspice` declares this as an `optionalDependency`, and npm/pnpm will only install it on matching platforms (`os: ["darwin"]`, `cpu: ["x64"]`).
- `@rybosome/tspice-backend-node` attempts to `require()` this package (based on `process.platform`/`process.arch`) and uses its exported `bindingPath` to locate the `.node` file.

Relevant code:

- `packages/backend-node/src/runtime/addon.ts`
- `packages/tspice/package.json` (`optionalDependencies`)

## Installation

You typically don’t install this directly; it’s pulled in automatically when you install `@rybosome/tspice` on a supported platform.

## Usage (Quickstart)

Direct usage is mainly useful for debugging:

```js
const { bindingPath } = require("@rybosome/tspice-native-darwin-x64");
console.log(bindingPath);
```

## API surface

- `bindingPath: string` (absolute path to `tspice_backend_node.node` within this package)

## Development

There are no build scripts in this package.

If you’re working on the native addon itself, see [`@rybosome/tspice-backend-node`](../backend-node/README.md) and build it from the repo root:

```bash
pnpm --filter @rybosome/tspice-backend-node run build:native
```

## Troubleshooting / FAQ

### “`tspice_backend_node.node` not found next to `index.js`”

This package is only useful when `tspice_backend_node.node` is present (it should be included in the published package).
