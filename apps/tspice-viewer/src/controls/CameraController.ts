import * as THREE from 'three'

export type CameraControllerState = {
  target: THREE.Vector3
  radius: number
  yaw: number
  pitch: number
}

export class CameraController {
  target: THREE.Vector3
  radius: number
  yaw: number
  pitch: number

  private readonly minRadius: number
  private readonly maxRadius: number
  private readonly minPitch: number
  private readonly maxPitch: number

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

    this.minRadius = opts?.minRadius ?? 0.05
    this.maxRadius = opts?.maxRadius ?? 100

    // Keep pitch away from the poles so orbit math stays stable.
    this.minPitch = opts?.minPitch ?? (-Math.PI / 2 + 0.01)
    this.maxPitch = opts?.maxPitch ?? (Math.PI / 2 - 0.01)

    this.clampState()
  }

  static fromCamera(camera: THREE.Camera, target = new THREE.Vector3(0, 0, 0)) {
    const offset = camera.position.clone().sub(target)
    const radius = offset.length() || 1

    // yaw: azimuth around +Y axis, 0 at +X.
    const yaw = Math.atan2(offset.z, offset.x)
    const pitch = Math.asin(THREE.MathUtils.clamp(offset.y / radius, -1, 1))

    return new CameraController({ target, radius, yaw, pitch })
  }

  clampState() {
    this.radius = THREE.MathUtils.clamp(this.radius, this.minRadius, this.maxRadius)
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch)
  }

  applyToCamera(camera: THREE.Camera) {
    this.clampState()

    const cosPitch = Math.cos(this.pitch)

    const offset = new THREE.Vector3(
      this.radius * cosPitch * Math.cos(this.yaw),
      this.radius * Math.sin(this.pitch),
      this.radius * cosPitch * Math.sin(this.yaw)
    )

    camera.position.copy(this.target).add(offset)
    camera.lookAt(this.target)
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
