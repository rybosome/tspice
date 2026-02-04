import { expect, test, type Page } from '@playwright/test'

test.use({
  viewport: { width: 900, height: 650 },
  deviceScaleFactor: 1,
})

async function gotoDeterministicScene(args: { page: Page; baseURL: string | undefined }) {
  const { page, baseURL } = args
  const allowedOrigin = baseURL ? new URL(baseURL).origin : 'http://127.0.0.1:4173'

  // Ensure the test is deterministic and doesn't accidentally hit the network.
  await page.route('**/*', async (route) => {
    const url = route.request().url()
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

  await page.waitForFunction(() => window.__tspice_viewer__rendered_scene === true)
}

async function setSunPreset(args: { page: Page; preset: 'sun-close' | 'sun-medium' | 'sun-far' }) {
  const { page, preset } = args

  await page.evaluate((preset) => {
    const api = window.__tspice_viewer__e2e
    if (!api?.setCameraPreset) throw new Error('Missing e2e API: setCameraPreset')

    api.lockDeterministicLighting?.()
    api.setCameraPreset(preset)
  }, preset)
}

test.describe('sun appearance (phase 0 guardrails)', () => {
  test('sun: close', async ({ page, baseURL }) => {
    await gotoDeterministicScene({ page, baseURL })
    await setSunPreset({ page, preset: 'sun-close' })

    const canvas = page.locator('canvas.sceneCanvas')
    await expect(canvas).toBeVisible()

    await expect(canvas).toHaveScreenshot('sun-close.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })

  test('sun: medium', async ({ page, baseURL }) => {
    await gotoDeterministicScene({ page, baseURL })
    await setSunPreset({ page, preset: 'sun-medium' })

    const canvas = page.locator('canvas.sceneCanvas')
    await expect(canvas).toBeVisible()

    await expect(canvas).toHaveScreenshot('sun-medium.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })

  test('sun: far', async ({ page, baseURL }) => {
    await gotoDeterministicScene({ page, baseURL })
    await setSunPreset({ page, preset: 'sun-far' })

    const canvas = page.locator('canvas.sceneCanvas')
    await expect(canvas).toBeVisible()

    await expect(canvas).toHaveScreenshot('sun-far.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })
})
