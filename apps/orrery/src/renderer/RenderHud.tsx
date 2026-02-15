import type { ReactNode } from 'react'
import * as THREE from 'three'

/**
 * Snapshot of per-frame renderer stats for the debug HUD.
 */
export interface RenderHudStats {
  fps: number
  drawCalls: number
  triangles: number
  lines: number
  points: number
  geometries: number
  textures: number
  meshCount: number
  lineCount: number
  pointsCount: number
  cameraPosition: THREE.Vector3
  cameraQuaternion: THREE.Quaternion
  cameraEuler: THREE.Euler
  targetDistance: number
  focusBody: string
}

/** Debug UI showing per-frame renderer stats (when enabled). */
export function RenderHud({ stats }: { stats: RenderHudStats | null }): ReactNode {
  if (!stats) return null

  const pos = stats.cameraPosition
  const quat = stats.cameraQuaternion
  const euler = stats.cameraEuler

  // Convert radians to degrees for human-friendly display
  const eulerDegX = THREE.MathUtils.radToDeg(euler.x).toFixed(1)
  const eulerDegY = THREE.MathUtils.radToDeg(euler.y).toFixed(1)
  const eulerDegZ = THREE.MathUtils.radToDeg(euler.z).toFixed(1)

  return (
    <>
      {/* Top-right: Performance stats */}
      <div className="renderHud renderHudTopRight">
        <div className="renderHudTitle">Render Stats</div>
        <div>FPS: {stats.fps.toFixed(1)}</div>
        <div>Draw Calls: {stats.drawCalls}</div>
        <div>Triangles: {stats.triangles.toLocaleString()}</div>
        {stats.lines > 0 && <div>Lines: {stats.lines.toLocaleString()}</div>}
        {stats.points > 0 && <div>Points: {stats.points.toLocaleString()}</div>}
        <div className="renderHudDivider" />
        <div>Geometries: {stats.geometries}</div>
        <div>Textures: {stats.textures}</div>
        <div className="renderHudDivider" />
        <div>Visible Meshes: {stats.meshCount}</div>
        {stats.lineCount > 0 && <div>Visible Lines: {stats.lineCount}</div>}
        {stats.pointsCount > 0 && <div>Visible Points: {stats.pointsCount}</div>}
      </div>

      {/* Bottom-left: Camera info */}
      <div className="renderHud renderHudBottomLeft">
        <div className="renderHudTitle">Camera</div>
        <div>
          Position: ({pos.x.toFixed(4)}, {pos.y.toFixed(4)}, {pos.z.toFixed(4)})
        </div>
        <div>
          Quaternion: ({quat.x.toFixed(3)}, {quat.y.toFixed(3)}, {quat.z.toFixed(3)}, {quat.w.toFixed(3)})
        </div>
        <div>
          Euler (XYZ): ({eulerDegX}°, {eulerDegY}°, {eulerDegZ}°)
        </div>
        <div>Distance to Target: {stats.targetDistance.toFixed(4)}</div>
        <div>Focus Body: {stats.focusBody}</div>
      </div>
    </>
  )
}
