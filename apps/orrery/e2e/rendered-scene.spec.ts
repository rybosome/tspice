import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 900, height: 650 },
  deviceScaleFactor: 1,
})

test('rendered scene is visually stable (golden screenshot)', async ({ page, baseURL }) => {
  const allowedOrigin = baseURL ? new URL(baseURL).origin : 'http://127.0.0.1:4173'
  const abortedTexturePathnames = new Set([
    '/textures/planets/earth.png',
    '/textures/planets/earth-nightlights.jpg',
    '/textures/planets/earth-clouds.jpg',
  ])

  // Ensure the test is deterministic and doesn't accidentally hit the network.
  await page.route('**/*', async (route) => {
    const url = route.request().url()

    // Parse first so our abort rules are deterministic (avoid substring matches
    // in query strings / other assets).
    const parsedUrl = new URL(url)

    // Abort large textures that can race GPU uploads and make screenshots flaky.
    if (abortedTexturePathnames.has(parsedUrl.pathname)) {
      await route.abort()
      return
    }

    if (url.startsWith(allowedOrigin) || url.startsWith('data:') || url.startsWith('blob:')) {
      await route.continue()
      return
    }

    await route.abort()
  })

  await page.addInitScript(() => {
    // Basic determinism helpers.
    const fixedNow = 1_700_000_000_000
    ;(Date as any).now = () => fixedNow
    Math.random = () => 0.42
  })

  // Use a fixed ET to drive a deterministic render.
  await page.goto('/?e2e=1&et=1234567')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()

  // Force a final render and lock deterministic lighting before capturing the golden.
  await page.evaluate(() => {
    ;(window as any).__tspice_viewer__e2e?.lockDeterministicLighting?.()
    ;(window as any).__tspice_viewer__e2e?.samplePerfCounters?.()
  })

  await expect(canvas).toHaveScreenshot('rendered-scene.png', {
    animations: 'disabled',
    // CI can have minor GPU/driver anti-aliasing variance in WebGL star rendering.
    maxDiffPixelRatio: 0.02,
    maxDiffPixels: process.env.CI ? 2500 : 500,
  })
})
