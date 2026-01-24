import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { CameraController } from './controls/CameraController.js'
import { pickFirstIntersection } from './interaction/pick.js'
import { FakeSpiceClient } from './spice/FakeSpiceClient.js'
import { J2000_FRAME, type EtSeconds } from './spice/SpiceClient.js'
import type { SceneModel } from './scene/SceneModel.js'

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

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const isE2e = search.has('e2e')
    const et: EtSeconds = Number(search.get('et') ?? 0)
    const backend = search.get('backend')

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let disposed = false
    let scheduledFrame: number | null = null
    let cleanupInteractions: (() => void) | undefined

    // Resource cleanup lists.
    const meshes: THREE.Mesh[] = []
    const pickables: THREE.Mesh[] = []
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const helpers: Array<THREE.Object3D> = []

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isE2e,
      powerPreference: 'high-performance',
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

      let selectedBodyId: string | undefined

      let pointerDown:
        | {
            pointerId: number
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

      const onPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return

        pointerDown = {
          pointerId: ev.pointerId,
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

          pointerDown.isDragging = true
          pointerDown.lastX = ev.clientX
          pointerDown.lastY = ev.clientY
          return
        }

        const dx = ev.clientX - pointerDown.lastX
        const dy = ev.clientY - pointerDown.lastY

        pointerDown.lastX = ev.clientX
        pointerDown.lastY = ev.clientY

        controller.yaw -= dx * orbitSensitivity
        controller.pitch -= dy * orbitSensitivity
        controller.applyToCamera(camera)
        invalidate()
      }

      const onPointerUp = (ev: PointerEvent) => {
        if (!pointerDown) return
        if (ev.pointerId !== pointerDown.pointerId) return

        const wasDragging = pointerDown.isDragging
        pointerDown = undefined

        try {
          canvas.releasePointerCapture(ev.pointerId)
        } catch {
          // Ignore cases like pointercancel where the capture is already released.
        }

        if (wasDragging) return

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
        controller.target.copy(target)
        controller.applyToCamera(camera)
        invalidate()
      }

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault()

        controller.radius *= Math.exp(ev.deltaY * wheelZoomScale)
        controller.applyToCamera(camera)
        invalidate()
      }

      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerUp)
      canvas.addEventListener('wheel', onWheel, { passive: false })

      // Ensure listeners/material tweaks are cleaned up.
      cleanupInteractions = () => {
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('wheel', onWheel)

        setSelectedMesh(undefined)
      }
    }

    void (async () => {
      try {
        const spiceClient =
          backend === 'fake'
            ? await (async () => {
                const [{ createSpice }, { createFakeBackend }, { TspiceSpiceClient }] =
                  await Promise.all([
                    import('@rybosome/tspice'),
                    import('@rybosome/tspice-backend-fake'),
                    import('./spice/TspiceSpiceClient.js'),
                  ])

                const spice = await createSpice({
                  backendInstance: createFakeBackend(),
                })

                return new TspiceSpiceClient(spice)
              })()
            : new FakeSpiceClient()

        if (disposed) return

        // New PR abstractions (SpiceClient + SceneModel) driving the rendered scene.
        const sceneModel: SceneModel = {
          frame: J2000_FRAME,
          observer: 'EARTH',
          bodies: [
            {
              body: 'EARTH',
              style: { radiusKm: 6_371, color: '#2a9d8f', label: 'Earth' },
            },
            {
              body: 'MOON',
              style: { radiusKm: 1_737.4, color: '#e9c46a', label: 'Moon' },
            },
          ],
        }

        const kmToWorld = 1 / 1_000_000
        const radiusScale = 50

        for (const body of sceneModel.bodies) {
          const state = spiceClient.getBodyState({
            target: body.body,
            observer: sceneModel.observer,
            frame: sceneModel.frame,
            et,
          })

          const radiusWorld = body.style.radiusKm * kmToWorld * radiusScale
          const geometry = new THREE.SphereGeometry(radiusWorld, 48, 24)
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(body.style.color),
            roughness: 0.9,
            metalness: 0.0,
          })

          const mesh = new THREE.Mesh(geometry, material)
          mesh.userData.bodyId = body.body
          mesh.position.set(
            state.positionKm[0] * kmToWorld,
            state.positionKm[1] * kmToWorld,
            state.positionKm[2] * kmToWorld
          )

          meshes.push(mesh)
          pickables.push(mesh)
          geometries.push(geometry)
          materials.push(material)
          scene.add(mesh)
        }

        // Use the (fake) Sun vector to orient lighting deterministically.
        const sunState = spiceClient.getBodyState({
          target: 'SUN',
          observer: sceneModel.observer,
          frame: sceneModel.frame,
          et,
        })
        const sunDir = new THREE.Vector3(
          sunState.positionKm[0],
          sunState.positionKm[1],
          sunState.positionKm[2]
        ).normalize()
        dir.position.set(sunDir.x * 10, sunDir.y * 10, sunDir.z * 10)

        // Basic orientation helpers are great for local dev, but they introduce
        // lots of thin lines that can make visual snapshots flaky.
        if (!isE2e) {
          const grid = new THREE.GridHelper(10, 10)
          scene.add(grid)
          helpers.push(grid)

          const axes = new THREE.AxesHelper(2)
          scene.add(axes)
          helpers.push(axes)
        }

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

      for (const helper of helpers) {
        scene.remove(helper)

        // GridHelper/AxesHelper use line materials.
        const h = helper as unknown as {
          geometry?: THREE.BufferGeometry
          material?: THREE.Material | THREE.Material[]
        }
        h.geometry?.dispose()
        if (h.material) disposeMaterial(h.material)
      }

      for (const mesh of meshes) scene.remove(mesh)
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()

      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="scene">
      <canvas ref={canvasRef} className="sceneCanvas" />
    </div>
  )
}
