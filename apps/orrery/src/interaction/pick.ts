import * as THREE from 'three'

type PickArgs = {
  clientX: number
  clientY: number
  element: HTMLElement
  camera: THREE.Camera
  pickables: THREE.Object3D[]
  raycaster: THREE.Raycaster
}

/** Raycast the pickable scene objects and return the closest intersection (if any). */
export function pickFirstIntersection({
  clientX,
  clientY,
  element,
  camera,
  pickables,
  raycaster,
}: PickArgs): THREE.Intersection<THREE.Object3D> | null {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1)

  raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

  const hits = raycaster.intersectObjects(pickables, false)
  return hits[0] ?? null
}
