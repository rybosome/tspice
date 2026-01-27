import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

import { quantizeEt } from '../../time/quantizeEt.js'
import { J2000_FRAME, type BodyRef, type EtSeconds, type SpiceClient, type Vec3Km } from '../../spice/SpiceClient.js'
import { rebasePositionKm } from '../precision.js'
import { getApproxOrbitalPeriodSec, getOrbitAnchorQuantumSec } from './orbitalPeriods.js'

export type OrbitPathsSettings = {
  lineWidthPx: number
  samplesPerOrbit: number
  maxTotalPoints: number
  minPointsPerOrbit: number
  antialias: boolean
}

export type OrbitPathsBodySpec = {
  body: BodyRef
  color: THREE.ColorRepresentation
}

type OrbitPathState = {
  target: BodyRef
  primary: BodyRef
  periodSec: number
  anchorQuantumSec: number

  group: THREE.Group
  geometry: LineGeometry
  material: LineMaterial
  line: Line2

  hasGeometry: boolean
  wasVisible: boolean

  lastAnchorEtSec?: number
  lastPoints?: number
  lastSettingsKey?: string
  lastMaterialKey?: string

  inFlight?: {
    token: number
    abort: AbortController
  }
}

function getOrbitPrimary(body: BodyRef): BodyRef | undefined {
  const key = String(body)
  if (key === 'SUN') return undefined
  if (key === 'MOON') return 'EARTH'
  return 'SUN'
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function computePointsPerOrbit(opts: {
  samplesPerOrbit: number
  maxTotalPoints: number
  minPointsPerOrbit: number
  visibleOrbits: number
}): number {
  const { samplesPerOrbit, maxTotalPoints, minPointsPerOrbit, visibleOrbits } = opts
  if (visibleOrbits <= 0) return Math.max(2, Math.floor(samplesPerOrbit))

  const perOrbitBudget = Math.floor(maxTotalPoints / visibleOrbits)

  // If the global budget is too small to honor the floor, degrade gracefully.
  const minPoints = perOrbitBudget > 0 ? Math.min(minPointsPerOrbit, perOrbitBudget) : 2

  return THREE.MathUtils.clamp(
    Math.min(samplesPerOrbit, perOrbitBudget || samplesPerOrbit),
    Math.max(2, minPoints),
    Math.max(2, samplesPerOrbit)
  )
}

export class OrbitPaths {
  readonly object: THREE.Group

  private readonly spiceClient: SpiceClient
  private readonly kmToWorld: number
  private readonly orbits: OrbitPathState[]
  private readonly resolution = new THREE.Vector2(1, 1)
  private samplingToken = 0

  constructor(opts: { spiceClient: SpiceClient; kmToWorld: number; bodies: readonly OrbitPathsBodySpec[] }) {
    this.spiceClient = opts.spiceClient
    this.kmToWorld = opts.kmToWorld
    this.object = new THREE.Group()
    this.object.name = 'OrbitPaths'

    const orbits: OrbitPathState[] = []
    for (const b of opts.bodies) {
      const primary = getOrbitPrimary(b.body)
      if (!primary) continue

      const periodSec = getApproxOrbitalPeriodSec(b.body)
      if (!periodSec || !Number.isFinite(periodSec) || periodSec <= 0) continue

      const anchorQuantumSec = getOrbitAnchorQuantumSec(b.body)

      const group = new THREE.Group()
      group.name = `OrbitPath(${String(b.body)})`

      const geometry = new LineGeometry()

      const material = new LineMaterial({
        color: new THREE.Color(b.color).getHex(),
        linewidth: 1,
        worldUnits: false,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false,
      })
      material.resolution.copy(this.resolution)

      const line = new Line2(geometry, material)
      line.frustumCulled = false
      line.name = `OrbitLine(${String(b.body)})`

      group.add(line)
      this.object.add(group)

      orbits.push({
        target: b.body,
        primary,
        periodSec,
        anchorQuantumSec,
        group,
        geometry,
        material,
        line,
        hasGeometry: false,
        wasVisible: false,
      })
    }

    this.orbits = orbits
  }

  setResolution(widthPx: number, heightPx: number) {
    this.resolution.set(Math.max(1, widthPx), Math.max(1, heightPx))
    for (const o of this.orbits) {
      o.material.resolution.copy(this.resolution)
    }
  }

  dispose() {
    for (const o of this.orbits) {
      o.inFlight?.abort.abort()
      o.geometry.dispose()
      o.material.dispose()
    }
  }

  update(input: {
    etSec: EtSeconds
    focusPosKm: Vec3Km
    bodyPosKmByKey: ReadonlyMap<string, Vec3Km>
    bodyVisibleByKey: ReadonlyMap<string, boolean>
    settings: OrbitPathsSettings
  }) {
    const visibleOrbits = this.orbits.filter((o) => input.bodyVisibleByKey.get(String(o.target)) !== false)
    const pointsPerOrbit = computePointsPerOrbit({
      samplesPerOrbit: input.settings.samplesPerOrbit,
      maxTotalPoints: input.settings.maxTotalPoints,
      minPointsPerOrbit: input.settings.minPointsPerOrbit,
      visibleOrbits: visibleOrbits.length,
    })

    const settingsKey = `${input.settings.lineWidthPx}|${pointsPerOrbit}|${input.settings.antialias}`

    for (const o of this.orbits) {
      const targetKey = String(o.target)
      const visible = input.bodyVisibleByKey.get(targetKey) !== false

      const primaryPosKm = input.bodyPosKmByKey.get(String(o.primary))
      const canPlace = Boolean(primaryPosKm)

      // If we don't know where the primary is, hide the orbit to avoid placing it at origin.
      o.group.visible = visible && canPlace

      if (o.group.visible && primaryPosKm) {
        const rebasedKm = rebasePositionKm(primaryPosKm, input.focusPosKm)
        o.group.position.set(rebasedKm[0] * this.kmToWorld, rebasedKm[1] * this.kmToWorld, rebasedKm[2] * this.kmToWorld)
      }

      // Apply material settings even if hidden (so it looks correct when enabled).
      const materialKey = `${input.settings.lineWidthPx}|${input.settings.antialias}`
      if (o.lastMaterialKey !== materialKey) {
        o.lastMaterialKey = materialKey
        o.material.linewidth = input.settings.lineWidthPx
        ;(o.material as any).alphaToCoverage = Boolean(input.settings.antialias)
        o.material.needsUpdate = true
      }

      const anchorEtSec = quantizeEt(input.etSec, o.anchorQuantumSec)

      const becameVisible = visible && !o.wasVisible
      o.wasVisible = visible

      const shouldResample =
        o.group.visible &&
        (becameVisible ||
          o.lastAnchorEtSec !== anchorEtSec ||
          o.lastPoints !== pointsPerOrbit ||
          o.lastSettingsKey !== settingsKey)

      if (shouldResample) {
        o.lastAnchorEtSec = anchorEtSec
        o.lastPoints = pointsPerOrbit
        o.lastSettingsKey = settingsKey
        this.startSampling(o, { anchorEtSec, points: pointsPerOrbit })
      }
    }
  }

  private startSampling(o: OrbitPathState, opts: { anchorEtSec: number; points: number }) {
    o.inFlight?.abort.abort()

    const token = ++this.samplingToken
    const abort = new AbortController()
    o.inFlight = { token, abort }

    void this.sampleOrbitPositionsKm({
      target: o.target,
      primary: o.primary,
      anchorEtSec: opts.anchorEtSec,
      periodSec: o.periodSec,
      points: opts.points,
      signal: abort.signal,
    })
      .then((positionsKm) => {
        if (abort.signal.aborted) return
        if (o.inFlight?.token !== token) return
        o.inFlight = undefined

        // If sampling succeeded but returned no positions, treat it as failure.
        if (!positionsKm.length) {
          o.group.visible = false
          o.hasGeometry = false
          return
        }

        const positionsWorld: number[] = new Array(positionsKm.length * 3)
        for (let i = 0; i < positionsKm.length; i++) {
          const p = positionsKm[i]
          positionsWorld[i * 3 + 0] = p[0] * this.kmToWorld
          positionsWorld[i * 3 + 1] = p[1] * this.kmToWorld
          positionsWorld[i * 3 + 2] = p[2] * this.kmToWorld
        }

        o.geometry.setPositions(positionsWorld)
        o.hasGeometry = true
      })
      .catch((err) => {
        // Best-effort: don't crash the viewer if an orbit can't be sampled.
        // (Common cause: missing kernels for a body.)
        console.warn('Orbit path sampling failed', { target: o.target, primary: o.primary }, err)
        if (abort.signal.aborted) return
        if (o.inFlight?.token !== token) return
        o.inFlight = undefined

        // Hide the orbit if it never produced valid geometry.
        if (!o.hasGeometry) {
          o.group.visible = false
        }
      })
  }

  private async sampleOrbitPositionsKm(input: {
    target: BodyRef
    primary: BodyRef
    anchorEtSec: number
    periodSec: number
    points: number
    signal: AbortSignal
  }): Promise<Vec3Km[]> {
    const points = Math.max(2, Math.floor(input.points))

    // Anchor to current time, centered in the window.
    const startEt = input.anchorEtSec - input.periodSec * 0.5
    const stepSec = input.periodSec / (points - 1)

    const out: Vec3Km[] = []
    for (let i = 0; i < points; i++) {
      if (input.signal.aborted) return []

      const et = startEt + stepSec * i
      const state = this.spiceClient.getBodyState({
        target: input.target,
        observer: input.primary,
        frame: J2000_FRAME,
        et,
      })

      out.push(state.positionKm)

      // Yield occasionally so we don't block the main thread too badly on initial load.
      if (i % 16 === 15) {
        await yieldToMainThread()
      }
    }
    return out
  }
}
