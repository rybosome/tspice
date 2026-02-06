import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

type OverlayMode = 'none' | 'hovered' | 'selected'
type ZoomTier = 'far' | 'mid' | 'close'

type ElementKey = 'z' | 'ring' | 'x' | 'y'

type ElementAnim = {
  value: number
  startValue: number
  targetValue: number
  startMs: number
  durationMs: number
}

export type SelectionOverlay = {
  object: THREE.Object3D

  setSelectedTarget: (mesh: THREE.Object3D | undefined) => void
  setHoveredTarget: (mesh: THREE.Object3D | undefined) => void

  /**
   * Returns true while any fade animation is in progress.
   *
   * Callers can use this to run a short-lived invalidation loop.
   */
  isAnimating: (nowMs: number) => boolean

  setResolution: (widthPx: number, heightPx: number) => void

  syncToCamera: (opts: { camera: THREE.PerspectiveCamera; nowMs: number; viewportHeightPx: number }) => void

  dispose: () => void
}

export type CreateSelectionOverlayOptions = {
  /**
   * Optional drawing-buffer resolution (in *device* pixels) to use for the very
   * first paint.
   *
   * The overlay line materials depend on `LineMaterial.resolution` for correct
   * line widths. Callers typically update this via `setResolution()` inside
   * their resize handler, but providing an initial value avoids a first-frame
   * "wrong thickness" paint when resize work is throttled to RAF.
   */
  initialResolution?: { widthPx: number; heightPx: number }
}

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

export const SELECTION_OVERLAY_TUNING = {
  /** Base extent (half-length) of axes: `bodyRadiusWorld * k`. */
  axisExtentRadiusMult: 1.85,

  /** Clamp the axes extent in screen space (CSS px). */
  axisMinPx: 16,
  axisMaxPx: 72,

  /**
   * Allow the axes to grow a bit larger at extreme close zoom.
   *
   * Implemented as a soft maximum (a curve) so we don't get a hard clamp pop.
   */
  axisMaxExtraPx: 56,
  axisMaxExtraStartBodyRadiusPx: 22,
  axisMaxExtraEndBodyRadiusPx: 220,

  /** Leave a small gap between axis segments and the body surface. */
  axisSurfaceGapRadiusMult: 0.02,

  /** Ring radius as a multiple of `axisExtentWorld`. */
  ringRadiusMult: 0.72,

  /** Ring arcs (radians). */
  ringNearArcSpanRad: 1.2 * Math.PI,
  ringFarArcSpanRad: 0.45 * Math.PI,

  /** Zoom tier thresholds (based on body *radius* in screen pixels). */
  farBodyRadiusPx: 3,
  midBodyRadiusPx: 14,

  /** Fade timings. */
  hoverFadeMs: 130,
  selectFadeMs: 90,
  selectRingDelayMs: 90,
  selectAxesDelayMs: 180,

  /** Line widths (pixels). */
  zLineWidthPx: 1.6,
  ringLineWidthPx: 1.2,
  xyLineWidthPx: 1.05,

  /** Far-side attenuation (opacity multipliers). */
  farSideOpacityMult: {
    z: 0.55,
    ring: 0.16,
    xy: 0.24,
  },

  /** Opacities by tier (selected). */
  selected: {
    far: { z: 0.1, ring: 0, xy: 0 },
    mid: { z: 0.52, ring: 0.28, xy: 0.06 },
    close: { z: 0.78, ring: 0.42, xy: 0.18 },
  },

  /** Opacity by tier (hover). */
  hovered: {
    far: { z: 0.08 },
    mid: { z: 0.12 },
    close: { z: 0.14 },
  },

  /** Colors. */
  colors: {
    spinAxis: '#5dffb5',
    frame: '#4ea37e',
  },
} as const

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function smoothstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function softClampMax(value: number, max: number, extra: number) {
  // Smoothly approach `max + extra` for large values, while matching
  // `value` and its derivative near `max`.
  if (!(extra > 1e-6)) return Math.min(value, max)
  if (value <= max) return value
  const excess = value - max
  return max + (excess * extra) / (extra + excess)
}

