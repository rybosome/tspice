/**
 * LabelOverlay - Pure DOM overlay for body labels with leader lines.
 *
 * Features:
 * - DOM-based labels (no React re-renders during animation)
 * - SVG leader lines with elbow routing
 * - Greedy 2D collision avoidance
 * - Behind-camera / outside-clip culling
 * - Apparent screen radius threshold filtering
 * - Optional occlusion via raycasting
 */

import * as THREE from 'three'
import type { BodyId, BodyKind } from '../scene/BodyRegistry.js'

// ---------- Types ----------

/**
 * Body metadata needed to render a label + leader line.
 */
export interface LabelBody {
  id: BodyId
  label: string
  kind: BodyKind
  mesh: THREE.Mesh
  radiusKm: number
}

/** Construction options for {@link LabelOverlay}. */
export interface LabelOverlayOptions {
  container: HTMLElement
  camera: THREE.PerspectiveCamera
  kmToWorld: number
}

/** Per-frame update options for {@link LabelOverlay.update}. */
export interface LabelOverlayUpdateOptions {
  bodies: LabelBody[]
  focusBodyId: BodyId | undefined
  selectedBodyId: BodyId | undefined
  labelsEnabled: boolean
  occlusionEnabled: boolean
  pickables: THREE.Mesh[]
  sunScaleMultiplier: number
  planetScaleMultiplier: number
}

interface LabelState {
  body: LabelBody
  screenPos: THREE.Vector2
  screenRadius: number
  visible: boolean
  priority: number
  placement: LabelPlacement | null
  domElement: HTMLDivElement
  leaderElement: SVGPolylineElement
}

interface LabelPlacement {
  labelX: number
  labelY: number
  anchorX: number
  anchorY: number
  corner: 'NE' | 'NW' | 'SE' | 'SW'
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// ---------- Constants ----------

const MIN_APPARENT_RADIUS_PX = 1.5
const LABEL_OFFSET_PX = 24
const LABEL_PADDING_X = 8
const LABEL_PADDING_Y = 4

// Priority order for collision avoidance
const KIND_PRIORITY: Record<BodyKind, number> = {
  star: 10,
  planet: 5,
  moon: 2,
}

// Candidate placement offsets (NE, NW, SE, SW)
type Corner = 'NE' | 'NW' | 'SE' | 'SW'
const PLACEMENT_CANDIDATES: readonly Corner[] = ['NE', 'NW', 'SE', 'SW']

// ---------- Helpers ----------

/**
 * Project a world position to normalized device coordinates (NDC).
 * Returns { x, y, z } where x,y are in [-1, 1] and z is depth.
 * Returns null if behind camera.
 */
function projectToNDC(
  position: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
): { x: number; y: number; z: number } | null {
  const pos = position.clone().project(camera)

  // Behind camera check: use the dot product with camera forward direction.
  const cameraToPoint = position.clone().sub(camera.position)
  const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)

  if (cameraToPoint.dot(cameraForward) < 0) {
    // Behind camera
    return null
  }

  // Clipped outside frustum?
  if (pos.z < -1 || pos.z > 1) {
    return null
  }

  return { x: pos.x, y: pos.y, z: pos.z }
}

/**
 * Convert NDC coordinates to screen pixel coordinates.
 */
function ndcToScreen(ndc: { x: number; y: number }, width: number, height: number): { x: number; y: number } {
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
  }
}

/**
 * Compute apparent screen radius in pixels for a body.
 */
function computeApparentRadiusPx(
  bodyWorldPos: THREE.Vector3,
  radiusWorld: number,
  camera: THREE.PerspectiveCamera,
  height: number,
): number {
  const distance = bodyWorldPos.distanceTo(camera.position)
  if (distance < 1e-9) return 0

  // Angular size in radians
  const angularSizeRad = 2 * Math.atan(radiusWorld / distance)

  // Convert to pixels using vertical FOV
  const vFov = THREE.MathUtils.degToRad(camera.fov)
  const pixelsPerRad = height / vFov

  return angularSizeRad * pixelsPerRad
}

/**
 * Check if a ray from camera to target intersects any other pickable before the target.
 */
function isOccluded(
  targetMesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  pickables: THREE.Mesh[],
  raycaster: THREE.Raycaster,
): boolean {
  const targetPos = new THREE.Vector3()
  targetMesh.getWorldPosition(targetPos)

  const direction = targetPos.clone().sub(camera.position).normalize()
  raycaster.set(camera.position, direction)

  const targetDistance = camera.position.distanceTo(targetPos)

  // Only check other pickables
  const others = pickables.filter((p) => p !== targetMesh)
  const intersects = raycaster.intersectObjects(others, false)

  // If any intersection is closer than the target, it's occluded
  for (const hit of intersects) {
    if (hit.distance < targetDistance - 0.001) {
      return true
    }
  }

  return false
}

