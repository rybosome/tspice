import { METHOD_SURFACE_REGISTRY } from "./methodSurfaceRegistry.js";

import type { MethodSurfaceEntry } from "./methodSurfaceRegistry.js";

/** Return the canonical v3 parity method surface registry entries. */
export function readMethodSurfaceRegistry(): MethodSurfaceEntry[] {
  return METHOD_SURFACE_REGISTRY.map((entry) => ({ ...entry }));
}
