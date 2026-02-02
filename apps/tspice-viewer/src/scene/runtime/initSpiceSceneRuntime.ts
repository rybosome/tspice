import * as THREE from 'three'

import { computeOrbitAnglesToKeepPointInView, isDirectionWithinFov } from '../../controls/sunFocus.js'
import { createSpiceClient } from '../../spice/createSpiceClient.js'
import {
  J2000_FRAME,
  type BodyRef,
  type EtSeconds,
  type FrameId,
  type SpiceClient,
  type Vec3Km,
} from '../../spice/SpiceClient.js'
import { createBodyMesh } from '../BodyMesh.js'
import { BODY_REGISTRY, getBodyRegistryEntry, listDefaultVisibleSceneBodies, type BodyId } from '../BodyRegistry.js'
import { computeBodyRadiusWorld } from '../bodyScaling.js'
import { createFrameAxes, mat3ToMatrix4 } from '../FrameAxes.js'
import { createRingMesh } from '../RingMesh.js'
import { OrbitPaths } from '../orbits/OrbitPaths.js'
import { rebasePositionKm } from '../precision.js'
import type { SceneModel } from '../SceneModel.js'
import { LabelOverlay, type LabelBody, type LabelOverlayUpdateOptions } from '../../labels/LabelOverlay.js'
import { timeStore } from '../../time/timeStore.js'
import { computeViewerScrubRangeEt } from '../../time/viewerTimeBounds.js'
import { installTspiceViewerE2eApi } from '../../e2eHooks/index.js'
import type { CameraController, CameraControllerState } from '../../controls/CameraController.js'

export type SceneUiState = {
  etSec: EtSeconds
  focusBody: BodyRef
  showJ2000Axes: boolean
  showBodyFixedAxes: boolean
  cameraFovDeg: number
  sunScaleMultiplier: number
  planetScaleMultiplier: number

  orbitLineWidthPx: number
  orbitSamplesPerOrbit: number
  orbitMaxTotalPoints: number
  orbitPathsEnabled: boolean
  labelsEnabled: boolean
  labelOcclusionEnabled: boolean
}

export type SpiceSceneRuntime = {
  spiceClient: SpiceClient
  updateScene: (next: SceneUiState) => void
  afterRender: () => void
  onDrawingBufferResize: (bufferSize: { width: number; height: number }) => void
  dispose: () => void
  pickables: THREE.Mesh[]
}

