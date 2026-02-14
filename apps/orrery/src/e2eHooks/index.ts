import type { SpiceAsync } from '@rybosome/tspice'

/**
 * Install a small E2E-only API on `window` for Playwright tests.
 *
 * Returns an uninstall callback.
 */
export function installTspiceViewerE2eApi(args: { isE2e: boolean; spice: SpiceAsync }): () => void {
  if (!args.isE2e) return () => {}

  // Reset on each mount so tests don't accidentally pass due to a previous run.
  window.__tspice_viewer__rendered_scene = false

  window.__tspice_viewer__e2e = {
    getFrameTransform: ({ from, to, et }) => args.spice.kit.frameTransform(from, to, et).then((m) => m.toColMajor()),
  }

  return () => {
    delete window.__tspice_viewer__e2e
    delete window.__tspice_viewer__rendered_scene
  }
}

/** Mark (via `window`) that the first render completed (E2E only). */
export function markTspiceViewerRenderedScene(args: { isE2e: boolean }) {
  if (!args.isE2e) return
  window.__tspice_viewer__rendered_scene = true
}
