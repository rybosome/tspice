import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import * as THREE from 'three'
import { CameraController } from './controls/CameraController.js'
import { pickFirstIntersection } from './interaction/pick.js'
import { createSpiceClient } from './spice/createSpiceClient.js'
import { J2000_FRAME, type BodyRef, type EtSeconds, type FrameId, type SpiceClient } from './spice/SpiceClient.js'
import { createBodyMesh } from './scene/BodyMesh.js'
import { getBodyRegistryEntry, listDefaultVisibleBodies, listDefaultVisibleSceneBodies } from './scene/BodyRegistry.js'
import { computeBodyRadiusWorld } from './scene/bodyScaling.js'
import { createFrameAxes, mat3ToMatrix4 } from './scene/FrameAxes.js'
import { createRingMesh } from './scene/RingMesh.js'
import { createSelectionRing } from './scene/SelectionRing.js'
import { createStarfield } from './scene/Starfield.js'
import { rebasePositionKm } from './scene/precision.js'
import type { SceneModel } from './scene/SceneModel.js'
import { timeStore, useTimeStoreSelector } from './time/timeStore.js'
import { usePlaybackTicker } from './time/usePlaybackTicker.js'
import { PlaybackControls } from './ui/PlaybackControls.js'
import { computeOrbitAnglesToKeepPointInView, isDirectionWithinFov } from './controls/sunFocus.js'


