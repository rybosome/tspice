import type { SpiceClient } from '../spice/SpiceClient.js'

export function installTspiceViewerE2eApi(args: { isE2e: boolean; spiceClient: SpiceClient }) {
  if (!args.isE2e) return

  window.__tspice_viewer__e2e = {
    getFrameTransform: ({ from, to, et }) => args.spiceClient.getFrameTransform({ from, to, et }),
  }
}

export function markTspiceViewerRenderedScene() {
  window.__tspice_viewer__rendered_scene = true
}
