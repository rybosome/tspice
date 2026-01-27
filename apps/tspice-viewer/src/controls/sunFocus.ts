import * as THREE from 'three'

export function isDirectionWithinFov(opts: {
  /** Normalized direction the camera is looking (camera -> target). */
  cameraForwardDir: THREE.Vector3
  /** Normalized direction from target -> point. */
  dirToPoint: THREE.Vector3
  cameraFovDeg: number
  cameraAspect: number
  /** Margin to ensure the point isn't sitting right on the edge. */
  marginRad?: number
}): boolean {
  const marginRad = opts.marginRad ?? THREE.MathUtils.degToRad(2)

  const halfV = THREE.MathUtils.degToRad(opts.cameraFovDeg) / 2
  const halfH = Math.atan(Math.tan(halfV) * (opts.cameraAspect || 1))
  const half = Math.min(halfV, halfH)

  const angle = opts.cameraForwardDir.angleTo(opts.dirToPoint)
  return angle <= half - marginRad
}

export function computeOrbitAnglesToKeepPointInView(opts: {
  /** Point position relative to the orbit target (in world units). */
  pointWorld: THREE.Vector3
  cameraFovDeg: number
  cameraAspect: number
  /** Preferred offset of the point from screen center. */
  desiredOffAxisRad?: number
  /** Margin from the edge of the view. */
  marginRad?: number
  /**
   * Defines what “up” means for selecting a stable roll/tilt direction.
   * (This does not change the actual camera.up; it just picks a deterministic side.)
   */
  worldUp?: THREE.Vector3
}): { yaw: number; pitch: number } | null {
  const eps = 1e-12

  const dirToPoint = opts.pointWorld.clone()
  if (dirToPoint.lengthSq() < eps) return null
  dirToPoint.normalize()

  const marginRad = opts.marginRad ?? THREE.MathUtils.degToRad(2)

  const halfV = THREE.MathUtils.degToRad(opts.cameraFovDeg) / 2
  const halfH = Math.atan(Math.tan(halfV) * (opts.cameraAspect || 1))
  const half = Math.min(halfV, halfH)
  const maxOffAxis = Math.max(0, half - marginRad)
  if (maxOffAxis <= 0) return null

  const desiredOffAxisRad = opts.desiredOffAxisRad ?? THREE.MathUtils.degToRad(14)

  // Keep the point comfortably inside view. Also keep a non-trivial offset so
  // the point isn't directly behind the focus body.
  const offAxis = THREE.MathUtils.clamp(
    desiredOffAxisRad,
    THREE.MathUtils.degToRad(6),
    maxOffAxis * 0.8
  )

  const worldUp = opts.worldUp ?? new THREE.Vector3(0, 1, 0)

  let axis = new THREE.Vector3().crossVectors(dirToPoint, worldUp)
  if (axis.lengthSq() < eps) {
    // Point direction is parallel to our up vector; pick an arbitrary stable axis.
    axis = new THREE.Vector3(1, 0, 0)
  } else {
    axis.normalize()
  }

  // We want the camera's forward direction to be close to `dirToPoint`, but not
  // perfectly aligned. That keeps the Sun visible without putting it directly
  // behind the focused body.
  const forwardA = dirToPoint.clone().applyAxisAngle(axis, offAxis)
  const forwardB = dirToPoint.clone().applyAxisAngle(axis, -offAxis)

  // Prefer whichever solution looks “from above” (positive worldUp dot) for
  // stability and nicer default views.
  const forward = forwardA.dot(worldUp) >= forwardB.dot(worldUp) ? forwardA : forwardB

  // CameraController stores yaw/pitch for the offset direction (target -> camera).
  const offsetDir = forward.multiplyScalar(-1)

  const yaw = Math.atan2(offsetDir.z, offsetDir.x)
  const pitch = Math.asin(THREE.MathUtils.clamp(offsetDir.y, -1, 1))

  return { yaw, pitch }
}