import { HelpOverlay } from './ui/HelpOverlay.js'
function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    for (const m of material) m.dispose()
    return
  }
  material.dispose()
}

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const controllerRef = useRef<CameraController | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const invalidateRef = useRef<(() => void) | null>(null)
  const cancelFocusTweenRef = useRef<(() => void) | null>(null)

  const search = useMemo(() => new URLSearchParams(window.location.search), [])
  const isE2e = search.has('e2e')
  const enableLogDepth = search.has('logDepth')

  const [focusBody, setFocusBody] = useState<BodyRef>('EARTH')
  const [showJ2000Axes, setShowJ2000Axes] = useState(false)
  const [showBodyFixedAxes, setShowBodyFixedAxes] = useState(false)
  const [spiceClient, setSpiceClient] = useState<SpiceClient | null>(null)

  // Advanced tuning sliders (ephemeral, local state only)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [cameraFovDeg, setCameraFovDeg] = useState(50)
  // Sun visual scale multiplier: 1 = true size, >1 = enlarged for visibility.
  // This is ephemeral (not persisted) and only affects the Sun's rendered radius.
  const [sunScaleMultiplier, setSunScaleMultiplier] = useState(1)

  const quantumSec = useTimeStoreSelector((s) => s.quantumSec)

  // Keep these baked-in for now (no user-facing tuning).
  const focusDistanceMultiplier = 4
  const sunOcclusionMarginRad = 0

  const focusOptions = useMemo(() => listDefaultVisibleBodies(), [])

  // Keep renderer units consistent across the app. This matches the value used
  // inside the renderer effect.
  const kmToWorld = 1 / 1_000_000

  // Control pane collapsed state: starts expanded on all screen sizes
  const [overlayOpen, setOverlayOpen] = useState(true)
  const [panModeEnabled, setPanModeEnabled] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const panModeEnabledRef = useRef(panModeEnabled)
  panModeEnabledRef.current = panModeEnabled

  const handleQuantumChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    if (value > 0) {
      timeStore.setQuantumSec(value)
    }
  }, [])

  const zoomBy = (factor: number) => {
    const controller = controllerRef.current
    const camera = cameraRef.current
    if (!controller || !camera) return

    cancelFocusTweenRef.current?.()

    controller.radius *= factor
    controller.applyToCamera(camera)
    invalidateRef.current?.()
  }

  const refocusSun = () => {
    const controller = controllerRef.current
    const camera = cameraRef.current
    if (!controller || !camera || !spiceClient) return

    // If a focus animation is in-flight, stop it so our manual camera move
    // isn't immediately overwritten.
    cancelFocusTweenRef.current?.()

    // If the current focus IS the sun, this button shouldn't do anything.
    if (String(focusBody) === 'SUN') return

    const etSec = timeStore.getState().etSec
    const focusState = spiceClient.getBodyState({
      target: focusBody,
      observer: 'SUN',
      frame: J2000_FRAME,
      et: etSec,
    })

    const focusPosKm = focusState.positionKm
    const sunPosWorld = new THREE.Vector3(
      -focusPosKm[0] * kmToWorld,
      -focusPosKm[1] * kmToWorld,
      -focusPosKm[2] * kmToWorld
    )

    if (sunPosWorld.lengthSq() < 1e-12) return

    const sunDir = sunPosWorld.clone().normalize()

    // Compute current forward direction (camera -> target) derived from yaw/pitch.
    const cosPitch = Math.cos(controller.pitch)
    const currentOffsetDir = new THREE.Vector3(
      cosPitch * Math.cos(controller.yaw),
      Math.sin(controller.pitch),
      cosPitch * Math.sin(controller.yaw)
    )
    const currentForwardDir = currentOffsetDir.multiplyScalar(-1).normalize()

    // No additional Sun margin: just ensure the Sun isn't hidden directly
    // behind the focused body.
    const marginRad = sunOcclusionMarginRad

    // Ensure the Sun's center is offset from screen center by more than the
    // focused body's angular radius, so it can't be fully occluded.
    const focusMeta = focusOptions.find((b) => String(b.body) === String(focusBody))
    const radiusWorld = focusMeta
      ? computeBodyRadiusWorld({
          radiusKm: focusMeta.style.radiusKm,
          kmToWorld,
          mode: 'true',
        })
      : undefined

    const bodyAngRad =
      radiusWorld && controller.radius > 1e-12
        ? Math.asin(THREE.MathUtils.clamp(radiusWorld / controller.radius, 0, 1))
        : 0
    const minSeparationRad = bodyAngRad + marginRad

    // If we're zoomed in too far, it may be geometrically impossible to place
    // the Sun outside the body's projected disk while still staying in-frame.
    // In that case, zoom out just enough to make it possible.
    const halfV = THREE.MathUtils.degToRad(cameraFovDeg) / 2
    const halfH = Math.atan(Math.tan(halfV) * (camera.aspect || 1))
    const half = Math.min(halfV, halfH)
    const maxOffAxis = Math.max(0, half - marginRad)
    const maxDesiredOffAxis = maxOffAxis * 0.8

    if (
      radiusWorld != null &&
      minSeparationRad > maxDesiredOffAxis &&
      maxDesiredOffAxis > marginRad + 1e-6
    ) {
      const maxBodyAng = maxDesiredOffAxis - marginRad
      const minRadiusForBodyAng = radiusWorld / Math.sin(maxBodyAng)
      controller.radius = Math.max(controller.radius, minRadiusForBodyAng)
    }

    const sunAngle = currentForwardDir.angleTo(sunDir)
    const sunInFov = isDirectionWithinFov({
      cameraForwardDir: currentForwardDir,
      dirToPoint: sunDir,
      cameraFovDeg,
      cameraAspect: camera.aspect,
      marginRad,
    })
    const sunNotOccluded = sunAngle >= minSeparationRad

    if (!sunInFov || !sunNotOccluded) {
      const angles = computeOrbitAnglesToKeepPointInView({
        pointWorld: sunPosWorld,
        cameraFovDeg,
        cameraAspect: camera.aspect,
        desiredOffAxisRad: minSeparationRad,
        marginRad,
      })

      if (angles) {
        controller.yaw = angles.yaw
        controller.pitch = angles.pitch
      }
    }

    controller.applyToCamera(camera)
    invalidateRef.current?.()
  }

  // Start the playback ticker (handles time advancement)
  usePlaybackTicker()

  const updateSceneRef = useRef<
    | ((next: {
        etSec: EtSeconds
        focusBody: BodyRef
        showJ2000Axes: boolean
        showBodyFixedAxes: boolean
        cameraFovDeg: number
        sunScaleMultiplier: number
      }) => void)
    | null
  >(null)

  // The renderer/bootstrap `useEffect` is mounted once, so it needs a ref to
  // read the latest UI state when async init completes.
  const latestUiRef = useRef({
    focusBody,
    showJ2000Axes,
    showBodyFixedAxes,
    cameraFovDeg,
    sunScaleMultiplier,
  })
  latestUiRef.current = {
    focusBody,
    showJ2000Axes,
    showBodyFixedAxes,
    cameraFovDeg,
    sunScaleMultiplier,
  }

  // Subscribe to time store changes and update the scene (without React rerenders)
  useEffect(() => {
    const unsubscribe = timeStore.subscribe(() => {
      const etSec = timeStore.getState().etSec
      updateSceneRef.current?.({ etSec, ...latestUiRef.current })
    })
    return unsubscribe
  }, [])

  // Update scene when UI state changes (focus, axes toggles, camera options)
  useEffect(() => {
    const etSec = timeStore.getState().etSec
    updateSceneRef.current?.({
      etSec,
      focusBody,
      showJ2000Axes,
      showBodyFixedAxes,
      cameraFovDeg,
      sunScaleMultiplier,
    })
  }, [focusBody, showJ2000Axes, showBodyFixedAxes, cameraFovDeg, sunScaleMultiplier])

  // Imperatively update camera FOV when the slider changes
  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.fov = cameraFovDeg
    camera.updateProjectionMatrix()
    invalidateRef.current?.()
  }, [cameraFovDeg])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let disposed = false
    let scheduledFrame: number | null = null
    let cleanupInteractions: (() => void) | undefined

    // Focus helpers are only enabled in interactive mode, but we keep the
    // variables in outer scope so scene updates can cancel tweens / adjust zoom.
    let cancelFocusTween: (() => void) | undefined
    let focusOn:
      | ((nextTarget: THREE.Vector3, opts?: { radius?: number; immediate?: boolean }) => void)
      | undefined

    // Resource cleanup + interaction lists.
    const pickables: THREE.Mesh[] = []
    const sceneObjects: THREE.Object3D[] = []
    const disposers: Array<() => void> = []

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isE2e,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: enableLogDepth,
    })

    // Keep e2e snapshots stable by not depending on deviceScaleFactor.
    renderer.setPixelRatio(isE2e ? 1 : Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f131a')

    // NOTE: With `kmToWorld = 1e-6`, outer planets can be several thousand
    // world units away. Keep the far plane large enough so we can render the
    // full default scene (through Neptune).
    const camera = new THREE.PerspectiveCamera(latestUiRef.current.cameraFovDeg, 1, 0.01, 10_000)
    camera.position.set(2.2, 1.4, 2.2)
    camera.lookAt(0, 0, 0)

    const controller = CameraController.fromCamera(camera)

    controllerRef.current = controller
    cameraRef.current = camera

    const starSeed = (() => {
      const fromUrl = search.get('starSeed') ?? search.get('seed')
      if (fromUrl) {
        const parsed = Number(fromUrl)
        if (Number.isFinite(parsed)) return Math.floor(parsed)
      }

      // E2E snapshots must be stable regardless of Math.random overrides.
      return isE2e ? 1 : 1337
    })()

    const starfield = createStarfield({ seed: starSeed })
    sceneObjects.push(starfield.object)
    disposers.push(starfield.dispose)
    scene.add(starfield.object)

    const selectionRing = !isE2e ? createSelectionRing() : undefined
    if (selectionRing) {
      sceneObjects.push(selectionRing.object)
      disposers.push(selectionRing.dispose)
      scene.add(selectionRing.object)
    }

    const renderOnce = () => {
      if (disposed) return
      starfield.syncToCamera(camera)
      selectionRing?.syncToCamera({ camera, nowMs: performance.now() })
      renderer.render(scene, camera)
    }

    const invalidate = () => {
      if (disposed) return
      if (scheduledFrame != null) return

      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = null
        renderOnce()
      })
    }

    invalidateRef.current = invalidate

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 6, 2)
    scene.add(dir)

    // Minimum camera radius for auto-zoom. This used to be quite large, which
    // made small bodies (e.g. Mercury) look tiny when selected from the focus
    // dropdown.
    const focusRadiusMin = 0.02
    const focusRadiusMax = 50

    const computeFocusRadius = (radiusWorld: number) =>
      THREE.MathUtils.clamp(radiusWorld * focusDistanceMultiplier, focusRadiusMin, focusRadiusMax)

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width <= 0 || height <= 0) return

      renderer.setPixelRatio(isE2e ? 1 : Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height, false)

      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const onResize = () => {
      if (disposed) return
      resize()
      invalidate()
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    if (!isE2e) {
      const raycaster = new THREE.Raycaster()

      const clickMoveThresholdPx = 6
      const orbitSensitivity = 0.006
      const wheelZoomScale = 0.001
      const focusTweenMs = 320

      let selectedBodyId: string | undefined

      let focusTweenFrame: number | null = null

      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

      cancelFocusTween = () => {
        if (focusTweenFrame == null) return
        window.cancelAnimationFrame(focusTweenFrame)
        focusTweenFrame = null
      }

      cancelFocusTweenRef.current = cancelFocusTween

      type DragMode = 'orbit' | 'pan'

      let mouseDown:
        | {
            pointerId: number
            mode: DragMode
            startX: number
            startY: number
            lastX: number
            lastY: number
            isDragging: boolean
          }
        | undefined

      const activeTouches = new Map<number, { x: number; y: number }>()
      let touchState:
        | { kind: 'none' }
        | {
            kind: 'single'
            pointerId: number
            mode: DragMode
            startX: number
            startY: number
            lastX: number
            lastY: number
            isDragging: boolean
          }
        | {
            kind: 'pinch'
            ids: [number, number]
            lastCenterX: number
            lastCenterY: number
            lastDistance: number
          } = { kind: 'none' }

      let selected:
        | {
            mesh: THREE.Mesh
          }
        | undefined

      let selectionPulseFrame: number | null = null
      const stopSelectionPulse = () => {
        if (selectionPulseFrame == null) return
        window.cancelAnimationFrame(selectionPulseFrame)
        selectionPulseFrame = null
      }

      const startSelectionPulse = () => {
        if (selectionPulseFrame != null) return

        const step = () => {
          if (disposed || !selected) {
            selectionPulseFrame = null
            return
          }
          invalidate()
          selectionPulseFrame = window.requestAnimationFrame(step)
        }

        selectionPulseFrame = window.requestAnimationFrame(step)
      }

      const setSelectedMesh = (mesh: THREE.Mesh | undefined) => {
        if (selected?.mesh === mesh) return

        if (selected) {
          selected = undefined
          selectedBodyId = undefined
          selectionRing?.setTarget(undefined)
          stopSelectionPulse()
          invalidate()
        }

        if (!mesh) return

        selected = {
          mesh,
        }

        selectedBodyId = String(mesh.userData.bodyId ?? '') || undefined

        // Subtle world-space ring indicator around the selected body.
        selectionRing?.setTarget(mesh)
        startSelectionPulse()
        invalidate()
      }

      focusOn = (nextTarget: THREE.Vector3, opts) => {
        cancelFocusTween?.()

        const startTarget = controller.target.clone()
        const endTarget = nextTarget.clone()

        const startRadius = controller.radius
        const endRadius = opts?.radius ?? startRadius

        const immediate = Boolean(opts?.immediate)

        // Skip tiny moves to avoid scheduling unnecessary animation frames.
        if (immediate || (startTarget.distanceToSquared(endTarget) < 1e-16 && Math.abs(endRadius - startRadius) < 1e-9)) {
          controller.target.copy(endTarget)
          controller.radius = endRadius
          controller.applyToCamera(camera)
          invalidate()
          return
        }

        const startTime = performance.now()

        const step = () => {
          const now = performance.now()
          const t = THREE.MathUtils.clamp((now - startTime) / focusTweenMs, 0, 1)
          const eased = easeInOutCubic(t)

          controller.target.copy(startTarget).lerp(endTarget, eased)
          controller.radius = THREE.MathUtils.lerp(startRadius, endRadius, eased)
          controller.applyToCamera(camera)
          renderOnce()

          if (t >= 1) {
            focusTweenFrame = null
            return
          }

          focusTweenFrame = window.requestAnimationFrame(step)
        }

        focusTweenFrame = window.requestAnimationFrame(step)
      }

      canvas.style.cursor = 'grab'

      const onContextMenu = (ev: MouseEvent) => {
        ev.preventDefault()
      }

      const onPointerDown = (ev: PointerEvent) => {
        if (ev.pointerType === 'touch') {
          ev.preventDefault()

          activeTouches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
          canvas.setPointerCapture(ev.pointerId)

          if (activeTouches.size === 1) {
            touchState = {
              kind: 'single',
              pointerId: ev.pointerId,
              mode: panModeEnabledRef.current ? 'pan' : 'orbit',
              startX: ev.clientX,
              startY: ev.clientY,
              lastX: ev.clientX,
              lastY: ev.clientY,
              isDragging: false,
            }
            return
          }

          if (activeTouches.size >= 2) {
            cancelFocusTween?.()

            const [a, b] = Array.from(activeTouches.entries())
            const ids: [number, number] = [a[0], b[0]]
            const dx = a[1].x - b[1].x
            const dy = a[1].y - b[1].y
            const centerX = (a[1].x + b[1].x) / 2
            const centerY = (a[1].y + b[1].y) / 2
            const dist = Math.sqrt(dx * dx + dy * dy)

            touchState = {
              kind: 'pinch',
              ids,
              lastCenterX: centerX,
              lastCenterY: centerY,
              lastDistance: dist,
            }
            return
          }
        }

        const isPan = ev.button === 2 || (ev.button === 0 && ev.shiftKey)
        const isOrbit = ev.button === 0 && !ev.shiftKey

        if (!isPan && !isOrbit) return

        ev.preventDefault()

        mouseDown = {
          pointerId: ev.pointerId,
          mode: isPan ? 'pan' : 'orbit',
          startX: ev.clientX,
          startY: ev.clientY,
          lastX: ev.clientX,
          lastY: ev.clientY,
          isDragging: false,
        }

        canvas.setPointerCapture(ev.pointerId)
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (ev.pointerType === 'touch') {
          if (!activeTouches.has(ev.pointerId)) return

          ev.preventDefault()
          activeTouches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

          const rect = canvas.getBoundingClientRect()

          if (activeTouches.size >= 2) {
            cancelFocusTween?.()

            // Ensure pinch state if we have 2+ active pointers.
            if (touchState.kind !== 'pinch') {
              const [a, b] = Array.from(activeTouches.entries())
              const dx = a[1].x - b[1].x
              const dy = a[1].y - b[1].y
              touchState = {
                kind: 'pinch',
                ids: [a[0], b[0]],
                lastCenterX: (a[1].x + b[1].x) / 2,
                lastCenterY: (a[1].y + b[1].y) / 2,
                lastDistance: Math.sqrt(dx * dx + dy * dy),
              }
              return
            }

            const a = activeTouches.get(touchState.ids[0])
            const b = activeTouches.get(touchState.ids[1])

            if (!a || !b) {
              // Pick the first two active touches.
              const [na, nb] = Array.from(activeTouches.entries())
              touchState = {
                kind: 'pinch',
                ids: [na[0], nb[0]],
                lastCenterX: (na[1].x + nb[1].x) / 2,
                lastCenterY: (na[1].y + nb[1].y) / 2,
                lastDistance: Math.hypot(na[1].x - nb[1].x, na[1].y - nb[1].y),
              }
              return
            }

            const centerX = (a.x + b.x) / 2
            const centerY = (a.y + b.y) / 2
            const dist = Math.hypot(a.x - b.x, a.y - b.y)

            const centerDx = centerX - touchState.lastCenterX
            const centerDy = centerY - touchState.lastCenterY

            // Two-finger pan is always enabled.
            controller.pan(centerDx, centerDy, camera, { width: rect.width, height: rect.height })

            // Pinch zoom.
            if (dist > 0.5 && touchState.lastDistance > 0.5) {
              const ratio = touchState.lastDistance / dist
              controller.radius *= ratio
            }

            touchState.lastCenterX = centerX
            touchState.lastCenterY = centerY
            touchState.lastDistance = dist

            controller.applyToCamera(camera)
            invalidate()
            return
          }

          if (touchState.kind !== 'single') return
          if (ev.pointerId !== touchState.pointerId) return

          const totalDx = ev.clientX - touchState.startX
          const totalDy = ev.clientY - touchState.startY

          if (!touchState.isDragging) {
            if (totalDx * totalDx + totalDy * totalDy < clickMoveThresholdPx ** 2) {
              return
            }

            cancelFocusTween?.()
            touchState.isDragging = true
            touchState.lastX = ev.clientX
            touchState.lastY = ev.clientY
            return
          }

          const dx = ev.clientX - touchState.lastX
          const dy = ev.clientY - touchState.lastY

          touchState.lastX = ev.clientX
          touchState.lastY = ev.clientY

          if (touchState.mode === 'orbit') {
            controller.yaw -= dx * orbitSensitivity
            controller.pitch -= dy * orbitSensitivity
          } else {
            controller.pan(dx, dy, camera, { width: rect.width, height: rect.height })
          }

          controller.applyToCamera(camera)
          invalidate()
          return
        }

        if (!mouseDown) return
        if (ev.pointerId !== mouseDown.pointerId) return

        const totalDx = ev.clientX - mouseDown.startX
        const totalDy = ev.clientY - mouseDown.startY

        if (!mouseDown.isDragging) {
          if (totalDx * totalDx + totalDy * totalDy < clickMoveThresholdPx ** 2) {
            return
          }

          cancelFocusTween?.()

          mouseDown.isDragging = true
          mouseDown.lastX = ev.clientX
          mouseDown.lastY = ev.clientY
          canvas.style.cursor = 'grabbing'
          return
        }

        const dx = ev.clientX - mouseDown.lastX
        const dy = ev.clientY - mouseDown.lastY

        mouseDown.lastX = ev.clientX
        mouseDown.lastY = ev.clientY

        if (mouseDown.mode === 'orbit') {
          controller.yaw -= dx * orbitSensitivity
          controller.pitch -= dy * orbitSensitivity
        } else {
          const rect = canvas.getBoundingClientRect()
          controller.pan(dx, dy, camera, { width: rect.width, height: rect.height })
        }

        controller.applyToCamera(camera)
        invalidate()
      }

      const onPointerUp = (ev: PointerEvent) => {
        if (ev.pointerType === 'touch') {
          if (!activeTouches.has(ev.pointerId)) return

          ev.preventDefault()

          const wasSingleTap =
            touchState.kind === 'single' &&
            touchState.pointerId === ev.pointerId &&
            !touchState.isDragging &&
            activeTouches.size === 1

          activeTouches.delete(ev.pointerId)

          try {
            canvas.releasePointerCapture(ev.pointerId)
          } catch {
            // Ignore cases like pointercancel where the capture is already released.
          }

          if (wasSingleTap) {
            const hit = pickFirstIntersection({
              clientX: ev.clientX,
              clientY: ev.clientY,
              element: canvas,
              camera,
              pickables,
              raycaster,
            })

            if (!hit) {
              setSelectedMesh(undefined)
              invalidate()
            } else {
              const hitMesh = hit.object
              if (hitMesh instanceof THREE.Mesh) {
                const nextSelectedBodyId = String(hitMesh.userData.bodyId ?? '') || undefined
                if (nextSelectedBodyId !== selectedBodyId) {
                  setSelectedMesh(hitMesh)
                }

                const target = new THREE.Vector3()
                hitMesh.getWorldPosition(target)
                focusOn?.(target)
              }
            }
          }

          if (activeTouches.size === 0) {
            touchState = { kind: 'none' }
            return
          }

          if (activeTouches.size === 1) {
            const [nextId, nextPos] = Array.from(activeTouches.entries())[0]
            touchState = {
              kind: 'single',
              pointerId: nextId,
              mode: panModeEnabledRef.current ? 'pan' : 'orbit',
              startX: nextPos.x,
              startY: nextPos.y,
              lastX: nextPos.x,
              lastY: nextPos.y,
              isDragging: false,
            }
            return
          }

          // 2+ touches: keep pinch state based on first two pointers.
          const [a, b] = Array.from(activeTouches.entries())
          const dx = a[1].x - b[1].x
          const dy = a[1].y - b[1].y
          touchState = {
            kind: 'pinch',
            ids: [a[0], b[0]],
            lastCenterX: (a[1].x + b[1].x) / 2,
            lastCenterY: (a[1].y + b[1].y) / 2,
            lastDistance: Math.sqrt(dx * dx + dy * dy),
          }
          return
        }

        if (!mouseDown) return
        if (ev.pointerId !== mouseDown.pointerId) return

        const { isDragging: wasDragging, mode } = mouseDown
        mouseDown = undefined

        try {
          canvas.releasePointerCapture(ev.pointerId)
        } catch {
          // Ignore cases like pointercancel where the capture is already released.
        }

        canvas.style.cursor = 'grab'

        if (wasDragging) return

        // Only left-click (without shift) selects/focuses.
        if (mode !== 'orbit') return

        const hit = pickFirstIntersection({
          clientX: ev.clientX,
          clientY: ev.clientY,
          element: canvas,
          camera,
          pickables,
          raycaster,
        })

        if (!hit) {
          setSelectedMesh(undefined)
          invalidate()
          return
        }

        const hitMesh = hit.object
        if (!(hitMesh instanceof THREE.Mesh)) return

        const nextSelectedBodyId = String(hitMesh.userData.bodyId ?? '') || undefined
        if (nextSelectedBodyId !== selectedBodyId) {
          setSelectedMesh(hitMesh)
        }

        const target = new THREE.Vector3()
        hitMesh.getWorldPosition(target)

        const radiusKm = Number(hitMesh.userData.radiusKm)
        if (Number.isFinite(radiusKm)) {
          const radiusWorld = computeBodyRadiusWorld({
            radiusKm,
            kmToWorld,
            mode: 'true',
          })
          focusOn?.(target, { radius: computeFocusRadius(radiusWorld) })
        } else {
          focusOn?.(target)
        }
      }

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault()

        cancelFocusTween?.()

        controller.radius *= Math.exp(ev.deltaY * wheelZoomScale)
        controller.applyToCamera(camera)
        invalidate()
      }

      canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
      canvas.addEventListener('pointermove', onPointerMove, { passive: false })
      canvas.addEventListener('pointerup', onPointerUp, { passive: false })
      canvas.addEventListener('pointercancel', onPointerUp, { passive: false })
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('contextmenu', onContextMenu)

      // Ensure listeners/material tweaks are cleaned up.
      cleanupInteractions = () => {
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('contextmenu', onContextMenu)

        cancelFocusTween?.()
        setSelectedMesh(undefined)
        stopSelectionPulse()
      }
    }

    void (async () => {
      try {
        const { client: loadedSpiceClient, utcToEt } = await createSpiceClient({
          searchParams: search,
        })

        // Allow the URL to specify UTC for quick testing, but keep the slider
        // driven by numeric ET.
        const utc = search.get('utc')
        if (utc) {
          const nextEt = utcToEt(utc)
          if (!disposed) timeStore.setEtSec(nextEt)
        }

        // Parse initial ET from URL if provided
        const etParam = search.get('et')
        if (etParam) {
          const parsed = Number(etParam)
          if (Number.isFinite(parsed) && !disposed) {
            timeStore.setEtSec(parsed)
          }
        }

        if (disposed) return

        // Store the spice client for the PlaybackControls
        setSpiceClient(loadedSpiceClient)

        if (isE2e) {
          ;(window as any).__tspice_viewer__e2e = {
            getFrameTransform: ({ from, to, et }: { from: string; to: string; et: number }) =>
              loadedSpiceClient.getFrameTransform({ from, to, et }),
          }
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
          const { mesh, dispose, ready } = createBodyMesh({
            color: body.style.color,
            textureUrl: body.style.textureUrl,
            textureKind: body.style.textureKind,
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

          const axes = !isE2e && body.bodyFixedFrame
            ? createFrameAxes({ sizeWorld: 0.45, opacity: 0.9 })
            : undefined

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
            ready: Promise.all([ready, ringResult?.ready]).then(() => undefined),
          }
        })

        // Ensure textures are loaded before we mark the scene as rendered.
        await Promise.all(bodies.map((b) => b.ready))
        if (disposed) return

        const j2000Axes = !isE2e ? createFrameAxes({ sizeWorld: 1.2, opacity: 0.9 }) : undefined
        if (j2000Axes) {
          j2000Axes.object.visible = false
          sceneObjects.push(j2000Axes.object)
          disposers.push(j2000Axes.dispose)
          scene.add(j2000Axes.object)
        }

        let lastAutoZoomFocusBody: BodyRef | undefined

        const updateScene = (next: {
          etSec: EtSeconds
          focusBody: BodyRef
          showJ2000Axes: boolean
          showBodyFixedAxes: boolean
          cameraFovDeg: number
          sunScaleMultiplier: number
        }) => {
          const shouldAutoZoom =
            !isE2e &&
            next.focusBody !== lastAutoZoomFocusBody

          if (shouldAutoZoom) {
            cancelFocusTween?.()
          }

          const focusState = loadedSpiceClient.getBodyState({
            target: next.focusBody,
            observer: sceneModel.observer,
            frame: sceneModel.frame,
            et: next.etSec,
          })
          const focusPosKm = focusState.positionKm

          if (shouldAutoZoom) {
            const focusBodyMeta = bodies.find((b) => String(b.body) === String(next.focusBody))
            if (focusBodyMeta) {
              const radiusWorld = computeBodyRadiusWorld({
                radiusKm: focusBodyMeta.radiusKm,
                kmToWorld,
                mode: 'true',
              })

              const nextRadius = computeFocusRadius(radiusWorld)

              // When focusing a non-Sun body, bias the camera orientation so the
              // Sun remains visible (it provides important spatial context).
              if (String(next.focusBody) !== 'SUN') {
                const sunPosWorld = new THREE.Vector3(
                  -focusPosKm[0] * kmToWorld,
                  -focusPosKm[1] * kmToWorld,
                  -focusPosKm[2] * kmToWorld
                )

                if (sunPosWorld.lengthSq() > 1e-12) {
                  const sunDir = sunPosWorld.clone().normalize()

                  // Current forward direction (camera -> target) derived from the
                  // controller's yaw/pitch (target/radius don't affect direction).
                  const cosPitch = Math.cos(controller.pitch)
                  const currentOffsetDir = new THREE.Vector3(
                    cosPitch * Math.cos(controller.yaw),
                    Math.sin(controller.pitch),
                    cosPitch * Math.sin(controller.yaw)
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
            }

            lastAutoZoomFocusBody = next.focusBody
          }

          for (const b of bodies) {
            const state = loadedSpiceClient.getBodyState({
              target: b.body,
              observer: sceneModel.observer,
              frame: sceneModel.frame,
              et: next.etSec,
            })

            const rebasedKm = rebasePositionKm(state.positionKm, focusPosKm)
            b.mesh.position.set(
              rebasedKm[0] * kmToWorld,
              rebasedKm[1] * kmToWorld,
              rebasedKm[2] * kmToWorld
            )

            // Update mesh scale (true scaling)
            let radiusWorld = computeBodyRadiusWorld({
              radiusKm: b.radiusKm,
              kmToWorld,
              mode: 'true',
            })

            // Apply Sun scale multiplier (Sun only)
            if (String(b.body) === 'SUN') {
              radiusWorld *= next.sunScaleMultiplier
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

          if (j2000Axes) {
            j2000Axes.object.visible = next.showJ2000Axes
            if (next.showJ2000Axes) {
              j2000Axes.setPose({ position: new THREE.Vector3(0, 0, 0) })
            }
          }

          // Use the Sun vector to orient lighting deterministically.
          const sun = bodies.find((b) => String(b.body) === 'SUN')
          const sunPos = sun?.mesh.position ?? new THREE.Vector3(1, 1, 1)
          const len2 = sunPos.lengthSq()
          const dirPos = len2 > 1e-12 ? sunPos.clone().normalize() : new THREE.Vector3(1, 1, 1).normalize()
          dir.position.copy(dirPos.multiplyScalar(10))

          invalidate()
        }

        updateSceneRef.current = updateScene
        // Initial render with current time store state
        const initialEt = timeStore.getState().etSec
        updateScene({ etSec: initialEt, ...latestUiRef.current })

        resize()
        controller.applyToCamera(camera)
        renderOnce()

        // Signals to Playwright tests that the WebGL scene has been rendered.
        ;(window as any).__tspice_viewer__rendered_scene = true
      } catch (err) {
        // Surface initialization failures to the console so e2e tests can catch them.
        console.error(err)
      }
    })()

    return () => {
      disposed = true
      if (scheduledFrame != null) {
        window.cancelAnimationFrame(scheduledFrame)
        scheduledFrame = null
      }

      resizeObserver.disconnect()

      if (!isE2e) {
        cleanupInteractions?.()
      }

      controllerRef.current = null
      cameraRef.current = null
      invalidateRef.current = null
      cancelFocusTweenRef.current = null

      updateSceneRef.current = null

      for (const obj of sceneObjects) scene.remove(obj)
      for (const dispose of disposers) dispose()

      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="scene">
      {!isE2e && spiceClient ? (
        <div
          className={`sceneOverlay ${overlayOpen ? 'sceneOverlayOpen' : 'sceneOverlayCollapsed'}`}
        >
          <div className="sceneOverlayHeader">
            <div className="sceneOverlayHeaderTitle">Controls</div>

            <button
              className="sceneOverlayToggle"
              onClick={() => setOverlayOpen((v) => !v)}
              type="button"
              aria-expanded={overlayOpen}
              aria-controls="scene-overlay-body"
              aria-label={overlayOpen ? 'Collapse controls' : 'Expand controls'}
            >
              {overlayOpen ? '▲' : '▼'}
            </button>

            <div className="sceneOverlayHeaderActions">
              <button
                className="helpButton"
                onClick={() => setHelpOpen(true)}
                type="button"
                aria-label="What is this?"
                title="What is this?"
              >
                ?
              </button>
              <button
                className={`sceneOverlayButton ${panModeEnabled ? 'sceneOverlayButtonActive' : ''}`}
                aria-pressed={panModeEnabled}
                onClick={() => setPanModeEnabled((v) => !v)}
                type="button"
                title="When enabled, 1-finger drag pans instead of orbiting"
              >
                Drag: {panModeEnabled ? 'Pan' : 'Orbit'}
              </button>
            </div>
          </div>

          {overlayOpen ? (
            <div id="scene-overlay-body" className="sceneOverlayBody">
              <PlaybackControls spiceClient={spiceClient} />

              <div className="sceneOverlayRow" style={{ marginTop: '12px' }}>
                <label className="sceneOverlayLabel">
                  Focus
                  <select
                    value={String(focusBody)}
                    onChange={(e) => {
                      setFocusBody(e.target.value)
                    }}
                  >
                    {focusOptions.map((b) => (
                      <option key={b.id} value={String(b.body)}>
                        {b.style.label ?? b.id}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="sceneOverlayButton"
                  type="button"
                  onClick={refocusSun}
                  disabled={String(focusBody) === 'SUN'}
                  title="Quickly refocus the scene on the Sun"
                >
                  Focus Sun
                </button>

                <label className="sceneOverlayCheckbox">
                  <input
                    type="checkbox"
                    checked={showJ2000Axes}
                    onChange={(e) => setShowJ2000Axes(e.target.checked)}
                  />
                  J2000 axes
                </label>
                <label className="sceneOverlayCheckbox">
                  <input
                    type="checkbox"
                    checked={showBodyFixedAxes}
                    onChange={(e) => setShowBodyFixedAxes(e.target.checked)}
                  />
                  Body-fixed axes
                </label>
              </div>

              {/* Advanced tuning section */}
              <div className="sceneOverlayRow" style={{ marginTop: '8px' }}>
                <button
                  className="sceneOverlayButton"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  type="button"
                >
                  {showAdvanced ? '▼ Advanced' : '▶ Advanced'}
                </button>
              </div>

              {showAdvanced && (
                <div className="sceneOverlayAdvanced" style={{ marginTop: '8px' }}>
                  <div className="sceneOverlayRow">
                    <label className="sceneOverlayLabel" style={{ flex: 1, minWidth: 0 }}>
                      Camera FOV ({cameraFovDeg}°)
                      <input
                        type="range"
                        min={30}
                        max={90}
                        step={1}
                        value={cameraFovDeg}
                        onChange={(e) => setCameraFovDeg(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </label>
                  </div>
                  <div className="sceneOverlayRow">
                    <label className="sceneOverlayLabel" style={{ flex: 1, minWidth: 0 }}>
                      Sun size ({sunScaleMultiplier}×)
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={sunScaleMultiplier}
                        onChange={(e) => setSunScaleMultiplier(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </label>
                  </div>

                  <div className="sceneOverlayRow">
                    <label className="sceneOverlayLabel" style={{ flex: 1, minWidth: 0 }}>
                      Quantum (s)
                      <input
                        type="number"
                        min={0.001}
                        step={0.01}
                        value={quantumSec}
                        onChange={handleQuantumChange}
                        style={{ width: '100%' }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isE2e ? (
        <div className="sceneZoomButtons">
          <button
            className="sceneZoomButton"
            type="button"
            onClick={() => zoomBy(1 / 1.15)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="sceneZoomButton"
            type="button"
            onClick={() => zoomBy(1.15)}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      ) : null}

      <canvas ref={canvasRef} className="sceneCanvas" />

      <HelpOverlay isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
