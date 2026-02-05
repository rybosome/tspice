import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

export type RaDecGuideOverlay = {
  object: THREE.Object3D

  setEnabled: (enabled: boolean) => void
  setTarget: (mesh: THREE.Object3D | undefined) => void

  setResolution: (widthPx: number, heightPx: number) => void

  /**
   * Updates the overlay's pose and scale.
   *
   * The overlay is oriented to the scene's inertial frame (J2000), and is
   * positioned at the selected target's world position.
   */
  syncToCamera: (opts: { camera: THREE.PerspectiveCamera; viewportHeightPx: number }) => void

  dispose: () => void
}

const RA_DEC_GUIDE_TUNING = {
  // Keep this overlay visually subordinate to the selection overlay and axes.
  colors: {
    equator: '#d3dae6',
    grid: '#c6d0df',
  },

  opacity: {
    equator: 0.14,
    grid: 0.09,
  },

  lineWidthPx: {
    equator: 0.85,
    grid: 0.65,
  },

  // A small, stable grid: equator + a few meridians/parallels.
  raMeridiansDeg: [0, 90, 180, 270],
  decParallelsDeg: [-30, 30],

  // Dynamic sizing (in screen pixels).
  // We scale the guide sphere so it's readable at any zoom level.
  radiusPx: {
    baseBodyRadiusMult: 2.0,
    min: 26,
    max: 92,
  },

  segments: 96,
} as const

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

function maxComponent(v: THREE.Vector3) {
  return Math.max(v.x, v.y, v.z)
}

function makeCirclePositions(opts: {
  segments: number
  pointAt: (tRad: number) => THREE.Vector3
}): number[] {
  const n = Math.max(8, Math.floor(opts.segments))
  const positions: number[] = []

  const p = new THREE.Vector3()
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    p.copy(opts.pointAt(t))
    positions.push(p.x, p.y, p.z)
  }

  return positions
}

function makeMeridianPositions(opts: { segments: number; raRad: number }): number[] {
  // Base meridian circle in the XZ plane (y=0) on the unit sphere.
  const base = makeCirclePositions({
    segments: opts.segments,
    pointAt: (t) => new THREE.Vector3(Math.cos(t), 0, Math.sin(t)),
  })

  const rot = new THREE.Matrix4().makeRotationZ(opts.raRad)
  const v = new THREE.Vector3()

  const out: number[] = []
  for (let i = 0; i < base.length; i += 3) {
    v.set(base[i]!, base[i + 1]!, base[i + 2]!).applyMatrix4(rot)
    out.push(v.x, v.y, v.z)
  }

  return out
}

function makeParallelPositions(opts: { segments: number; decRad: number }): number[] {
  const cos = Math.cos(opts.decRad)
  const sin = Math.sin(opts.decRad)

  return makeCirclePositions({
    segments: opts.segments,
    pointAt: (t) => new THREE.Vector3(cos * Math.cos(t), cos * Math.sin(t), sin),
  })
}

export function createRaDecGuideOverlay(): RaDecGuideOverlay {
  const tuning = RA_DEC_GUIDE_TUNING

  const object = new THREE.Group()
  object.name = 'RaDecGuideOverlay'
  object.visible = false
  object.renderOrder = 9_000

  const resolution = new THREE.Vector2(1, 1)

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

  const equatorMaterial = makeMaterial({
    color: tuning.colors.equator,
    lineWidthPx: tuning.lineWidthPx.equator,
    opacity: tuning.opacity.equator,
  })

  const gridMaterial = makeMaterial({
    color: tuning.colors.grid,
    lineWidthPx: tuning.lineWidthPx.grid,
    opacity: tuning.opacity.grid,
  })

  const geometries: LineGeometry[] = []
  const addLine = (name: string, positions: number[], material: LineMaterial) => {
    const geom = new LineGeometry()
    geom.setPositions(positions)

    const line = new Line2(geom, material)
    line.name = name
    line.computeLineDistances()

    geometries.push(geom)
    object.add(line)
  }

  // Celestial equator
  addLine('RaDecEquator', makeParallelPositions({ segments: tuning.segments, decRad: 0 }), equatorMaterial)

  // Declination parallels (subtle)
  for (const decDeg of tuning.decParallelsDeg) {
    const decRad = THREE.MathUtils.degToRad(decDeg)
    addLine(`RaDecParallel${decDeg}`, makeParallelPositions({ segments: tuning.segments, decRad }), gridMaterial)
  }

  // RA meridians (great circles through +/-Z)
  for (const raDeg of tuning.raMeridiansDeg) {
    const raRad = THREE.MathUtils.degToRad(raDeg)
    addLine(`RaDecMeridian${raDeg}`, makeMeridianPositions({ segments: tuning.segments, raRad }), gridMaterial)
  }

  const tmpTargetPos = new THREE.Vector3()
  const tmpScale = new THREE.Vector3()

  let enabled = false
  let target: THREE.Object3D | undefined

  // Keep the last known body radius so we can be resilient if a target becomes
  // temporarily unavailable during fade-out.
  let lastBodyRadiusWorld = 1

  const setEnabled = (nextEnabled: boolean) => {
    enabled = nextEnabled
  }

  const setTarget = (nextTarget: THREE.Object3D | undefined) => {
    target = nextTarget
  }

  const setResolution = (widthPx: number, heightPx: number) => {
    resolution.set(Math.max(1, widthPx), Math.max(1, heightPx))
    equatorMaterial.resolution.copy(resolution)
    gridMaterial.resolution.copy(resolution)
  }

  const syncToCamera = (opts: { camera: THREE.PerspectiveCamera; viewportHeightPx: number }) => {
    if (!enabled || !target) {
      object.visible = false
      return
    }

    target.getWorldPosition(tmpTargetPos)
    object.position.copy(tmpTargetPos)

    // Orient to the scene inertial frame (not the body-fixed frame).
    object.quaternion.identity()
    // Body meshes are uniformly scaled by their radiusWorld.
    target.getWorldScale(tmpScale)
    const r = maxComponent(tmpScale)
    if (Number.isFinite(r) && r > 0) {
      lastBodyRadiusWorld = r
    }

    const d = opts.camera.position.distanceTo(object.position)
    const safeDistance = Number.isFinite(d) && d > 1e-6 ? d : 1

    const wpp = computeWorldPerPixel({
      camera: opts.camera,
      distanceWorld: safeDistance,
      viewportHeightPx: opts.viewportHeightPx,
    })

    const bodyRadiusPx = wpp > 1e-12 ? lastBodyRadiusWorld / wpp : 0
    const desiredRadiusPx = THREE.MathUtils.clamp(
      bodyRadiusPx * tuning.radiusPx.baseBodyRadiusMult,
      tuning.radiusPx.min,
      tuning.radiusPx.max,
    )

    const radiusWorld = desiredRadiusPx * wpp
    object.scale.setScalar(Math.max(1e-6, radiusWorld))

    object.visible = true
  }

  const dispose = () => {
    for (const geom of geometries) geom.dispose()
    equatorMaterial.dispose()
    gridMaterial.dispose()
  }

  return {
    object,
    setEnabled,
    setTarget,
    setResolution,
    syncToCamera,
    dispose,
  }
}