/**
 * Compute label placement with elbow routing.
 */
function computePlacement(
  screenPos: THREE.Vector2,
  screenRadius: number,
  corner: Corner,
  labelWidth: number,
  labelHeight: number,
): LabelPlacement {
  // Anchor point on body edge
  const dirX = corner === 'NE' || corner === 'SE' ? 1 : -1
  const dirY = corner === 'NE' || corner === 'NW' ? -1 : 1

  const anchorX = screenPos.x + dirX * screenRadius * 0.7
  const anchorY = screenPos.y + dirY * screenRadius * 0.7

  // Label position
  const labelX = anchorX + dirX * LABEL_OFFSET_PX
  const labelY = anchorY + dirY * LABEL_OFFSET_PX

  return {
    labelX: corner === 'NE' || corner === 'SE' ? labelX : labelX - labelWidth,
    labelY: corner === 'NE' || corner === 'NW' ? labelY - labelHeight : labelY,
    anchorX,
    anchorY,
    corner,
  }
}

/**
 * Generate SVG polyline points for a leader line with an elbow.
 */
function generateLeaderPoints(
  screenPos: THREE.Vector2,
  placement: LabelPlacement,
  labelWidth: number,
  labelHeight: number,
): string {
  // Start at body center
  const startX = screenPos.x
  const startY = screenPos.y

  // End at label edge (center of the edge closest to body)
  let endX: number
  let endY: number

  switch (placement.corner) {
    case 'NE':
      endX = placement.labelX
      endY = placement.labelY + labelHeight / 2
      break
    case 'NW':
      endX = placement.labelX + labelWidth
      endY = placement.labelY + labelHeight / 2
      break
    case 'SE':
      endX = placement.labelX
      endY = placement.labelY + labelHeight / 2
      break
    case 'SW':
      endX = placement.labelX + labelWidth
      endY = placement.labelY + labelHeight / 2
      break
  }

  // Create elbow point
  const elbowX = placement.anchorX
  const elbowY = endY

  return `${startX},${startY} ${elbowX},${elbowY} ${endX},${endY}`
}

/**
 * Check if two rectangles overlap.
 */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y)
}

/**
 * Greedy placement algorithm for labels.
 */
function placeLabelsGreedy(labels: LabelState[], containerWidth: number, containerHeight: number): void {
  // Sort by priority (highest first)
  const sorted = [...labels].sort((a, b) => b.priority - a.priority)

  const placedRects: Rect[] = []

  for (const label of sorted) {
    if (!label.visible) {
      label.placement = null
      continue
    }

    // Measure label dimensions (estimate based on text length)
    const textLength = label.body.label.length
    const labelWidth = Math.max(40, textLength * 8 + LABEL_PADDING_X * 2)
    const labelHeight = 20 + LABEL_PADDING_Y * 2

    let bestPlacement: LabelPlacement | null = null

    // Try each corner
    for (const corner of PLACEMENT_CANDIDATES) {
      const placement = computePlacement(
        label.screenPos,
        Math.max(4, label.screenRadius),
        corner,
        labelWidth,
        labelHeight,
      )

      const rect: Rect = {
        x: placement.labelX,
        y: placement.labelY,
        width: labelWidth,
        height: labelHeight,
      }

      // Check bounds
      if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > containerWidth || rect.y + rect.height > containerHeight) {
        continue
      }

      // Check collisions with already-placed labels
      let collision = false
      for (const placed of placedRects) {
        if (rectsOverlap(rect, placed)) {
          collision = true
          break
        }
      }

      if (!collision) {
        bestPlacement = placement
        placedRects.push(rect)
        break
      }
    }

    label.placement = bestPlacement
  }
}

// ---------- LabelOverlay Class ----------

/**
 * Pure DOM overlay for body labels + leader lines (updated from the render loop).
 */
export class LabelOverlay {
  private container: HTMLElement
  private camera: THREE.PerspectiveCamera
  private kmToWorld: number

  private overlayDiv: HTMLDivElement
  private svgElement: SVGSVGElement
  private labelStates: Map<BodyId, LabelState> = new Map()

  private raycaster = new THREE.Raycaster()

  /** Create a new label overlay attached to a container element. */
  constructor(options: LabelOverlayOptions) {
    this.container = options.container
    this.camera = options.camera
    this.kmToWorld = options.kmToWorld

    // Create overlay container
    this.overlayDiv = document.createElement('div')
    this.overlayDiv.className = 'labelOverlay'
    // Styles are defined in App.css .labelOverlay
    this.container.appendChild(this.overlayDiv)

    // Create SVG for leader lines
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    // Styles are defined in App.css .labelOverlay svg
    this.overlayDiv.appendChild(this.svgElement)
  }

