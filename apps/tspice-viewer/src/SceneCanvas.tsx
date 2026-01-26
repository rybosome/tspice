import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CameraController } from './controls/CameraController.js'
import { pickFirstIntersection } from './interaction/pick.js'
import { createSpiceClient } from './spice/createSpiceClient.js'
import { J2000_FRAME, type BodyRef, type EtSeconds, type FrameId, type SpiceClient } from './spice/SpiceClient.js'
import { createBodyMesh } from './scene/BodyMesh.js'
import { createFrameAxes } from './scene/FrameAxes.js'
import { rebasePositionKm } from './scene/precision.js'
import type { SceneModel } from './scene/SceneModel.js'
import { timeStore } from './time/timeStore.js'
import { usePlaybackTicker } from './time/usePlaybackTicker.js'
import { PlaybackControls } from './ui/PlaybackControls.js'

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

  const search = useMemo(() => new URLSearchParams(window.location.search), [])
  const isE2e = search.has('e2e')
  const enableLogDepth = search.has('logDepth')

  const [focusBody, setFocusBody] = useState<BodyRef>('EARTH')
  const [showJ2000Axes, setShowJ2000Axes] = useState(false)
  const [showBodyFixedAxes, setShowBodyFixedAxes] = useState(false)
  const [spiceClient, setSpiceClient] = useState<SpiceClient | null>(null)

  // Start the playback ticker (handles time advancement)
  usePlaybackTicker()

  const updateSceneRef = useRef<
    | ((next: {
        etSec: EtSeconds
        focusBody: BodyRef
        showJ2000Axes: boolean
        showBodyFixedAxes: boolean
      }) => void)
    | null
  >(null)

  // The renderer/bootstrap `useEffect` is mounted once, so it needs a ref to
  // read the latest UI state when async init completes.
  const latestUiRef = useRef({ focusBody, showJ2000Axes, showBodyFixedAxes })
  latestUiRef.current = { focusBody, showJ2000Axes, showBodyFixedAxes }

  // Subscribe to time store changes and update the scene (without React rerenders)
  useEffect(() => {
    const unsubscribe = timeStore.subscribe(() => {
      const etSec = timeStore.getState().etSec
      updateSceneRef.current?.({ etSec, ...latestUiRef.current })
    })
    return unsubscribe
  }, [])

  // Update scene when UI state changes (focus, axes toggles)
  useEffect(() => {
    const etSec = timeStore.getState().etSec
    updateSceneRef.current?.({ etSec, focusBody, showJ2000Axes, showBodyFixedAxes })
  }, [focusBody, showJ2000Axes, showBodyFixedAxes])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let disposed = false
    let scheduledFrame: number | null = null
    let cleanupInteractions: (() => void) | undefined

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

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000)
    camera.position.set(2.2, 1.4, 2.2)
    camera.lookAt(0, 0, 0)

    const controller = CameraController.fromCamera(camera)

    const renderOnce = () => {
      if (disposed) return
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

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 6, 2)
    scene.add(dir)

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

      const cancelFocusTween = () => {
        if (focusTweenFrame == null) return
        window.cancelAnimationFrame(focusTweenFrame)
        focusTweenFrame = null
      }

      let pointerDown:
        | {
            pointerId: number
            mode: 'orbit' | 'pan'
            startX: number
            startY: number
            lastX: number
            lastY: number
            isDragging: boolean
          }
        | undefined

      let selected:
        | {
            mesh: THREE.Mesh
            material: THREE.MeshStandardMaterial
            prevEmissive: THREE.Color
            prevEmissiveIntensity: number
          }
        | undefined

      const setSelectedMesh = (mesh: THREE.Mesh | undefined) => {
        if (selected?.mesh === mesh) return

        if (selected) {
          selected.material.emissive.copy(selected.prevEmissive)
          selected.material.emissiveIntensity = selected.prevEmissiveIntensity
          selected = undefined
          selectedBodyId = undefined
        }

        if (!mesh) return

        const material = mesh.material
        if (!(material instanceof THREE.MeshStandardMaterial)) return

        selected = {
          mesh,
          material,
          prevEmissive: material.emissive.clone(),
          prevEmissiveIntensity: material.emissiveIntensity,
        }

        selectedBodyId = String(mesh.userData.bodyId ?? '') || undefined

        material.emissive.set('#f1c40f')
        material.emissiveIntensity = 0.8
      }

      const focusOn = (nextTarget: THREE.Vector3) => {
        cancelFocusTween()

        const startTarget = controller.target.clone()
        const endTarget = nextTarget.clone()

        // Skip tiny moves to avoid scheduling unnecessary animation frames.
        if (startTarget.distanceToSquared(endTarget) < 1e-16) {
          controller.target.copy(endTarget)
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
        const isPan = ev.button === 2 || (ev.button === 0 && ev.shiftKey)
        const isOrbit = ev.button === 0 && !ev.shiftKey

        if (!isPan && !isOrbit) return

        ev.preventDefault()

        pointerDown = {
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
        if (!pointerDown) return
        if (ev.pointerId !== pointerDown.pointerId) return

        const totalDx = ev.clientX - pointerDown.startX
        const totalDy = ev.clientY - pointerDown.startY

        if (!pointerDown.isDragging) {
          if (totalDx * totalDx + totalDy * totalDy < clickMoveThresholdPx ** 2) {
            return
          }

          cancelFocusTween()

          pointerDown.isDragging = true
          pointerDown.lastX = ev.clientX
          pointerDown.lastY = ev.clientY
          canvas.style.cursor = 'grabbing'
          return
        }

        const dx = ev.clientX - pointerDown.lastX
        const dy = ev.clientY - pointerDown.lastY

        pointerDown.lastX = ev.clientX
        pointerDown.lastY = ev.clientY

        if (pointerDown.mode === 'orbit') {
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
        if (!pointerDown) return
        if (ev.pointerId !== pointerDown.pointerId) return

        const { isDragging: wasDragging, mode } = pointerDown
        pointerDown = undefined

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

        focusOn(target)
      }

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault()

        cancelFocusTween()

        controller.radius *= Math.exp(ev.deltaY * wheelZoomScale)
        controller.applyToCamera(camera)
        invalidate()
      }

      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerUp)
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

        cancelFocusTween()
        setSelectedMesh(undefined)
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
        const sceneModel: SceneModel = {
          frame: J2000_FRAME,
          // Use a stable observer for all SPICE queries, then apply a precision
          // strategy in the renderer (focus-origin rebasing).
          observer: 'SUN',
          bodies: [
            {
              body: 'SUN',
              style: {
                radiusKm: 695_700,
                radiusScale: 2,
                color: '#ffb703',
                textureKind: 'sun',
                label: 'Sun',
              },
            },
            {
              body: 'EARTH',
              bodyFixedFrame: 'IAU_EARTH',
              style: {
                radiusKm: 6_371,
                radiusScale: 50,
                color: '#2a9d8f',
                textureKind: 'earth',
                label: 'Earth',
              },
            },
            {
              body: 'MOON',
              bodyFixedFrame: 'IAU_MOON',
              style: {
                radiusKm: 1_737.4,
                radiusScale: 70,
                color: '#e9c46a',
                textureKind: 'moon',
                label: 'Moon',
              },
            },
          ],
        }

        const kmToWorld = 1 / 1_000_000

        const bodies = sceneModel.bodies.map((body) => {
          const { mesh, dispose } = createBodyMesh({
            radiusKm: body.style.radiusKm,
            kmToWorld,
            radiusScale: body.style.radiusScale,
            color: body.style.color,
            textureKind: body.style.textureKind,
          })

          mesh.userData.bodyId = body.body

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
            mesh,
            axes,
          }
        })

        const j2000Axes = !isE2e ? createFrameAxes({ sizeWorld: 1.2, opacity: 0.9 }) : undefined
        if (j2000Axes) {
          j2000Axes.object.visible = false
          sceneObjects.push(j2000Axes.object)
          disposers.push(j2000Axes.dispose)
          scene.add(j2000Axes.object)
        }

        const updateScene = (next: {
          etSec: EtSeconds
          focusBody: BodyRef
          showJ2000Axes: boolean
          showBodyFixedAxes: boolean
        }) => {
          const focusState = loadedSpiceClient.getBodyState({
            target: next.focusBody,
            observer: sceneModel.observer,
            frame: sceneModel.frame,
            et: next.etSec,
          })
          const focusPosKm = focusState.positionKm

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

            if (b.axes) {
              const visible = next.showBodyFixedAxes && Boolean(b.bodyFixedFrame)
              b.axes.object.visible = visible

              if (visible && b.bodyFixedFrame) {
                const rot = loadedSpiceClient.getFrameTransform({
                  from: b.bodyFixedFrame as FrameId,
                  to: sceneModel.frame,
                  et: next.etSec,
                })
                b.axes.setPose({ position: b.mesh.position, rotationJ2000: rot })
              }
            }
          }

          if (j2000Axes) {
            j2000Axes.object.visible = next.showJ2000Axes
            if (next.showJ2000Axes) {
              j2000Axes.setPose({ position: new THREE.Vector3(0, 0, 0) })
            }
          }

          // Use the (fake) Sun vector to orient lighting deterministically.
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

      updateSceneRef.current = null

      for (const obj of sceneObjects) scene.remove(obj)
      for (const dispose of disposers) dispose()

      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="scene">
      {!isE2e && spiceClient ? (
        <div className="sceneOverlay">
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
                <option value="EARTH">Earth</option>
                <option value="MOON">Moon</option>
                <option value="SUN">Sun</option>
              </select>
            </label>

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
        </div>
      ) : null}

      <canvas ref={canvasRef} className="sceneCanvas" />
    </div>
  )
}
