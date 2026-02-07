import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 900, height: 650 },
  deviceScaleFactor: 1,
})

const setupDeterminismAndNetworkBlock = async (page: any, baseURL?: string) => {
  const allowedOrigin = baseURL ? new URL(baseURL).origin : 'http://127.0.0.1:4173'

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.startsWith(allowedOrigin) || url.startsWith('data:') || url.startsWith('blob:')) {
      await route.continue()
      return
    }

    await route.abort()
  })

  await page.addInitScript(() => {
    const fixedNow = 1_700_000_000_000
    ;(Date as any).now = () => fixedNow
    Math.random = () => 0.42
  })
}

test('sun postprocessing: whole-frame bloom + tonemap', async ({ page, baseURL }) => {
  await setupDeterminismAndNetworkBlock(page, baseURL)

  await page.goto('/?e2e=1&et=1234567&sunPostprocessMode=wholeFrame&sunToneMap=filmic')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()

  await expect(canvas).toHaveScreenshot('sun-postprocess-whole-frame.png', {
    animations: 'disabled',
    // Bloom + tonemapping can vary slightly across GPUs / OSes; allow a bit more diff here.
    maxDiffPixelRatio: 0.1,
  })
})

test('sun postprocessing: sun-isolated selective bloom + tonemap', async ({ page, baseURL }) => {
  await setupDeterminismAndNetworkBlock(page, baseURL)

  await page.goto('/?e2e=1&et=1234567&sunPostprocessMode=sunIsolated&sunToneMap=filmic')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()

  await expect(canvas).toHaveScreenshot('sun-postprocess-sun-isolated.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.06,
  })
})

test('sun postprocessing: sun-isolated selective bloom (default tonemap)', async ({ page, baseURL }) => {
  await setupDeterminismAndNetworkBlock(page, baseURL)

  // Intentionally omit `sunToneMap` so we cover the `sunIsolated` default (none).
  await page.goto('/?e2e=1&et=1234567&sunPostprocessMode=sunIsolated')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()

  await expect(canvas).toHaveScreenshot('sun-postprocess-sun-isolated-default-tonemap.png', {
    animations: 'disabled',
    // This mode is more sensitive to subtle GPU / driver differences.
    maxDiffPixelRatio: 0.08,
  })
})
