import * as THREE from 'three'

export type CreateSelectionRingOptions = {
  /** Ring color (defaults to a pale yellow). */
  color?: THREE.ColorRepresentation

  /** Base opacity when not pulsing (0..1). */
  opacity?: number
}

export type SelectionRing = {
  object: THREE.Mesh
  setTarget: (mesh: THREE.Object3D | undefined) => void
  syncToCamera: (opts: { camera: THREE.Camera; nowMs: number }) => void
  dispose: () => void
}

/**
* A subtle world-space ring indicator for the currently selected body.
*
* - The ring is positioned in world space at the target's world position.
* - The ring billboards to the camera for consistent appearance.
* - The underlying body material is unchanged (no tint).
*/
export function createSelectionRing(options: CreateSelectionRingOptions = {}): SelectionRing {
  const material = new THREE.MeshBasicMaterial({
    color: options.color ?? '#ffe7a3',
    transparent: true,
    opacity: options.opacity ?? 0.22,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  })
  material.toneMapped = false

  // Start with a tiny ring; geometry is rebuilt when a target is set.
  let geometry = new THREE.RingGeometry(1, 1.1, 96)
  geometry.computeBoundingSphere()

  const object = new THREE.Mesh(geometry, material)
  object.visible = false
  object.renderOrder = 10_000

  const tmpPos = new THREE.Vector3()
  const tmpScale = new THREE.Vector3()

  let target: THREE.Object3D | undefined

  // Pulse parameters (kept subtle)
  const baseOpacity = material.opacity
  const opacityAmp = 0.05
  const scaleAmp = 0.03
  const omega = (Math.PI * 2) / 2400 // ~2.4s period

  const rebuildGeometryForTarget = () => {
    if (!target) return

    target.getWorldScale(tmpScale)
    const radiusWorld = Math.max(tmpScale.x, tmpScale.y, tmpScale.z)

    // Keep the ring subtle but still visible for very small bodies.
    const gap = Math.max(radiusWorld * 0.06, 0.0015)
    const thickness = Math.max(radiusWorld * 0.06, 0.001)

    const innerRadius = radiusWorld + gap
    const outerRadius = innerRadius + thickness

    geometry.dispose()
    geometry = new THREE.RingGeometry(innerRadius, outerRadius, 96)
    geometry.computeBoundingSphere()
    object.geometry = geometry
  }

  const setTarget = (mesh: THREE.Object3D | undefined) => {
    target = mesh
    object.visible = Boolean(target)
    object.scale.setScalar(1)
    material.opacity = baseOpacity

    if (target) {
      rebuildGeometryForTarget()
    }
  }

  const syncToCamera = ({ camera, nowMs }: { camera: THREE.Camera; nowMs: number }) => {
    if (!target || !object.visible) return

    target.getWorldPosition(tmpPos)
    object.position.copy(tmpPos)

    // Billboard so it always reads as a ring.
    object.quaternion.copy(camera.quaternion)

    // Subtle pulse (requires the caller to invalidate/render regularly).
    const s = 1 + scaleAmp * Math.sin(nowMs * omega)
    object.scale.setScalar(s)
    material.opacity = baseOpacity + opacityAmp * Math.sin(nowMs * omega + 1.1)
  }

  const dispose = () => {
    geometry.dispose()
    material.dispose()
  }

  return {
    object,
    setTarget,
    syncToCamera,
    dispose,
  }
}
