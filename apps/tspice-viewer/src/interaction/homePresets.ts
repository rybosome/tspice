import * as THREE from 'three'
import { CameraController, type CameraControllerState } from '../controls/CameraController.js'
import type { BodyRef } from '../spice/SpiceClient.js'

// -----------------------------------------------------------------------------
// Home camera presets (world units, target at origin)
// -----------------------------------------------------------------------------
export type HomePresetKey = 'EARTH' | 'VENUS'

const HOME_CAMERA_PRESETS: Record<HomePresetKey, CameraControllerState> = {
  EARTH: CameraController.stateFromPose({
    position: new THREE.Vector3(0.0137, 0.0294, 0.0095),
    quaternion: new THREE.Quaternion(0.13, 0.585, 0.782, 0.174),
    target: new THREE.Vector3(0, 0, 0),
  }),
  VENUS: CameraController.stateFromPose({
    position: new THREE.Vector3(-0.0342, 0.022, 0.0062),
    quaternion: new THREE.Quaternion(-0.312, 0.572, 0.666, -0.363),
    target: new THREE.Vector3(0, 0, 0),
  }),
}

const HOME_PRESET_ALIASES: Record<HomePresetKey, readonly string[]> = {
  // We accept both the symbolic name and the NAIF IDs used elsewhere in the UI.
  // 3 = Earth-Moon barycenter, 399 = Earth
  EARTH: ['EARTH', '3', '399'],
  // 2 = Venus barycenter, 299 = Venus
  VENUS: ['VENUS', '2', '299'],
} as const

function getHomePresetAliases(key: HomePresetKey): readonly string[] {
  return HOME_PRESET_ALIASES[key]
}

function getHomePresetKey(focusBody: BodyRef): HomePresetKey | null {
  const key = String(focusBody).toUpperCase()
  if (getHomePresetAliases('EARTH').includes(key)) return 'EARTH'
  if (getHomePresetAliases('VENUS').includes(key)) return 'VENUS'
  return null
}

export function getHomePresetStateForKey(key: HomePresetKey): CameraControllerState {
  return HOME_CAMERA_PRESETS[key]
}

export function getHomePresetState(focusBody: BodyRef): CameraControllerState | null {
  const key = getHomePresetKey(focusBody)
  return key ? HOME_CAMERA_PRESETS[key] : null
}

export function listHomePresetAliasesForKey(key: HomePresetKey): readonly string[] {
  return getHomePresetAliases(key)
}