export async function initSpiceSceneRuntime(args: {
  isE2e: boolean
  searchParams: URLSearchParams
  initialUtc: string | null
  initialEt: number | null

  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controller: CameraController
  container: HTMLDivElement

  /** Populated with body meshes for picking (shared with interaction + labels). */
  pickables: THREE.Mesh[]

  /** Called as soon as the (cached) SpiceClient is ready. */
  onSpiceClientLoaded?: (client: SpiceClient) => void

  kmToWorld: number
  sunOcclusionMarginRad: number

  computeFocusRadius: (radiusWorld: number) => number

  cancelFocusTween: (() => void) | undefined
  focusOn: ((nextTarget: THREE.Vector3, opts?: { radius?: number; immediate?: boolean }) => void) | undefined

  /** Called during auto-focus for non-home presets. */
  resetLookOffset: (() => void) | undefined

  getHomePresetState: (focusBody: BodyRef) => CameraControllerState | null
  initialControllerStateRef: { current: CameraControllerState | null }

  selectedBodyIdRef: { current: BodyId | undefined }

  invalidate: () => void

  /** Used to abort init if the React effect unmounts mid-async. */
  isDisposed: () => boolean
}): Promise<SpiceSceneRuntime> {
  const {
    isE2e,
    searchParams,
    initialUtc,
    initialEt,
    scene,
    camera,
    controller,
    container,
    pickables,
    onSpiceClientLoaded,
    kmToWorld,
    sunOcclusionMarginRad,
    computeFocusRadius,
    cancelFocusTween,
    focusOn,
    resetLookOffset,
    getHomePresetState,
    initialControllerStateRef,
    selectedBodyIdRef,
    invalidate,
    isDisposed,
  } = args

  // Resource cleanup list
  const sceneObjects: THREE.Object3D[] = []
  const disposers: Array<() => void> = []

  // Lighting (owned by the scene runtime)
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  sceneObjects.push(ambient)

  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(4, 6, 2)
  scene.add(dir)
  sceneObjects.push(dir)

  const {
    client: loadedSpiceClient,
    rawClient: rawSpiceClient,
    utcToEt,
  } = await createSpiceClient({
    searchParams,
  })

  onSpiceClientLoaded?.(loadedSpiceClient)

  if (isDisposed()) {
    // Best-effort cleanup of any scene-owned objects created so far.
    for (const obj of sceneObjects) scene.remove(obj)
    for (const dispose of disposers) dispose()
    throw new Error('SceneCanvas disposed during SPICE init')
  }

  // IMPORTANT: set the viewer's scrub range only after kernels load so
  // `utcToEt` (SPICE `str2et`) is correct.
  //
  // Also: do this *before* applying URL `?utc=`/`?et=` overrides, because
  // `timeStore.setEtSec` clamps to the current scrub range.
  const scrubRange = computeViewerScrubRangeEt({ utcToEt })
  if (scrubRange) timeStore.setScrubRange(scrubRange.minEtSec, scrubRange.maxEtSec)

  // Allow the URL to specify UTC for quick testing, but keep the slider
  // driven by numeric ET.
  if (initialUtc) {
    const nextEt = utcToEt(initialUtc)
    if (!isDisposed()) timeStore.setEtSec(nextEt)
  }

  // Parse initial ET from URL if provided
  if (initialEt != null) {
    if (!isDisposed()) timeStore.setEtSec(initialEt)
  }

  if (!isDisposed()) {
    const disposeE2e = installTspiceViewerE2eApi({ isE2e, spiceClient: loadedSpiceClient })
    disposers.push(disposeE2e)
  }

  // Scene model driving the rendered scene.
  // TODO(#119): Temporary special-case to always render Earth's Moon.
  // Longer-term we should have user-configurable visibility + kernel-pack
  // downloads for moons/satellites.
  const moonEntry = getBodyRegistryEntry('MOON')
  const sceneModel: SceneModel = {
    frame: J2000_FRAME,
    // Use a stable observer for all SPICE queries, then apply a precision
    // strategy in the renderer (focus-origin rebasing).
    observer: 'SUN',
    bodies: [
      ...listDefaultVisibleSceneBodies(),
      {
        body: moonEntry.body,
        bodyFixedFrame: moonEntry.bodyFixedFrame,
        style: moonEntry.style,
      },
    ],
  }

  const bodies = sceneModel.bodies.map((body) => {
    const registry = BODY_REGISTRY.find((r) => String(r.body) === String(body.body))

    const { mesh, dispose, ready, update } = createBodyMesh({
      bodyId: registry?.id,
      color: body.style.color,
      textureColor: body.style.textureColor,
      textureUrl: body.style.textureUrl,
      textureKind: body.style.textureKind,
      earthAppearance: body.style.earthAppearance,
    })

    const rings = body.style.rings
    const ringResult = rings
      ? createRingMesh({
          // Parent body is a unit sphere scaled by radius, so rings are
          // specified in planet-radius units.
          innerRadius: rings.innerRadiusRatio,
          outerRadius: rings.outerRadiusRatio,
          textureUrl: rings.textureUrl,
          color: rings.color,
          baseOpacity: rings.baseOpacity,
        })
      : undefined

    if (ringResult) {
      // Attach as a child so it inherits the body's pose and scale.
      mesh.add(ringResult.mesh)
      disposers.push(ringResult.dispose)
    }

    mesh.userData.bodyId = body.body
    // Store radiusKm for dynamic scale updates
    mesh.userData.radiusKm = body.style.radiusKm

    pickables.push(mesh)
    sceneObjects.push(mesh)
    disposers.push(dispose)
    scene.add(mesh)

    const axes = !isE2e && body.bodyFixedFrame ? createFrameAxes({ sizeWorld: 0.45, opacity: 0.9 }) : undefined

    if (axes) {
      axes.object.visible = false
      sceneObjects.push(axes.object)
      disposers.push(axes.dispose)
      scene.add(axes.object)
    }

    return {
      body: body.body,
      bodyFixedFrame: body.bodyFixedFrame,
      radiusKm: body.style.radiusKm,
      mesh,
      axes,
      update,
      ready: Promise.all([ready, ringResult?.ready]).then(() => undefined),
    }
  })

  // Ensure textures are loaded before we mark the scene as rendered.
  await Promise.all(bodies.map((b) => b.ready))

  if (isDisposed()) {
    for (const obj of sceneObjects) scene.remove(obj)
    for (const dispose of disposers) dispose()
    throw new Error('SceneCanvas disposed during scene asset init')
  }

  // Orbit paths (one full orbital period per body).
  const orbitPaths = new OrbitPaths({
    spiceClient: rawSpiceClient,
    kmToWorld,
    bodies: sceneModel.bodies.map((b) => ({ body: b.body, color: b.style.color })),
  })
  sceneObjects.push(orbitPaths.object)
  disposers.push(() => orbitPaths.dispose())
  scene.add(orbitPaths.object)

  const j2000Axes = !isE2e ? createFrameAxes({ sizeWorld: 1.2, opacity: 0.9 }) : undefined
  if (j2000Axes) {
    j2000Axes.object.visible = false
    sceneObjects.push(j2000Axes.object)
    disposers.push(j2000Axes.dispose)
    scene.add(j2000Axes.object)
  }

  // Label overlay (only in interactive mode)
  let labelOverlay: LabelOverlay | null = null
  if (!isE2e) {
    labelOverlay = new LabelOverlay({
      container,
      camera,
      kmToWorld,
    })

    disposers.push(() => {
      labelOverlay?.dispose()
      labelOverlay = null
    })
  }

  let latestLabelOverlayOptions: LabelOverlayUpdateOptions | null = null

  const afterRender = () => {
    if (!labelOverlay || !latestLabelOverlayOptions) return

    // Keep selection in sync even when simulation time is paused.
    labelOverlay.update({
      ...latestLabelOverlayOptions,
      selectedBodyId: selectedBodyIdRef.current,
    })
  }

  const labelBodies: LabelBody[] = bodies.map((b) => {
    const registry = BODY_REGISTRY.find((r) => String(r.body) === String(b.body))
    return {
      id: (registry?.id ?? String(b.body)) as BodyId,
      label: registry?.style.label ?? String(b.body),
      kind: registry?.kind ?? 'planet',
      mesh: b.mesh,
      radiusKm: b.radiusKm,
    }
  })

  let lastAutoZoomFocusBody: BodyRef | undefined

  const bodyPosKmByKey = new Map<string, Vec3Km>()
  const bodyVisibleByKey = new Map<string, boolean>()

  const ORBIT_MIN_POINTS_PER_ORBIT = 32

  const updateScene = (next: SceneUiState) => {
    const shouldAutoZoom = !isE2e && next.focusBody !== lastAutoZoomFocusBody

    const homePreset = shouldAutoZoom ? getHomePresetState(next.focusBody) : null

    if (shouldAutoZoom) {
      cancelFocusTween?.()

      // Clear look offset when auto-focusing a new body.
      // Home presets supply their own look offset, so don't wipe it.
      if (!homePreset) {
        resetLookOffset?.()
      }
    }

    const focusState = loadedSpiceClient.getBodyState({
      target: next.focusBody,
      observer: sceneModel.observer,
      frame: sceneModel.frame,
      et: next.etSec,
    })
    const focusPosKm = focusState.positionKm

    if (shouldAutoZoom) {
      // Home preset beats the normal auto-zoom + sun-in-view heuristics.
      if (homePreset) {
        controller.restore(homePreset)
        controller.applyToCamera(camera)

        // Capture the initial camera view (after first focus logic runs)
        // so keyboard Reset (R) can return exactly to the page-load view.
        if (!initialControllerStateRef.current) {
          initialControllerStateRef.current = controller.snapshot()
        }

        lastAutoZoomFocusBody = next.focusBody
      } else {
        const focusBodyMeta = bodies.find((b) => String(b.body) === String(next.focusBody))
        if (focusBodyMeta) {
          let radiusWorld = computeBodyRadiusWorld({
            radiusKm: focusBodyMeta.radiusKm,
            kmToWorld,
            mode: 'true',
          })

          // Match the rendered size when auto-zooming.
          radiusWorld *= String(next.focusBody) === 'SUN' ? next.sunScaleMultiplier : next.planetScaleMultiplier

          const nextRadius = computeFocusRadius(radiusWorld)

          // When focusing a non-Sun body, bias the camera orientation so the
          // Sun remains visible (it provides important spatial context).
          if (String(next.focusBody) !== 'SUN') {
            const sunPosWorld = new THREE.Vector3(
              -focusPosKm[0] * kmToWorld,
              -focusPosKm[1] * kmToWorld,
              -focusPosKm[2] * kmToWorld,
            )

            if (sunPosWorld.lengthSq() > 1e-12) {
              const sunDir = sunPosWorld.clone().normalize()

              // Current forward direction (camera -> target) derived from the
              // controller's yaw/pitch (target/radius don't affect direction).
              const cosPitch = Math.cos(controller.pitch)
              const currentOffsetDir = new THREE.Vector3(
                cosPitch * Math.cos(controller.yaw),
                cosPitch * Math.sin(controller.yaw),
                Math.sin(controller.pitch),
              )
              const currentForwardDir = currentOffsetDir.multiplyScalar(-1).normalize()

              // Use the same angular margin for both frustum checks and for
              // ensuring the Sun isn't hidden behind the focused body.
              const marginRad = sunOcclusionMarginRad

              // If the Sun is too close to the view center, it can be
              // completely occluded by the focused body (which is centered
              // at the camera target). So we require the Sun to be separated
              // from center by more than the body's angular radius.
              const bodyAngRad = Math.asin(THREE.MathUtils.clamp(radiusWorld / nextRadius, 0, 1))
              const minSeparationRad = bodyAngRad + marginRad

              const sunAngle = currentForwardDir.angleTo(sunDir)
              const sunInFov = isDirectionWithinFov({
                cameraForwardDir: currentForwardDir,
                dirToPoint: sunDir,
                cameraFovDeg: next.cameraFovDeg,
                cameraAspect: camera.aspect,
                marginRad,
              })
              const sunNotOccluded = sunAngle >= minSeparationRad

              if (!sunInFov || !sunNotOccluded) {
                const angles = computeOrbitAnglesToKeepPointInView({
                  pointWorld: sunPosWorld,
                  cameraFovDeg: next.cameraFovDeg,
                  cameraAspect: camera.aspect,
                  desiredOffAxisRad: minSeparationRad,
                  marginRad,
                })

                if (angles) {
                  controller.yaw = angles.yaw
                  controller.pitch = angles.pitch
                }
              }
            }
          }

          // For focus-body selection (dropdown), force the camera to look at
          // the rebased origin and update radius immediately.
          focusOn?.(new THREE.Vector3(0, 0, 0), {
            radius: nextRadius,
            immediate: true,
          })

          // Capture the initial camera view (after first focus logic runs)
          // so keyboard Reset (R) can return exactly to the page-load view.
          if (!initialControllerStateRef.current) {
            initialControllerStateRef.current = controller.snapshot()
          }
        }

        lastAutoZoomFocusBody = next.focusBody
      }
    }

    bodyPosKmByKey.clear()
    bodyVisibleByKey.clear()

    for (const b of bodies) {
      const state = loadedSpiceClient.getBodyState({
        target: b.body,
        observer: sceneModel.observer,
        frame: sceneModel.frame,
        et: next.etSec,
      })

      bodyPosKmByKey.set(String(b.body), state.positionKm)
      bodyVisibleByKey.set(String(b.body), b.mesh.visible)

      const rebasedKm = rebasePositionKm(state.positionKm, focusPosKm)
      b.mesh.position.set(rebasedKm[0] * kmToWorld, rebasedKm[1] * kmToWorld, rebasedKm[2] * kmToWorld)

      // Update mesh scale (true scaling)
      let radiusWorld = computeBodyRadiusWorld({
        radiusKm: b.radiusKm,
        kmToWorld,
        mode: 'true',
      })

      // Apply Sun scale multiplier (Sun only)
      if (String(b.body) === 'SUN') {
        radiusWorld *= next.sunScaleMultiplier
      } else {
        radiusWorld *= next.planetScaleMultiplier
      }

      b.mesh.scale.setScalar(radiusWorld)

      const bodyFixedRotation = b.bodyFixedFrame
        ? loadedSpiceClient.getFrameTransform({
            from: b.bodyFixedFrame as FrameId,
            to: sceneModel.frame,
            et: next.etSec,
          })
        : undefined

      // Apply the body-fixed frame orientation to the mesh so textures
      // rotate with the body.
      if (bodyFixedRotation) {
        b.mesh.setRotationFromMatrix(mat3ToMatrix4(bodyFixedRotation))
      }

      if (b.axes) {
        const visible = next.showBodyFixedAxes && Boolean(b.bodyFixedFrame)
        b.axes.object.visible = visible

        if (visible && b.bodyFixedFrame) {
          b.axes.setPose({ position: b.mesh.position, rotationJ2000: bodyFixedRotation })
        }
      }
    }

    // Update orbit paths after primary/body positions are known.
    if (orbitPaths) {
      orbitPaths.object.visible = next.orbitPathsEnabled
      if (next.orbitPathsEnabled) {
        orbitPaths.update({
          etSec: next.etSec,
          focusPosKm,
          bodyPosKmByKey,
          bodyVisibleByKey,
          settings: {
            lineWidthPx: next.orbitLineWidthPx,
            samplesPerOrbit: next.orbitSamplesPerOrbit,
            maxTotalPoints: next.orbitMaxTotalPoints,
            minPointsPerOrbit: ORBIT_MIN_POINTS_PER_ORBIT,
            antialias: true,
          },
        })
      }
    }

    if (j2000Axes) {
      j2000Axes.object.visible = next.showJ2000Axes
      if (next.showJ2000Axes) {
        j2000Axes.setPose({ position: new THREE.Vector3(0, 0, 0) })
      }
    }

    // SPICE-derived sun lighting direction.
    // We compute the Sun's position relative to the focused body directly from SPICE,
    // making the lighting independent of whether the Sun mesh is visible/filtered.
    // This is computed in the J2000 (scene/world) frame, which keeps lighting consistent
    // across all bodies - a single global sun direction is physically correct and avoids
    // per-body lighting complexity that would add cost without visual benefit.
    const sunStateForLighting = loadedSpiceClient.getBodyState({
      target: 'SUN',
      observer: next.focusBody,
      frame: sceneModel.frame,
      et: next.etSec,
    })
    const sunDirKm = sunStateForLighting.positionKm
    const sunDirVec = new THREE.Vector3(sunDirKm[0], sunDirKm[1], sunDirKm[2])
    const sunDirLen2 = sunDirVec.lengthSq()
    // Normalize and use as directional light position (fallback to +X+Y+Z if degenerate).
    const dirPos = sunDirLen2 > 1e-12 ? sunDirVec.normalize() : new THREE.Vector3(1, 1, 1).normalize()
    // TODO: Eclipse/shadow occlusion could be added here by checking if another body
    // lies along the sun direction, but this adds complexity for marginal visual benefit.
    dir.position.copy(dirPos.multiplyScalar(10))

    // Update any body-specific shader uniforms using the same sun direction.
    const sunDirWorld = dir.position.clone().normalize()
    for (const b of bodies) {
      b.update?.({ sunDirWorld, etSec: next.etSec })
    }

    // Record label overlay inputs so we can update it on camera movement.
    latestLabelOverlayOptions = {
      bodies: labelBodies,
      focusBodyId: BODY_REGISTRY.find((r) => String(r.body) === String(next.focusBody))?.id as BodyId | undefined,
      selectedBodyId: selectedBodyIdRef.current,
      labelsEnabled: next.labelsEnabled,
      occlusionEnabled: next.labelOcclusionEnabled,
      pickables,
      sunScaleMultiplier: next.sunScaleMultiplier,
      planetScaleMultiplier: next.planetScaleMultiplier,
    }

    invalidate()
  }

  const onDrawingBufferResize = ({ width, height }: { width: number; height: number }) => {
    orbitPaths?.setResolution(width, height)
  }

  const dispose = () => {
    latestLabelOverlayOptions = null

    for (const obj of sceneObjects) scene.remove(obj)
    for (const dispose of disposers) dispose()
  }

  return {
    spiceClient: loadedSpiceClient,
    pickables,
    updateScene,
    afterRender,
    onDrawingBufferResize,
    dispose,
  }
}
