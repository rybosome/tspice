import type { BodyRef, FrameId } from "../spice/SpiceClient.js";
import type { KernelPackId } from "../spice/loadKernelPack.js";

import type { SceneBody, SceneBodyStyle } from "./SceneModel.js";

export type BodyId =
  | "SUN"
  | "MERCURY"
  | "VENUS"
  | "EARTH"
  | "MARS"
  | "JUPITER"
  | "SATURN"
  | "URANUS"
  | "NEPTUNE"
  | "MOON";

export type BodyKind = "star" | "planet" | "moon";

export interface BodyRegistryEntry {
  /** Stable viewer identifier (currently matches SPICE body name). */
  id: BodyId;

  /** NAIF ID or a SPICE-recognized body name; fed into `SpiceClient.getBodyState`. */
  body: BodyRef;

  kind: BodyKind;

  /** Optional parent reference for moons (and potentially rings/spacecraft later). */
  parentId?: BodyId;

  /**
   * Hook for future behavior: some bodies won't render without additional kernel packs.
   *
   * (No runtime behavior changes yet; this is just metadata.)
   */
  requiresKernelPack?: boolean;

  /** The kernel pack required by this body (if any). */
  kernelPackId?: KernelPackId;

  /** Whether this body is included in the default scene. */
  defaultVisible: boolean;

  /** Optional body-fixed frame for debug axes (e.g. `"IAU_EARTH"`). */
  bodyFixedFrame?: FrameId;

  style: SceneBodyStyle;
}

export const BODY_REGISTRY: readonly BodyRegistryEntry[] = [
  {
    id: "SUN",
    body: "SUN",
    kind: "star",
    defaultVisible: true,
    style: {
      radiusKm: 695_700,
      radiusScale: 2,
      color: "#ffb703",
      textureUrl: "textures/planets/sun.png",
      label: "Sun",
    },
  },
  {
    id: "MERCURY",
    // NOTE: de432s has barycenters for most planets (not the planet body IDs).
    body: 1,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_MERCURY",
    style: {
      radiusKm: 2_439.7,
      radiusScale: 150,
      color: "#9ca3af",
      textureUrl: "textures/planets/mercury.png",
      label: "Mercury",
    },
  },
  {
    id: "VENUS",
    body: 2,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_VENUS",
    style: {
      radiusKm: 6_051.8,
      radiusScale: 80,
      color: "#e9c46a",
      textureUrl: "textures/planets/venus.png",
      label: "Venus",
    },
  },
  {
    id: "EARTH",
    body: "EARTH",
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_EARTH",
    style: {
      radiusKm: 6_371,
      radiusScale: 50,
      color: "#2a9d8f",
      textureUrl: "textures/planets/earth.png",
      label: "Earth",
    },
  },
  {
    id: "MARS",
    body: 4,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_MARS",
    style: {
      radiusKm: 3_389.5,
      radiusScale: 110,
      color: "#e76f51",
      textureUrl: "textures/planets/mars.png",
      label: "Mars",
    },
  },
  {
    id: "JUPITER",
    body: 5,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_JUPITER",
    style: {
      radiusKm: 69_911,
      radiusScale: 5,
      color: "#f4a261",
      textureUrl: "textures/planets/jupiter.png",
      label: "Jupiter",
    },
  },
  {
    id: "SATURN",
    body: 6,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_SATURN",
    style: {
      radiusKm: 58_232,
      radiusScale: 6,
      color: "#f6bd60",
      textureUrl: "textures/planets/saturn.png",
      label: "Saturn",
    },
  },
  {
    id: "URANUS",
    body: 7,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_URANUS",
    style: {
      radiusKm: 25_362,
      radiusScale: 10,
      color: "#8ecae6",
      textureUrl: "textures/planets/uranus.png",
      label: "Uranus",
    },
  },
  {
    id: "NEPTUNE",
    body: 8,
    kind: "planet",
    defaultVisible: true,
    bodyFixedFrame: "IAU_NEPTUNE",
    style: {
      radiusKm: 24_622,
      radiusScale: 10,
      color: "#4361ee",
      textureUrl: "textures/planets/neptune.png",
      label: "Neptune",
    },
  },
  {
    // Hooks-only (not rendered by default).
    id: "MOON",
    body: "MOON",
    kind: "moon",
    parentId: "EARTH",
    defaultVisible: false,
    requiresKernelPack: true,
    kernelPackId: "naifGeneric",
    bodyFixedFrame: "IAU_MOON",
    style: {
      radiusKm: 1_737.4,
      radiusScale: 70,
      color: "#e9c46a",
      textureUrl: "textures/planets/moon.png",
      label: "Moon",
    },
  },
] as const;

export function getBodyRegistryEntry(id: BodyId): BodyRegistryEntry {
  const found = BODY_REGISTRY.find((b) => b.id === id);
  if (!found) {
    throw new Error(`BodyRegistry: missing registry entry for ${JSON.stringify(id)}`);
  }
  return found;
}

export function listDefaultVisibleBodies(): readonly BodyRegistryEntry[] {
  return BODY_REGISTRY.filter((b) => b.defaultVisible);
}

export function listDefaultVisibleSceneBodies(): readonly SceneBody[] {
  return listDefaultVisibleBodies().map((b) => ({
    body: b.body,
    bodyFixedFrame: b.bodyFixedFrame,
    style: b.style,
  }));
}
