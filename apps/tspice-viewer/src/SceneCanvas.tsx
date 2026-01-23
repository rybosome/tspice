import { useEffect, useRef } from 'react'
import * as THREE from 'three'
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

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

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

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 6, 2)
    scene.add(dir)

    // New PR abstractions (SpiceClient + SceneModel) driving the rendered scene.
    const spiceClient = new FakeSpiceClient()
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

    const meshes: THREE.Mesh[] = []
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

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
      mesh.position.set(
        state.positionKm[0] * kmToWorld,
        state.positionKm[1] * kmToWorld,
        state.positionKm[2] * kmToWorld
      )

      meshes.push(mesh)
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
    const helpers: Array<THREE.Object3D> = []
    if (!isE2e) {
      const grid = new THREE.GridHelper(10, 10)
      scene.add(grid)
      helpers.push(grid)

      const axes = new THREE.AxesHelper(2)
      scene.add(axes)
      helpers.push(axes)
    }

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width <= 0 || height <= 0) return

      renderer.setPixelRatio(isE2e ? 1 : Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height, false)

      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    resize()
    renderer.render(scene, camera)

    // Signals to Playwright tests that the WebGL scene has been rendered.
    ;(window as any).__tspice_viewer__rendered_scene = true

    return () => {
      resizeObserver.disconnect()

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
