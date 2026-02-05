// Shared render-layer constants.
//
// `THREE.Layers` uses bitmasks; we use small integers as layer indices.
//
// Use a high, reserved index to avoid collisions with other app layers (layer
// 0 is the default, and lower indices are often used for ad-hoc experiments).
export const SUN_BLOOM_LAYER = 20