  /**
   * Update label positions and visibility.
   * Call this from the render loop.
   */
  update(options: LabelOverlayUpdateOptions): void {
    const {
      bodies,
      focusBodyId,
      selectedBodyId,
      labelsEnabled,
      occlusionEnabled,
      pickables,
      sunScaleMultiplier,
      planetScaleMultiplier,
    } = options

    // Hide everything if labels are disabled
    if (!labelsEnabled) {
      this.overlayDiv.style.display = 'none'
      return
    }
    this.overlayDiv.style.display = ''

    const width = this.container.clientWidth
    const height = this.container.clientHeight

    // Sync label state with bodies
    const currentIds = new Set<BodyId>()
    for (const body of bodies) {
      currentIds.add(body.id)

      let state = this.labelStates.get(body.id)
      if (!state) {
        state = this.createLabelState(body)
        this.labelStates.set(body.id, state)
      }
      state.body = body
    }

    // Remove stale labels
    for (const [id, state] of this.labelStates) {
      if (!currentIds.has(id)) {
        state.domElement.remove()
        state.leaderElement.remove()
        this.labelStates.delete(id)
      }
    }

    // Update each label
    for (const state of this.labelStates.values()) {
      const { body } = state

      // Get world position
      const worldPos = new THREE.Vector3()
      body.mesh.getWorldPosition(worldPos)

      // Project to screen
      const ndc = projectToNDC(worldPos, this.camera)
      if (!ndc) {
        state.visible = false
        state.domElement.style.display = 'none'
        state.leaderElement.style.display = 'none'
        continue
      }

      const screenPos = ndcToScreen(ndc, width, height)
      state.screenPos.set(screenPos.x, screenPos.y)

      // Compute apparent radius
      const scaleMultiplier = body.id === 'SUN' ? sunScaleMultiplier : planetScaleMultiplier
      const radiusWorld = body.radiusKm * this.kmToWorld * scaleMultiplier
      state.screenRadius = computeApparentRadiusPx(worldPos, radiusWorld, this.camera, height)

      // Filter by apparent size
      if (state.screenRadius < MIN_APPARENT_RADIUS_PX) {
        state.visible = false
        state.domElement.style.display = 'none'
        state.leaderElement.style.display = 'none'
        continue
      }

      // Occlusion check
      if (occlusionEnabled && isOccluded(body.mesh, this.camera, pickables, this.raycaster)) {
        state.visible = false
        state.domElement.style.display = 'none'
        state.leaderElement.style.display = 'none'
        continue
      }

      // Compute priority
      let priority = KIND_PRIORITY[body.kind] ?? 1
      if (body.id === selectedBodyId) priority += 100
      if (body.id === focusBodyId) priority += 50
      state.priority = priority

      state.visible = true
    }

    // Run greedy placement
    placeLabelsGreedy(Array.from(this.labelStates.values()), width, height)

    // Apply placements to DOM
    for (const state of this.labelStates.values()) {
      if (!state.visible || !state.placement) {
        state.domElement.style.display = 'none'
        state.leaderElement.style.display = 'none'
        continue
      }

      const { placement } = state

      // Position label
      state.domElement.style.display = ''
      state.domElement.style.transform = `translate(${placement.labelX}px, ${placement.labelY}px)`

      // Measure actual label size
      const labelWidth = state.domElement.offsetWidth || 60
      const labelHeight = state.domElement.offsetHeight || 24

      // Update leader line
      state.leaderElement.style.display = ''
      const points = generateLeaderPoints(state.screenPos, placement, labelWidth, labelHeight)
      state.leaderElement.setAttribute('points', points)
    }
  }

  private createLabelState(body: LabelBody): LabelState {
    // Create DOM element for label
    const domElement = document.createElement('div')
    domElement.className = 'labelBox'
    domElement.textContent = body.label
    // Base styles in App.css .labelBox, only dynamic display state here
    domElement.style.display = 'none'
    this.overlayDiv.appendChild(domElement)

    // Create SVG polyline for leader line
    const leaderElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    leaderElement.classList.add('labelLeader')
    leaderElement.style.display = 'none'
    this.svgElement.appendChild(leaderElement)

    return {
      body,
      screenPos: new THREE.Vector2(),
      screenRadius: 0,
      visible: false,
      priority: 0,
      placement: null,
      domElement,
      leaderElement,
    }
  }

  /** Remove overlay DOM and release internal state. */
  dispose(): void {
    this.overlayDiv.remove()
    this.labelStates.clear()
  }
}
