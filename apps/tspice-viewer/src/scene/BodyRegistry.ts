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
      color: '#ffb703',
      textureColor: '#ffb703',
      textureUrl: 'textures/planets/sun.png',
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
      color: '#9ca3af',
      textureUrl: 'textures/planets/mercury.png',
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
      color: '#e9c46a',
      textureUrl: 'textures/planets/venus.png',
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
      color: '#2a9d8f',
      textureColor: '#e6e6e6',
      textureUrl: 'textures/planets/earth.png',
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
      color: '#e76f51',
      textureColor: '#e76f51',
      textureUrl: 'textures/planets/mars.png',
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
      color: '#f4a261',
      textureUrl: 'textures/planets/jupiter.png',
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
      color: '#f6bd60',
      textureUrl: 'textures/planets/saturn.png',
      rings: {
        // Roughly matches the main C/A ring span in units of Saturn radii.
        innerRadiusRatio: 1.28,
        outerRadiusRatio: 2.33,
        textureUrl: 'textures/planets/saturn-rings.png',
        color: '#d7c7a0',
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
      color: '#8ecae6',
      textureUrl: 'textures/planets/uranus.png',
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
      color: '#4361ee',
      textureUrl: 'textures/planets/neptune.png',
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
      color: '#e9c46a',
      textureUrl: 'textures/planets/moon.png',
      label: 'Moon',
    },
  },
] as const

export function getBodyRegistryEntry(id: BodyId): BodyRegistryEntry {
  const found = BODY_REGISTRY.find((b) => b.id === id)
  if (!found) {
    throw new Error(`BodyRegistry: missing registry entry for ${JSON.stringify(id)}`)
  }
  return found
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
