import type { BodyRef, FrameId } from '../spice/SpiceClient.js'
import type { KernelPackId } from '../spice/loadKernelPack.js'

import type { SceneBody, SceneBodyStyle } from './SceneModel.js'

export type BodyId =
  | 'SUN'
  | 'MERCURY'
  | 'VENUS'
  | 'EARTH'
  | 'MARS'
  | 'JUPITER'
  | 'SATURN'
  | 'URANUS'
  | 'NEPTUNE'
  | 'MOON'

export type BodyKind = 'star' | 'planet' | 'moon'

export type NaifIds = {
  /** The NAIF body ID (e.g. Earth=399, Jupiter=599). */
  body: number
  /** Optional NAIF barycenter ID for ephemeris kernels that provide barycenters instead. */
  barycenter?: number
}

export interface BodyRegistryEntry {
  /** Stable viewer identifier (currently matches SPICE body name). */
  id: BodyId

  /** NAIF ID or a SPICE-recognized body name; fed into `SpiceClient.getBodyState`. */
  body: BodyRef

  /**
   * Intended NAIF numeric IDs for this entry.
   *
   * For the Sun this is always 10. For planets, `body` is the planet's own ID
   * (199..899) and `barycenter` is the corresponding barycenter (1..8).
   *
   * NOTE: runtime SPICE lookups should continue to use `BodyRegistryEntry.body`
   * (`BodyRef`), since some ephemeris kernels (e.g. de432s) provide barycenter
   * states rather than planet body IDs.
   */
  naifIds?: NaifIds

  kind: BodyKind

  /** Optional parent reference for moons (and potentially rings/spacecraft later). */
  parentId?: BodyId

  /**
   * Hook for future behavior: some bodies won't render without additional kernel packs.
   *
   * (No runtime behavior changes yet; this is just metadata.)
   */
  requiresKernelPack?: boolean

  /** The kernel pack required by this body (if any). */
  kernelPackId?: KernelPackId

  /** Whether this body is included in the default scene. */
  defaultVisible: boolean

  /** Optional body-fixed frame for debug axes (e.g. `"IAU_EARTH"`). */
  bodyFixedFrame?: FrameId

  style: SceneBodyStyle
}

