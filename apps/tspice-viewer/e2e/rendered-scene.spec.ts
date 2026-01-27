import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 900, height: 650 },
  deviceScaleFactor: 1,
})

test('rendered scene is visually stable (golden screenshot)', async ({ page, baseURL }) => {
  const allowedOrigin = baseURL ? new URL(baseURL).origin : 'http://127.0.0.1:4173'

  // Ensure the test is deterministic and doesn't accidentally hit the network.
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (
      url.startsWith(allowedOrigin) ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      await route.continue()
      return
    }

    await route.abort()
  })

  await page.addInitScript(() => {
    // Basic determinism helpers.
    const fixedNow = 1_700_000_000_000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Date as any).now = () => fixedNow
    Math.random = () => 0.42
  })

  // Use a fixed ET to drive a deterministic render.
  await page.goto('/?e2e=1&et=1234567')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()

  await expect(canvas).toHaveScreenshot('rendered-scene.png', {
    animations: 'disabled',
    // Minor single-pixel diffs can happen across runners/GPUs/drivers.
    // Keep the golden screenshot check, but allow a tiny tolerance.
    maxDiffPixels: 10,
  })
})
