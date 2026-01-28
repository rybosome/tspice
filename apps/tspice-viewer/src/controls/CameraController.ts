import * as THREE from 'three'

export type CameraControllerState = {
  target: THREE.Vector3
  radius: number
  yaw: number
  pitch: number
  // Free-look offset state
  lookYaw: number
  lookPitch: number
  lookRoll: number
}

export class CameraController {
  target: THREE.Vector3
  radius: number
  yaw: number
  pitch: number

  // Free-look offset (applied AFTER lookAt)
  lookYaw: number = 0
  lookPitch: number = 0
  lookRoll: number = 0

  readonly minRadius: number
  readonly maxRadius: number
  private readonly minPitch: number
  private readonly maxPitch: number

  // Clamp free-look pitch to avoid flipping
  private readonly minLookPitch: number = -Math.PI / 2 + 0.01
  private readonly maxLookPitch: number = Math.PI / 2 - 0.01

  constructor(
    state: CameraControllerState,
    opts?: {
      minRadius?: number
      maxRadius?: number
      minPitch?: number
      maxPitch?: number
    }
  ) {
    this.target = state.target
    this.radius = state.radius
    this.yaw = state.yaw
    this.pitch = state.pitch
    this.lookYaw = state.lookYaw ?? 0
    this.lookPitch = state.lookPitch ?? 0
    this.lookRoll = state.lookRoll ?? 0

    // Default zoom limits. These are intentionally wide so:
    // - small bodies like Mercury can fill the view when zoomed in
    // - the full solar system can fit comfortably when zoomed out
    this.minRadius = opts?.minRadius ?? 0.005
    this.maxRadius = opts?.maxRadius ?? 500

    // Keep pitch away from the poles so orbit math stays stable.
    this.minPitch = opts?.minPitch ?? (-Math.PI / 2 + 0.01)
    this.maxPitch = opts?.maxPitch ?? (Math.PI / 2 - 0.01)

    this.clampState()
  }

  static fromCamera(camera: THREE.Camera, target = new THREE.Vector3(0, 0, 0)) {
    const offset = camera.position.clone().sub(target)
    const radius = offset.length() || 1

    // Z-up orbit:
    // - yaw: azimuth around +Z axis, 0 at +X
    // - pitch: elevation from the XY plane toward +Z
    const yaw = Math.atan2(offset.y, offset.x)
    const pitch = Math.asin(THREE.MathUtils.clamp(offset.z / radius, -1, 1))

    return new CameraController({ target, radius, yaw, pitch, lookYaw: 0, lookPitch: 0, lookRoll: 0 })
  }

  clampState() {
    this.radius = THREE.MathUtils.clamp(this.radius, this.minRadius, this.maxRadius)
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch)
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch, this.minLookPitch, this.maxLookPitch)
  }

  applyToCamera(camera: THREE.Camera) {
    this.clampState()

    const cosPitch = Math.cos(this.pitch)

    const offset = new THREE.Vector3(
      this.radius * cosPitch * Math.cos(this.yaw),
      this.radius * cosPitch * Math.sin(this.yaw),
      this.radius * Math.sin(this.pitch)
    )

    camera.position.copy(this.target).add(offset)
    camera.lookAt(this.target)

    // Apply free-look offset (yaw/pitch/roll) to camera quaternion
    // Order: yaw (Y in camera space) -> pitch (X in camera space) -> roll (Z in camera space)
    if (this.lookYaw !== 0 || this.lookPitch !== 0 || this.lookRoll !== 0) {
      // Apply rotations in camera's local space
      // For a Z-up world with camera.up = (0,0,1):
      // - lookYaw: rotate around camera's up axis (world Z projected, but we use camera local Y)
      // - lookPitch: rotate around camera's right axis (local X)
      // - lookRoll: rotate around camera's forward axis (local Z)
      camera.rotateY(this.lookYaw)
      camera.rotateX(this.lookPitch)
      camera.rotateZ(this.lookRoll)
    }
  }

  snapshot(): CameraControllerState {
    return {
      target: this.target.clone(),
      radius: this.radius,
      yaw: this.yaw,
      pitch: this.pitch,
      lookYaw: this.lookYaw,
      lookPitch: this.lookPitch,
      lookRoll: this.lookRoll,
    }
  }

  restore(state: CameraControllerState) {
    this.target.copy(state.target)
    this.radius = state.radius
    this.yaw = state.yaw
    this.pitch = state.pitch
    this.lookYaw = state.lookYaw ?? 0
    this.lookPitch = state.lookPitch ?? 0
    this.lookRoll = state.lookRoll ?? 0
    this.clampState()
  }

  /**
   * Resets the free-look offset (yaw/pitch/roll) to zero.
   * Call this when focusing a new object or using recenter view.
   */
  resetLookOffset() {
    this.lookYaw = 0
    this.lookPitch = 0
    this.lookRoll = 0
  }

  /**
   * Updates the free-look offset based on pixel deltas.
   * This adjusts the view orientation without changing the orbit position.
   *
   * @param dxPx - Horizontal pixel delta (positive = look right)
   * @param dyPx - Vertical pixel delta (positive = look down)
   * @param sensitivity - Radians per pixel (default: 0.003)
   */
  applyFreeLookDelta(dxPx: number, dyPx: number, sensitivity: number = 0.003) {
    // Dragging right should look right (positive yaw in camera space)
    this.lookYaw += dxPx * sensitivity
    // Dragging down should look down (positive pitch in camera space)
    this.lookPitch -= dyPx * sensitivity
    this.clampState()
  }

  /**
   * Applies a roll delta to the camera view.
   *
   * @param deltaRad - Roll angle in radians (positive = clockwise when looking forward)
   */
  applyRollDelta(deltaRad: number) {
    this.lookRoll += deltaRad
    // Wrap roll to [-PI, PI] to avoid accumulating large values
    while (this.lookRoll > Math.PI) this.lookRoll -= 2 * Math.PI
    while (this.lookRoll < -Math.PI) this.lookRoll += 2 * Math.PI
  }

  /**
   * Pans the camera target in the camera plane based on screen-space pixel deltas.
   *
   * This updates `target` only; call `applyToCamera()` afterwards.
   */
  pan(
    dxPx: number,
    dyPx: number,
    camera: THREE.PerspectiveCamera,
    viewport: { width: number; height: number }
  ) {
    const height = viewport.height || 1

    // Convert pixels -> world units at the target plane.
    const fovRad = THREE.MathUtils.degToRad(camera.fov)
    const worldPerPx = (2 * this.radius * Math.tan(fovRad / 2)) / height

    // Dragging right should move the scene right (camera left), so invert X.
    const panX = -dxPx * worldPerPx
    const panY = dyPx * worldPerPx

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)

    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize()
    const up = new THREE.Vector3().crossVectors(right, dir).normalize()

    this.target.addScaledVector(right, panX)
    this.target.addScaledVector(up, panY)
  }
}
