import { useEffect, useRef } from 'react'
import * as THREE from 'three'

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
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f131a')

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    camera.position.set(3, 2, 3)
    camera.lookAt(0, 0, 0)

    const grid = new THREE.GridHelper(10, 10)
    scene.add(grid)

    const axes = new THREE.AxesHelper(2)
    scene.add(axes)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 6, 2)
    scene.add(dir)

    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x4cc9f0 })
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
    scene.add(cube)

    const clock = new THREE.Clock()
    let rafId = 0

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width <= 0 || height <= 0) return

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height, false)

      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const render = () => {
      const t = clock.getElapsedTime()
      cube.rotation.y = t * 0.6
      cube.rotation.x = t * 0.25

      renderer.render(scene, camera)
      rafId = window.requestAnimationFrame(render)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    resize()
    rafId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(rafId)
      resizeObserver.disconnect()

      scene.remove(cube)
      cubeGeometry.dispose()
      cubeMaterial.dispose()

      scene.remove(grid)
      grid.geometry.dispose()
      disposeMaterial(grid.material)

      scene.remove(axes)
      axes.geometry.dispose()
      disposeMaterial(axes.material)

      renderer.dispose()
      // Best-effort context cleanup. Some browsers may ignore this.
      renderer.forceContextLoss?.()
    }
  }, [])

  return (
    <div ref={containerRef} className="scene">
      <canvas ref={canvasRef} className="sceneCanvas" />
    </div>
  )
}
