import { describe, expect, test } from 'vitest'
import * as THREE from 'three'

import { computeOrbitAnglesToKeepPointInView, isDirectionWithinFov } from './sunFocus.js'

function cameraForwardFromYawPitch(yaw: number, pitch: number) {
  const cosPitch = Math.cos(pitch)
  const offsetDir = new THREE.Vector3(cosPitch * Math.cos(yaw), cosPitch * Math.sin(yaw), Math.sin(pitch))
  return offsetDir.multiplyScalar(-1).normalize()
}

describe('sunFocus', () => {
  test('computeOrbitAnglesToKeepPointInView keeps point within camera fov', () => {
    const cameraFovDeg = 50
    const cameraAspect = 900 / 650

    const cases = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.3, 0.9, 0.1), new THREE.Vector3(-0.2, 0.1, 0.97)]

    for (const pointWorld of cases) {
      const angles = computeOrbitAnglesToKeepPointInView({
        pointWorld,
        cameraFovDeg,
        cameraAspect,
      })

      expect(angles).not.toBeNull()
      if (!angles) continue

      const forward = cameraForwardFromYawPitch(angles.yaw, angles.pitch)
      const dirToPoint = pointWorld.clone().normalize()

      expect(
        isDirectionWithinFov({
          cameraForwardDir: forward,
          dirToPoint,
          cameraFovDeg,
          cameraAspect,
        }),
      ).toBe(true)

      // Ensure we didn't just center perfectly on the point.
      const offAxis = forward.angleTo(dirToPoint)
      expect(offAxis).toBeGreaterThan(THREE.MathUtils.degToRad(2))
    }
  })
})