function computeWorldPerPixel(opts: {
  camera: THREE.PerspectiveCamera
  distanceWorld: number
  viewportHeightPx: number
}) {
  const { camera, distanceWorld, viewportHeightPx } = opts
  const heightPx = Math.max(1, viewportHeightPx)
  const fovRad = THREE.MathUtils.degToRad(camera.fov)
  const worldHeight = 2 * Math.max(0, distanceWorld) * Math.tan(fovRad * 0.5)
  return worldHeight / heightPx
}

function makeUnitArcPositions(opts: { segments: number; spanRad: number }) {
  const { segments, spanRad } = opts
  const n = Math.max(8, Math.floor(segments))
  const positions: number[] = []

  const half = spanRad * 0.5
  for (let i = 0; i <= n; i++) {
    const t = THREE.MathUtils.lerp(-half, half, i / n)
    positions.push(Math.cos(t), Math.sin(t), 0)
  }

  return positions
}

function schedule(anim: ElementAnim, nowMs: number, nextTarget: number, durationMs: number) {
  anim.startValue = anim.value
  anim.targetValue = nextTarget
  anim.startMs = nowMs
  anim.durationMs = Math.max(0, durationMs)
}

type TrackPhase =
  | { kind: 'inactive' }
  | { kind: 'delayed' }
  | {
      kind: 'active'
      /** Normalized track phase [0..1]. */
      t01: number
    }

function getTrackPhase(track: ElementAnim, nowMs: number): TrackPhase {
  const eps = 1e-4
  if (Math.abs(track.targetValue - track.startValue) <= eps) return { kind: 'inactive' }
  if (!(track.durationMs > 0)) return { kind: 'inactive' }

  // Delayed tracks are still "active" so callers can keep their RAF
  // invalidation loop running until the delayed fade stages begin.
  if (nowMs < track.startMs) return { kind: 'delayed' }

  const endMs = track.startMs + track.durationMs
  if (!(nowMs < endMs)) return { kind: 'inactive' }

  const t = (nowMs - track.startMs) / track.durationMs
  return { kind: 'active', t01: THREE.MathUtils.clamp(t, 0, 1) }
}

function evalAnim(anim: ElementAnim, nowMs: number) {
  const phase = getTrackPhase(anim, nowMs)

  // During the delay, preserve the current value so we don't snap back to
  // `startValue` every frame.
  if (phase.kind === 'delayed') return

  if (phase.kind === 'inactive') {
    // If the track has ended (or has a zero duration), snap cleanly.
    if (nowMs >= anim.startMs) {
      anim.value = anim.targetValue
    }
    return
  }

  const eased = easeOutCubic(phase.t01)
  anim.value = THREE.MathUtils.lerp(anim.startValue, anim.targetValue, eased)
}

function maxComponent(v: THREE.Vector3) {
  return Math.max(v.x, v.y, v.z)
}