export const BODY_REGISTRY: readonly BodyRegistryEntry[] = [
  {
    id: 'SUN',
    body: 'SUN',
    naifIds: { body: 10 },
    kind: 'star',
    defaultVisible: true,
    style: {
      radiusKm: 695_700,
      appearance: {
        surface: {
          color: '#ffb703',
          texture: {
            url: 'textures/planets/sun.png',
            kind: 'sun',
            color: '#ffb703',
          },
        },
      },
      label: 'Sun',
    },
  },
  {
    id: 'MERCURY',
    // NOTE: de432s has barycenters for most planets (not the planet body IDs).
    body: 1,
    naifIds: { body: 199, barycenter: 1 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_MERCURY',
    style: {
      radiusKm: 2_439.7,
      appearance: {
        surface: {
          color: '#9ca3af',
          // Mercury: rough, rocky, and airless.
          roughness: 0.98,
          metalness: 0.0,
          bumpScale: 0.035,
          // Suppress ambient-lit washout on the night side.
          nightAlbedo: 0.02,
          terminatorTwilight: 0.06,
          texture: {
            url: 'textures/planets/mercury.jpg',
            // Avoid unintentionally tinting/darkening the albedo texture.
            color: '#ffffff',
          },
        },
      },
      label: 'Mercury',
    },
  },
  {
    id: 'VENUS',
    body: 2,
    naifIds: { body: 299, barycenter: 2 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_VENUS',
    style: {
      radiusKm: 6_051.8,
      appearance: {
        surface: {
          color: '#e9c46a',
          texture: {
            url: 'textures/planets/venus.png',
          },
        },
      },
      label: 'Venus',
    },
  },
  {
    id: 'EARTH',
    body: 'EARTH',
    naifIds: { body: 399, barycenter: 3 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_EARTH',
    style: {
      radiusKm: 6_371,
      appearance: {
        surface: {
          color: '#2a9d8f',
          texture: {
            url: 'textures/planets/earth.png',
            color: '#e6e6e6',
          },
        },
        layers: [
          {
            kind: 'earth',
            earth: {
              nightLightsTextureUrl: 'textures/planets/earth-nightlights.jpg',
              cloudsTextureUrl: 'textures/planets/earth-clouds.jpg',
              // Hook: we currently use a heuristic water factor (derived from albedo).
              // If we add a dedicated mask later, set `waterMaskTextureUrl` here.
              // waterMaskTextureUrl: 'textures/planets/earth-water-mask.png',

              nightLightsIntensity: 1.35,
              nightLightsTwilight: 0.12,

              cloudsRadiusRatio: 1.01,
              cloudsOpacity: 0.85,
              cloudsAlphaTest: 0.02,
              cloudsDriftRadPerSec: 0.00004,

              atmosphereRadiusRatio: 1.015,
              atmosphereColor: '#79b8ff',
              atmosphereIntensity: 0.55,
              atmosphereRimPower: 2.2,
              atmosphereSunBias: 0.65,

              oceanRoughness: 0.06,
              oceanSpecularIntensity: 0.35,
            },
          },
        ],
      },
      label: 'Earth',
    },
  },
  {
    id: 'MARS',
    body: 4,
    naifIds: { body: 499, barycenter: 4 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_MARS',
    style: {
      radiusKm: 3_389.5,
      appearance: {
        surface: {
          color: '#e76f51',
          texture: {
            url: 'textures/planets/mars.png',
            color: '#e76f51',
          },
        },
      },
      label: 'Mars',
    },
  },
  {
    id: 'JUPITER',
    body: 5,
    naifIds: { body: 599, barycenter: 5 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_JUPITER',
    style: {
      radiusKm: 69_911,
      appearance: {
        surface: {
          color: '#f4a261',
          texture: {
            url: 'textures/planets/jupiter.png',
          },
        },
      },
      label: 'Jupiter',
    },
  },
  {
    id: 'SATURN',
    body: 6,
    naifIds: { body: 699, barycenter: 6 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_SATURN',
    style: {
      radiusKm: 58_232,
      appearance: {
        surface: {
          color: '#f6bd60',
          texture: {
            url: 'textures/planets/saturn.png',
          },
        },
        rings: {
          // Roughly matches the main C/A ring span in units of Saturn radii.
          innerRadiusRatio: 1.28,
          outerRadiusRatio: 2.33,
          textureUrl: 'textures/planets/saturn-rings.png',
          color: '#d7c7a0',
        },
      },
      label: 'Saturn',
    },
  },
  {
    id: 'URANUS',
    body: 7,
    naifIds: { body: 799, barycenter: 7 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_URANUS',
    style: {
      radiusKm: 25_362,
      appearance: {
        surface: {
          color: '#8ecae6',
          texture: {
            url: 'textures/planets/uranus.png',
          },
        },
        rings: {
          // Uranus' main rings are narrow and dark.
          // Radii are rough (in units of Uranus radii) but visually match the main ring region.
          innerRadiusRatio: 1.55,
          outerRadiusRatio: 2.05,
          textureUrl: 'textures/planets/uranus-rings.png',
          color: '#6b7280',
          // The Uranus rings texture only contains strong alpha for a narrow band
          // near the inner edge; clamp alpha so the full annulus reads as a
          // faint, thicker ring system.
          baseOpacity: 0.4,
        },
      },
      label: 'Uranus',
    },
  },
  {
    id: 'NEPTUNE',
    body: 8,
    naifIds: { body: 899, barycenter: 8 },
    kind: 'planet',
    defaultVisible: true,
    bodyFixedFrame: 'IAU_NEPTUNE',
    style: {
      radiusKm: 24_622,
      appearance: {
        surface: {
          color: '#4361ee',
          texture: {
            url: 'textures/planets/neptune.png',
          },
        },
      },
      label: 'Neptune',
    },
  },
  {
    // Hooks-only (not rendered by default).
    id: 'MOON',
    body: 'MOON',
    naifIds: { body: 301 },
    kind: 'moon',
    parentId: 'EARTH',
    defaultVisible: false,
    requiresKernelPack: true,
    // Non-baseline: moons are intended to be download/opt-in later.
    kernelPackId: 'moon-default',
    bodyFixedFrame: 'IAU_MOON',
    style: {
      radiusKm: 1_737.4,
      appearance: {
        surface: {
          color: '#e9c46a',
          texture: {
            url: 'textures/planets/moon-lroc-4k.jpg',
          },
        },
      },
      label: 'Moon',
    },
  },
] as const

// ---------------------------------------------------------------------------
// Registry indexes
// ---------------------------------------------------------------------------

/** Fast lookup by stable `BodyId`. */
const BODY_REGISTRY_BY_ID = new Map<BodyId, BodyRegistryEntry>()

/**
 * Fast lookup by the SPICE target passed to `SpiceClient.getBodyState`.
 *
 * NOTE: this key is stringified because `BodyRef` can be a number or a string,
 * and consumers often carry it around as a string in `userData`.
 */
const BODY_REGISTRY_BY_BODY_REF_KEY = new Map<string, BodyRegistryEntry>()

/**
 * Best-effort lookup key map for strings coming from URL params / `mesh.userData`.
 *
 * Covers:
 * - `BodyRegistryEntry.id` (case-insensitive)
 * - `BodyRegistryEntry.body` (stringified)
 * - `BodyRegistryEntry.naifIds.body` / `.barycenter` (stringified)
 */
const BODY_REGISTRY_BY_RESOLVE_KEY = new Map<string, BodyRegistryEntry>()

const addResolveKey = (key: string, entry: BodyRegistryEntry) => {
  if (!key) return
  // Defensive: preserve the first entry if a later registry item accidentally
  // duplicates a resolve key.
  if (!BODY_REGISTRY_BY_RESOLVE_KEY.has(key)) {
    BODY_REGISTRY_BY_RESOLVE_KEY.set(key, entry)
  }
}

for (const entry of BODY_REGISTRY) {
  BODY_REGISTRY_BY_ID.set(entry.id, entry)

  const key = String(entry.body)
  // Defensive: preserve the first entry if a later registry item accidentally
  // duplicates a `body` ref.
  if (!BODY_REGISTRY_BY_BODY_REF_KEY.has(key)) {
    BODY_REGISTRY_BY_BODY_REF_KEY.set(key, entry)
  }

  // Unified resolver keys.
  addResolveKey(entry.id, entry)
  addResolveKey(entry.id.toUpperCase(), entry)
  addResolveKey(entry.id.toLowerCase(), entry)
  addResolveKey(key, entry)
  if (entry.naifIds) {
    addResolveKey(String(entry.naifIds.body), entry)
    if (entry.naifIds.barycenter != null) addResolveKey(String(entry.naifIds.barycenter), entry)
  }
}

export function getBodyRegistryEntry(id: BodyId): BodyRegistryEntry {
  const found = BODY_REGISTRY_BY_ID.get(id)
  if (!found) {
    throw new Error(`BodyRegistry: missing registry entry for ${JSON.stringify(id)}`)
  }
  return found
}

export function getBodyRegistryEntryByBodyRef(body: BodyRef): BodyRegistryEntry | undefined {
  return BODY_REGISTRY_BY_BODY_REF_KEY.get(String(body))
}

/**
 * Best-effort resolver for strings coming from URL params / `mesh.userData`.
 *
 * `raw` may be a `BodyId` (e.g. 'EARTH') or a SPICE `BodyRef` (e.g. '3').
 */
export function resolveBodyRegistryEntry(raw: string): BodyRegistryEntry | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  // Prefer stable ids. Treat ids as case-insensitive.
  const idKey = trimmed.toUpperCase() as BodyId
  const byId = BODY_REGISTRY_BY_ID.get(idKey)
  if (byId) return byId

  const direct = BODY_REGISTRY_BY_RESOLVE_KEY.get(trimmed)
  if (direct) return direct

  // Normalize numeric strings (e.g. "003" -> "3") so we can resolve a wider
  // range of URL param values.
  const n = Number(trimmed)
  if (Number.isFinite(n)) {
    return BODY_REGISTRY_BY_RESOLVE_KEY.get(String(n))
  }

  return undefined
}

export function listDefaultVisibleBodies(): readonly BodyRegistryEntry[] {
  return BODY_REGISTRY.filter((b) => b.defaultVisible)
}

export function listDefaultVisibleSceneBodies(): readonly SceneBody[] {
  return listDefaultVisibleBodies().map((b) => ({
    body: b.body,
    bodyFixedFrame: b.bodyFixedFrame,
    style: b.style,
  }))
}
