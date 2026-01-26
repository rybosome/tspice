import type { Vec3Km } from '../spice/SpiceClient.js'

/**
* Precision strategy (Issue #68): **A — focus-origin rebasing ("floating origin")**.
*
* Why:
* - WebGL vertex coordinates are ultimately handled in 32-bit float space.
* - Solar-system-scale coordinates (e.g. ~1 AU in km) lose per-meter-ish detail when
*   represented directly as float32.
* - Rebasing all rendered positions around a chosen "focus" body keeps world-space
*   numbers near 0, improving effective precision for nearby bodies and camera ops.
*
* Implementation:
* - Fetch each body's position in km in a stable inertial frame (J2000) relative to a
*   stable observer (we use `SUN` in the fake backend).
* - Each frame/update, compute `rebasedKm = bodyPosKm - focusPosKm`.
* - Convert to renderer units with `kmToWorld` and assign to Three.js object positions.
*/

export function rebasePositionKm(bodyPosKm: Vec3Km, focusPosKm: Vec3Km): Vec3Km {
  return [
    bodyPosKm[0] - focusPosKm[0],
    bodyPosKm[1] - focusPosKm[1],
    bodyPosKm[2] - focusPosKm[2],
  ]
}