export function createSelectionOverlay(opts?: CreateSelectionOverlayOptions): SelectionOverlay {
  const tuning = SELECTION_OVERLAY_TUNING

  const object = new THREE.Group()
  object.name = 'SelectionOverlay'
  object.visible = false
  object.renderOrder = 10_000

  const initialW = opts?.initialResolution?.widthPx
  const initialH = opts?.initialResolution?.heightPx

  const resolution = new THREE.Vector2(
    Math.max(1, typeof initialW === 'number' && Number.isFinite(initialW) ? Math.floor(initialW) : 1),
    Math.max(1, typeof initialH === 'number' && Number.isFinite(initialH) ? Math.floor(initialH) : 1),
  )

  const makeMaterial = (opts: { color: THREE.ColorRepresentation; lineWidthPx: number; opacity: number }) => {
    const material = new LineMaterial({
      color: new THREE.Color(opts.color).getHex(),
      linewidth: opts.lineWidthPx,
      worldUnits: false,
      transparent: true,
      opacity: opts.opacity,
      depthTest: false,
      depthWrite: false,
    })

    material.resolution.copy(resolution)
    material.toneMapped = false
    return material
  }

  // We intentionally create *multiple* LineMaterial instances.
  //
  // Each axis is split into +/- halves so we can attenuate the far-side segment
  // based on camera direction (e.g. fade the back-facing half of the axis).
  // `LineMaterial.opacity` is a single scalar, so we need distinct materials per
  // half in order to set independent opacities every frame.
  //
  // Additionally, the equatorial ring uses separate near/far materials to avoid
  // over-brightening the far-side arc.
  const zPosMaterial = makeMaterial({
    color: tuning.colors.spinAxis,
    lineWidthPx: tuning.zLineWidthPx,
    opacity: 0,
  })

  const zNegMaterial = makeMaterial({
    color: tuning.colors.spinAxis,
    lineWidthPx: tuning.zLineWidthPx,
    opacity: 0,
  })

  // X and Y use independent materials so we can fade them independently.
  const xPosMaterial = makeMaterial({
    color: tuning.colors.frame,
    lineWidthPx: tuning.xyLineWidthPx,
    opacity: 0,
  })

  const xNegMaterial = makeMaterial({
    color: tuning.colors.frame,
    lineWidthPx: tuning.xyLineWidthPx,
    opacity: 0,
  })

  const yPosMaterial = makeMaterial({
    color: tuning.colors.frame,
    lineWidthPx: tuning.xyLineWidthPx,
    opacity: 0,
  })

  const yNegMaterial = makeMaterial({
    color: tuning.colors.frame,
    lineWidthPx: tuning.xyLineWidthPx,
    opacity: 0,
  })

  const ringNearMaterial = makeMaterial({
    color: tuning.colors.frame,
    lineWidthPx: tuning.ringLineWidthPx,
    opacity: 0,
  })

  const ringFarMaterial = makeMaterial({
    color: tuning.colors.frame,
    lineWidthPx: tuning.ringLineWidthPx * 0.9,
    opacity: 0,
  })

  // Shared unit segment along +X (from 0..1). We'll scale/position it to form
  // two axis halves that start just outside the body radius.
  const unitSegGeom = new LineGeometry()
  unitSegGeom.setPositions([0, 0, 0, 1, 0, 0])

  const makeAxisHalves = (opts: {
    name: string
    posMaterial: LineMaterial
    negMaterial: LineMaterial
    axisRotation: THREE.Euler
  }) => {
    const group = new THREE.Group()
    group.name = opts.name
    group.rotation.copy(opts.axisRotation)

    const pos = new Line2(unitSegGeom, opts.posMaterial)
    pos.name = `${opts.name}Pos`
    pos.computeLineDistances()

    const neg = new Line2(unitSegGeom, opts.negMaterial)
    neg.name = `${opts.name}Neg`
    // Flip +X to -X within the axis group.
    neg.rotation.z = Math.PI
    neg.computeLineDistances()

    group.add(pos, neg)
    return { group, pos, neg }
  }

  const xAxis = makeAxisHalves({
    name: 'SelectionOverlayXAxis',
    posMaterial: xPosMaterial,
    negMaterial: xNegMaterial,
    axisRotation: new THREE.Euler(0, 0, 0),
  })

  const yAxis = makeAxisHalves({
    name: 'SelectionOverlayYAxis',
    posMaterial: yPosMaterial,
    negMaterial: yNegMaterial,
    axisRotation: new THREE.Euler(0, 0, Math.PI / 2),
  })

  const zAxis = makeAxisHalves({
    name: 'SelectionOverlayZAxis',
    posMaterial: zPosMaterial,
    negMaterial: zNegMaterial,
    axisRotation: new THREE.Euler(0, -Math.PI / 2, 0),
  })

  const axesGroup = new THREE.Group()
  axesGroup.name = 'SelectionOverlayAxes'
  axesGroup.add(xAxis.group, yAxis.group, zAxis.group)
  object.add(axesGroup)

  const ringNearGeom = new LineGeometry()
  ringNearGeom.setPositions(makeUnitArcPositions({ segments: 72, spanRad: tuning.ringNearArcSpanRad }))
  const ringNear = new Line2(ringNearGeom, ringNearMaterial)
  ringNear.name = 'SelectionOverlayEquatorialRingNear'
  ringNear.computeLineDistances()
  object.add(ringNear)

  const ringFarGeom = new LineGeometry()
  ringFarGeom.setPositions(makeUnitArcPositions({ segments: 48, spanRad: tuning.ringFarArcSpanRad }))
  const ringFar = new Line2(ringFarGeom, ringFarMaterial)
  ringFar.name = 'SelectionOverlayEquatorialRingFar'
  ringFar.computeLineDistances()
  object.add(ringFar)

  const tmpTargetPos = new THREE.Vector3()
  const tmpTargetQuat = new THREE.Quaternion()
  const tmpScale = new THREE.Vector3()
  const tmpInvOverlayQuat = new THREE.Quaternion()
  const tmpCamLocal = new THREE.Vector3()
  const tmpCamLocalXY = new THREE.Vector3()

  let selectedTarget: THREE.Object3D | undefined
  let hoveredTarget: THREE.Object3D | undefined

  let activeMode: OverlayMode = 'none'
  let activeTarget: THREE.Object3D | undefined
  let lastZoomTier: ZoomTier | undefined

  // Keep the last known pose/sizing so we can fade out cleanly.
  let lastBodyRadiusWorld = 1
  let lastDistanceWorld = 1

  // Cache sizing inputs so we don't redo math + object graph writes when the
  // camera/viewport hasn't changed materially.
  let lastSizing:
    | {
        bodyRadiusWorld: number
        distanceWorld: number
        viewportHeightPx: number
        fov: number
      }
    | undefined

  const anim: Record<ElementKey, ElementAnim> = {
    z: { value: 0, startValue: 0, targetValue: 0, startMs: 0, durationMs: 1 },
    ring: { value: 0, startValue: 0, targetValue: 0, startMs: 0, durationMs: 1 },
    x: { value: 0, startValue: 0, targetValue: 0, startMs: 0, durationMs: 1 },
    y: { value: 0, startValue: 0, targetValue: 0, startMs: 0, durationMs: 1 },
  }

  const getNowMs = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now())

  // Used to force at least one RAF cycle after hover/selection changes so we
  // can schedule tweens inside `syncToCamera`.
  //
  // IMPORTANT: this must be time-bound so it can't keep an invalidation RAF
  // loop alive indefinitely if rendering pauses.
  let needsSyncUntilMs = 0

  const markNeedsSync = () => {
    // Give the renderer a short window to pick up the new target and schedule
    // fade tweens. If rendering is paused, this will self-clear.
    const ttlMs = 250
    const now = getNowMs()
    needsSyncUntilMs = Math.max(needsSyncUntilMs, now + ttlMs)
  }

  const getActive = () => {
    if (selectedTarget) return { mode: 'selected' as const, target: selectedTarget }
    if (hoveredTarget) return { mode: 'hovered' as const, target: hoveredTarget }
    return { mode: 'none' as const, target: undefined }
  }

  const computeZoomTier = (opts: {
    bodyRadiusWorld: number
    camera: THREE.PerspectiveCamera
    viewportHeightPx: number
    distanceWorld: number
  }) => {
    const { bodyRadiusWorld, camera, viewportHeightPx, distanceWorld } = opts
    const wpp = computeWorldPerPixel({ camera, distanceWorld, viewportHeightPx })
    const bodyRadiusPx = wpp > 1e-12 ? bodyRadiusWorld / wpp : 0

    if (bodyRadiusPx <= tuning.farBodyRadiusPx) return 'far' as const
    if (bodyRadiusPx <= tuning.midBodyRadiusPx) return 'mid' as const
    return 'close' as const
  }

  const computeDesiredOpacities = (mode: OverlayMode, zoom: ZoomTier) => {
    if (mode === 'none') {
      return { z: 0, ring: 0, x: 0, y: 0 }
    }

    if (mode === 'hovered') {
      const z = tuning.hovered[zoom].z
      return { z, ring: 0, x: 0, y: 0 }
    }

    const tier = tuning.selected[zoom]
    return {
      z: tier.z,
      ring: tier.ring,
      x: tier.xy,
      y: tier.xy,
    }
  }

  const scheduleModeTransition = (
    nowMs: number,
    mode: OverlayMode,
    desired: ReturnType<typeof computeDesiredOpacities>,
  ) => {
    if (mode === 'selected') {
      schedule(anim.z, nowMs, desired.z, tuning.selectFadeMs)
      schedule(anim.ring, nowMs + tuning.selectRingDelayMs, desired.ring, tuning.selectFadeMs)
      schedule(anim.x, nowMs + tuning.selectAxesDelayMs, desired.x, tuning.selectFadeMs)
      schedule(anim.y, nowMs + tuning.selectAxesDelayMs, desired.y, tuning.selectFadeMs)
    } else {
      const fadeMs = tuning.hoverFadeMs
      schedule(anim.z, nowMs, desired.z, fadeMs)
      schedule(anim.ring, nowMs, desired.ring, fadeMs)
      schedule(anim.x, nowMs, desired.x, fadeMs)
      schedule(anim.y, nowMs, desired.y, fadeMs)
    }
  }

  const applySizing = (opts: {
    bodyRadiusWorld: number
    camera: THREE.PerspectiveCamera
    viewportHeightPx: number
    distanceWorld: number
  }) => {
    const { bodyRadiusWorld, camera, viewportHeightPx, distanceWorld } = opts

    const safeDistanceWorld = Number.isFinite(distanceWorld) && distanceWorld > 0 ? distanceWorld : 1

    const wpp = computeWorldPerPixel({ camera, distanceWorld: safeDistanceWorld, viewportHeightPx })

    const bodyRadiusPx = wpp > 1e-12 ? bodyRadiusWorld / wpp : 0

    const basePx = bodyRadiusPx * tuning.axisExtentRadiusMult
    const minPx = tuning.axisMinPx
    const maxPx = tuning.axisMaxPx

    const extraT =
      tuning.axisMaxExtraEndBodyRadiusPx > tuning.axisMaxExtraStartBodyRadiusPx
        ? (bodyRadiusPx - tuning.axisMaxExtraStartBodyRadiusPx) /
          (tuning.axisMaxExtraEndBodyRadiusPx - tuning.axisMaxExtraStartBodyRadiusPx)
        : 0
    const maxExtraPx = tuning.axisMaxExtraPx * smoothstep(extraT)

    const axisExtentPx = softClampMax(Math.max(basePx, minPx), maxPx, maxExtraPx)
    const axisExtentWorld = axisExtentPx * wpp

    axesGroup.scale.setScalar(axisExtentWorld)

    const ringScale = axisExtentWorld * tuning.ringRadiusMult
    ringNear.scale.setScalar(ringScale)
    ringFar.scale.setScalar(ringScale)

    // Start axis halves just outside the body, so we don't draw the segment that
    // would be embedded inside the planet.
    const surfaceGapWorld = bodyRadiusWorld * tuning.axisSurfaceGapRadiusMult
    const startWorld = bodyRadiusWorld + surfaceGapWorld
    let startUnit = axisExtentWorld > 1e-12 ? startWorld / axisExtentWorld : 0
    if (!Number.isFinite(startUnit)) startUnit = 0

    // If the cut-out would eat most of the axis, disable it to preserve
    // readability at small sizes.
    if (startUnit > 0.82) startUnit = 0
    startUnit = THREE.MathUtils.clamp(startUnit, 0, 0.995)

    const segScale = Math.max(1e-3, 1 - startUnit)
    const applyStart = (axis: { pos: Line2; neg: Line2 }) => {
      axis.pos.scale.set(segScale, 1, 1)
      axis.pos.position.set(startUnit, 0, 0)
      axis.neg.scale.set(segScale, 1, 1)
      axis.neg.position.set(-startUnit, 0, 0)
    }

    applyStart(xAxis)
    applyStart(yAxis)
    applyStart(zAxis)
  }

  const syncToCamera = ({
    camera,
    nowMs,
    viewportHeightPx,
  }: {
    camera: THREE.PerspectiveCamera
    nowMs: number
    viewportHeightPx: number
  }) => {
    // Clear any pending "force RAF" state as soon as we get a sync.
    needsSyncUntilMs = 0

    const { mode, target } = getActive()

    // Update pose from active target if we have one.
    if (target) {
      target.getWorldPosition(tmpTargetPos)
      target.getWorldQuaternion(tmpTargetQuat)
      object.position.copy(tmpTargetPos)
      object.quaternion.copy(tmpTargetQuat)

      // Body meshes are uniformly scaled by radiusWorld.
      target.getWorldScale(tmpScale)
      const r = maxComponent(tmpScale)
      if (Number.isFinite(r) && r > 0) {
        lastBodyRadiusWorld = r
      }

      const d = camera.position.distanceTo(object.position)
      if (Number.isFinite(d) && d > 0) {
        lastDistanceWorld = d
      }
    }

    // If we're fully hidden and we have no active target, bail early.
    const anyVisible = anim.z.value > 1e-3 || anim.ring.value > 1e-3 || anim.x.value > 1e-3 || anim.y.value > 1e-3
    if (!target && !anyVisible) {
      object.visible = false
      return
    }

    object.visible = true

    const zoomTier = target
      ? computeZoomTier({
          bodyRadiusWorld: lastBodyRadiusWorld,
          camera,
          viewportHeightPx,
          distanceWorld: lastDistanceWorld,
        })
      : (lastZoomTier ?? 'mid')
    const desired = computeDesiredOpacities(mode, zoomTier)

    const modeOrTargetChanged = mode !== activeMode || target !== activeTarget
    const zoomChanged = zoomTier !== lastZoomTier

    if (modeOrTargetChanged) {
      activeMode = mode
      activeTarget = target
      lastZoomTier = zoomTier

      scheduleModeTransition(nowMs, mode, desired)
    } else if (zoomChanged) {
      lastZoomTier = zoomTier
      // Camera zoom tier changes should feel responsive, but not pop.
      const quick = 80
      schedule(anim.z, nowMs, desired.z, quick)
      schedule(anim.ring, nowMs, desired.ring, quick)
      schedule(anim.x, nowMs, desired.x, quick)
      schedule(anim.y, nowMs, desired.y, quick)
    }

    // Evaluate animations.
    evalAnim(anim.z, nowMs)
    evalAnim(anim.ring, nowMs)
    evalAnim(anim.x, nowMs)
    evalAnim(anim.y, nowMs)

    // Compute camera direction in overlay-local coordinates so we can attenuate
    // far-side segments and orient the ring arc.
    tmpInvOverlayQuat.copy(object.quaternion).invert()
    tmpCamLocal.copy(camera.position).sub(object.position).applyQuaternion(tmpInvOverlayQuat)

    const setAxisHalfOpacities = (opts: {
      v: number
      posMat: LineMaterial
      negMat: LineMaterial
      axisDot: number
      farMult: number
    }) => {
      const posIsNear = opts.axisDot >= 0
      opts.posMat.opacity = opts.v * (posIsNear ? 1 : opts.farMult)
      opts.negMat.opacity = opts.v * (posIsNear ? opts.farMult : 1)
    }

    setAxisHalfOpacities({
      v: anim.z.value,
      posMat: zPosMaterial,
      negMat: zNegMaterial,
      axisDot: tmpCamLocal.z,
      farMult: tuning.farSideOpacityMult.z,
    })

    setAxisHalfOpacities({
      v: anim.x.value,
      posMat: xPosMaterial,
      negMat: xNegMaterial,
      axisDot: tmpCamLocal.x,
      farMult: tuning.farSideOpacityMult.xy,
    })

    setAxisHalfOpacities({
      v: anim.y.value,
      posMat: yPosMaterial,
      negMat: yNegMaterial,
      axisDot: tmpCamLocal.y,
      farMult: tuning.farSideOpacityMult.xy,
    })

    ringNearMaterial.opacity = anim.ring.value
    ringFarMaterial.opacity = anim.ring.value * tuning.farSideOpacityMult.ring

    // Visibility flags.
    xAxis.group.visible = anim.x.value > 1e-3
    yAxis.group.visible = anim.y.value > 1e-3
    ringNear.visible = anim.ring.value > 1e-3
    ringFar.visible = anim.ring.value > 1e-3

    // Orient the ring arc to face the camera (within the equatorial plane).
    tmpCamLocalXY.copy(tmpCamLocal)
    tmpCamLocalXY.z = 0
    const phi = tmpCamLocalXY.lengthSq() > 1e-10 ? Math.atan2(tmpCamLocalXY.y, tmpCamLocalXY.x) : 0
    ringNear.rotation.z = phi
    ringFar.rotation.z = phi + Math.PI

    // Avoid wasting work when fully hidden.
    const nextAnyVisible = anim.z.value > 1e-3 || anim.ring.value > 1e-3 || anim.x.value > 1e-3 || anim.y.value > 1e-3
    if (!nextAnyVisible) {
      object.visible = false
      return
    }

    const nextSizing = {
      bodyRadiusWorld: lastBodyRadiusWorld,
      distanceWorld: lastDistanceWorld,
      viewportHeightPx,
      fov: camera.fov,
    }

    const nearlyEqual = (a: number, b: number) => {
      const eps = 1e-4
      return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))
    }

    const sizingUnchanged =
      lastSizing &&
      nearlyEqual(lastSizing.bodyRadiusWorld, nextSizing.bodyRadiusWorld) &&
      nearlyEqual(lastSizing.distanceWorld, nextSizing.distanceWorld) &&
      lastSizing.viewportHeightPx === nextSizing.viewportHeightPx &&
      lastSizing.fov === nextSizing.fov

    if (!sizingUnchanged) {
      lastSizing = nextSizing
      applySizing({
        bodyRadiusWorld: lastBodyRadiusWorld,
        camera,
        viewportHeightPx,
        distanceWorld: lastDistanceWorld,
      })
    }
  }

  const setSelectedTarget = (mesh: THREE.Object3D | undefined) => {
    if (selectedTarget === mesh) return
    selectedTarget = mesh

    // Ensure we get at least one render so we can schedule fades.
    markNeedsSync()
  }

  const setHoveredTarget = (mesh: THREE.Object3D | undefined) => {
    if (hoveredTarget === mesh) return
    hoveredTarget = mesh

    // Ensure we get at least one render so we can schedule fades.
    markNeedsSync()
  }

  const isTrackActive = (track: ElementAnim, nowMs: number) => {
    return getTrackPhase(track, nowMs).kind !== 'inactive'
  }

  // IMPORTANT: keep semantics tight here so the caller's RAF invalidation loop
  // can stop when there are no active tweens.
  const isAnimating = (nowMs: number) =>
    nowMs < needsSyncUntilMs ||
    isTrackActive(anim.z, nowMs) ||
    isTrackActive(anim.ring, nowMs) ||
    isTrackActive(anim.x, nowMs) ||
    isTrackActive(anim.y, nowMs)

  const setResolution = (widthPx: number, heightPx: number) => {
    resolution.set(Math.max(1, widthPx), Math.max(1, heightPx))
    zPosMaterial.resolution.copy(resolution)
    zNegMaterial.resolution.copy(resolution)
    ringNearMaterial.resolution.copy(resolution)
    ringFarMaterial.resolution.copy(resolution)
    xPosMaterial.resolution.copy(resolution)
    xNegMaterial.resolution.copy(resolution)
    yPosMaterial.resolution.copy(resolution)
    yNegMaterial.resolution.copy(resolution)
  }

  const resetTrack = (track: ElementAnim) => {
    track.value = 0
    track.startValue = 0
    track.targetValue = 0
    track.startMs = 0
    track.durationMs = 0
  }

  const dispose = () => {
    // Teardown hardening: ensure callers can't accidentally keep "ghost" overlay
    // state around after disposing the object.
    selectedTarget = undefined
    hoveredTarget = undefined
    activeMode = 'none'
    activeTarget = undefined
    lastZoomTier = undefined
    lastSizing = undefined

    resetTrack(anim.z)
    resetTrack(anim.ring)
    resetTrack(anim.x)
    resetTrack(anim.y)
    needsSyncUntilMs = 0

    object.visible = false

    unitSegGeom.dispose()
    ringNearGeom.dispose()
    ringFarGeom.dispose()
    zPosMaterial.dispose()
    zNegMaterial.dispose()
    ringNearMaterial.dispose()
    ringFarMaterial.dispose()
    xPosMaterial.dispose()
    xNegMaterial.dispose()
    yPosMaterial.dispose()
    yNegMaterial.dispose()
  }

  return {
    object,
    setSelectedTarget,
    setHoveredTarget,
    isAnimating,
    setResolution,
    syncToCamera,
    dispose,
  }
}
