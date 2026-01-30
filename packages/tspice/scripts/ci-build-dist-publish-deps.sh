#!/usr/bin/env bash
set -euo pipefail

# This script exists to keep .github/workflows/ci.yml readable and to ensure
# the verify-dist-publish job only builds the minimal set of dependencies.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../../.." >/dev/null 2>&1 && pwd)

cd "$REPO_ROOT"

pnpm -w turbo run build \
  --filter=@rybosome/tspice \
  --filter=@rybosome/tspice-core \
  --filter=@rybosome/tspice-backend-contract \
  --filter=@rybosome/tspice-backend-fake \
  --filter=@rybosome/tspice-backend-wasm \
  --filter=@rybosome/tspice-backend-node
