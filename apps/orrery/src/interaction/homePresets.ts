import * as THREE from 'three'
import { CameraController, type CameraControllerState } from '../controls/CameraController.js'
import type { BodyRef } from '../spice/types.js'

// -----------------------------------------------------------------------------
// Home camera presets (world units, target at origin)
// -----------------------------------------------------------------------------
export const HOME_PRESET_KEYS = [
  'MERCURY',
  'VENUS',
  'EARTH',
  'MOON',
  'MARS',
  'JUPITER',
  'SATURN',
  'URANUS',
  'NEPTUNE',
] as const

export type HomePresetKey = (typeof HOME_PRESET_KEYS)[number]

type HomePreset = {
  state: CameraControllerState
  aliases: readonly string[]
}

const HOME_PRESETS: Record<HomePresetKey, HomePreset> = {
  MERCURY: {
    state: CameraController.stateFromPose({
      // Distance-to-target: 0.0256
      position: new THREE.Vector3(0.00448183711556181, -0.02003644828133515, -0.01529097368838735),
      quaternion: new THREE.Quaternion(0.889, 0.095, 0.048, 0.446),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 1 = Mercury barycenter, 199 = Mercury
    aliases: ['MERCURY', '1', '199'],
  },
  VENUS: {
    state: CameraController.stateFromPose({
      position: new THREE.Vector3(-0.0342, 0.022, 0.0062),
      quaternion: new THREE.Quaternion(-0.312, 0.572, 0.666, -0.363),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 2 = Venus barycenter, 299 = Venus
    aliases: ['VENUS', '2', '299'],
  },
  EARTH: {
    state: CameraController.stateFromPose({
      position: new THREE.Vector3(0.0137, 0.0294, 0.0095),
      quaternion: new THREE.Quaternion(0.13, 0.585, 0.782, 0.174),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // We accept both the symbolic name and the NAIF IDs used elsewhere in the UI.
    // 3 = Earth-Moon barycenter, 399 = Earth
    aliases: ['EARTH', '3', '399'],
  },
  MOON: {
    state: CameraController.stateFromPose({
      position: new THREE.Vector3(-0.0095, -0.0013, -0.0008),
      quaternion: new THREE.Quaternion(0.604, -0.419, -0.386, 0.557),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 301 = Moon
    aliases: ['MOON', '301'],
  },
  MARS: {
    state: CameraController.stateFromPose({
      position: new THREE.Vector3(0.018, 0.0093, -0.0026),
      quaternion: new THREE.Quaternion(0.357, 0.671, 0.574, 0.305),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 4 = Mars barycenter, 499 = Mars
    aliases: ['MARS', '4', '499'],
  },
  JUPITER: {
    state: CameraController.stateFromPose({
      // Distance-to-target: 0.2352
      position: new THREE.Vector3(0.2163396716510539, 0.08646641772249185, 0.03224507832450929),
      quaternion: new THREE.Quaternion(0.368, 0.544, 0.624, 0.423),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 5 = Jupiter barycenter, 599 = Jupiter
    aliases: ['JUPITER', '5', '599'],
  },
  SATURN: {
    state: CameraController.stateFromPose({
      // Distance-to-target: 0.2184
      position: new THREE.Vector3(0.20246366553742295, 0.0797819429874217, 0.018489610874822184),
      quaternion: new THREE.Quaternion(0.326, 0.584, 0.649, 0.362),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 6 = Saturn barycenter, 699 = Saturn
    aliases: ['SATURN', '6', '699'],
  },
  URANUS: {
    state: CameraController.stateFromPose({
      // Distance-to-target: 0.1506
      position: new THREE.Vector3(0.05077796103776682, -0.1183334355178367, -0.07809709797036651),
      quaternion: new THREE.Quaternion(0.854, 0.175, 0.099, 0.481),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 7 = Uranus barycenter, 799 = Uranus
    aliases: ['URANUS', '7', '799'],
  },
  NEPTUNE: {
    state: CameraController.stateFromPose({
      position: new THREE.Vector3(0.1209, -0.0394, -0.0345),
      quaternion: new THREE.Quaternion(0.643, 0.467, 0.357, 0.492),
      target: new THREE.Vector3(0, 0, 0),
    }),
    // 8 = Neptune barycenter, 899 = Neptune
    aliases: ['NEPTUNE', '8', '899'],
  },
} as const

/** List the available home preset keys (in UI order). */
export function listHomePresetKeys(): readonly HomePresetKey[] {
  return HOME_PRESET_KEYS
}

function getHomePresetAliases(key: HomePresetKey): readonly string[] {
  return HOME_PRESETS[key].aliases
}

function normalizeHomePresetAlias(alias: string): string {
  return alias.toUpperCase()
}

const HOME_PRESET_KEY_BY_ALIAS: ReadonlyMap<string, HomePresetKey> = (() => {
  const map = new Map<string, HomePresetKey>()

  for (const presetKey of HOME_PRESET_KEYS) {
    for (const alias of getHomePresetAliases(presetKey)) {
      const normalizedAlias = normalizeHomePresetAlias(alias)

      // If multiple presets share an alias, prefer the earlier entry in HOME_PRESET_KEYS.
      if (!map.has(normalizedAlias)) map.set(normalizedAlias, presetKey)
    }
  }

  return map
})()

function getHomePresetKey(focusBody: BodyRef): HomePresetKey | null {
  const alias = normalizeHomePresetAlias(String(focusBody))
  return HOME_PRESET_KEY_BY_ALIAS.get(alias) ?? null
}

/** Get the camera controller state for a specific home preset. */
export function getHomePresetStateForKey(key: HomePresetKey): CameraControllerState {
  return HOME_PRESETS[key].state
}

/** Get the best-matching home preset state for a focused body (if any). */
export function getHomePresetState(focusBody: BodyRef): CameraControllerState | null {
  const key = getHomePresetKey(focusBody)
  return key ? HOME_PRESETS[key].state : null
}

/** List accepted aliases (names/NAIF IDs) for a home preset key. */
export function listHomePresetAliasesForKey(key: HomePresetKey): readonly string[] {
  return getHomePresetAliases(key)
}
