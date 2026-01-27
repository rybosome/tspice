import * as THREE from 'three'

import type { Mat3 } from '../spice/SpiceClient.js'

export type CreateFrameAxesOptions = {
  sizeWorld: number
  opacity?: number
}

const scratchM3 = new THREE.Matrix3()
const scratchM4 = new THREE.Matrix4()

function mat3RowMajorToMatrix4(m: Mat3): THREE.Matrix4 {
  // `Mat3` is row-major (SPICE). Three's matrices are column-major internally,
  // so we convert here at the rendering boundary.
  scratchM3.set(
    m[0],
    m[1],
    m[2],
    m[3],
    m[4],
    m[5],
    m[6],
    m[7],
    m[8],
  )
  scratchM4.identity().setFromMatrix3(scratchM3)
  return scratchM4
}

export function createFrameAxes(options: CreateFrameAxesOptions): {
  object: THREE.Object3D
  setPose: (pose: { position: THREE.Vector3; rotationJ2000?: Mat3 }) => void
  dispose: () => void
} {
  const size = options.sizeWorld
  const opacity = options.opacity ?? 1

  // X/Y/Z axes in local space, with per-vertex colors.
  //  - X: red
  //  - Y: green
  //  - Z: blue
  const positions = new Float32Array([
    0,
    0,
    0,
    size,
    0,
    0,
    0,
    0,
    0,
    0,
    size,
    0,
    0,
    0,
    0,
    0,
    0,
    size,
  ])
  const colors = new Float32Array([
    1,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    1,
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: opacity < 1,
    opacity,
    depthTest: true,
    depthWrite: false,
  })

  const object = new THREE.LineSegments(geometry, material)

  return {
    object,

    setPose: ({ position, rotationJ2000 }) => {
      object.position.copy(position)

      if (!rotationJ2000) {
        object.rotation.set(0, 0, 0)
        return
      }

      object.setRotationFromMatrix(mat3RowMajorToMatrix4(rotationJ2000))
    },

    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
