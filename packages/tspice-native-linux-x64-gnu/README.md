# @rybosome/tspice-native-linux-x64-gnu

## Overview

Platform-specific package that points to a prebuilt `tspice` Node native addon (`tspice_backend_node.node`) for **Linux / x64 (glibc)**.

This is not meant to be imported directly by most users.

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](https://github.com/rybosome/tspice/blob/main/docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

This package ships with a `NOTICE` file (see `NOTICE` in the installed package). For easy viewing on GitHub, see [`packages/tspice-native-linux-x64-gnu/NOTICE`](https://github.com/rybosome/tspice/blob/main/packages/tspice-native-linux-x64-gnu/NOTICE).

## Purpose / Why this exists

This package exists so package managers can install the correct prebuilt native addon for the current platform.

**Who should touch this:** generally only release / native-backend maintainers. This package is primarily a thin wrapper around a platform build artifact.

## How it fits into `tspice`

- `@rybosome/tspice` declares this as an `optionalDependency`, and package managers will only attempt to install it on matching platforms (`os: ["linux"]`, `cpu: ["x64"]`). This package is intended for **glibc-based** Linux distros.
- `@rybosome/tspice-backend-node` attempts to `require()` this package (based on `process.platform`/`process.arch`) and uses its exported `bindingPath` to locate the `.node` file.

Relevant code:

- [`packages/backend-node/src/runtime/addon.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/runtime/addon.ts)
- [`packages/tspice/package.json`](https://github.com/rybosome/tspice/blob/main/packages/tspice/package.json) (see `optionalDependencies`)

## Installation

You typically don’t install this directly; it’s pulled in automatically when you install `@rybosome/tspice` on a supported platform.

## Usage (Quickstart)

Direct usage is mainly useful for debugging:

```js
const { bindingPath } = require("@rybosome/tspice-native-linux-x64-gnu");
console.log(bindingPath);
```

## API surface

- `bindingPath: string` (absolute path to `tspice_backend_node.node` within this package)

## Development

There are no build scripts in this package.

If you’re working on the native addon itself, see [`@rybosome/tspice-backend-node`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/README.md) and build it from the repo root:

https://github.com/rybosome/tspice/blob/main/packages/backend-node/README.md

```bash
pnpm --filter @rybosome/tspice-backend-node run build:native
```

## Troubleshooting / FAQ

### “`tspice_backend_node.node` not found next to `index.js`”

This package is only useful when `tspice_backend_node.node` is present (it should be included in the published package).
