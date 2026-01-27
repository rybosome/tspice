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
    // Basic determinism helpers for screenshot stability.
    const fixedNow = 1_700_000_000_000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Date as any).now = () => fixedNow

    // Use a seeded PRNG (mulberry32) so Math.random is deterministic but not constant.
    // A constant value breaks Comlink's UUID generation for worker message correlation.
    let seed = 0x12345678
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  })

  // Use a fixed ET to drive a deterministic render.
  await page.goto('/?e2e=1&et=1234567')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()

  await expect(canvas).toHaveScreenshot('rendered-scene.png', {
    animations: 'disabled',
  })
})
