import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 900, height: 650 },
  deviceScaleFactor: 1,
})

test('viewer loads (default fake backend) without console/page errors', async ({ page, baseURL }) => {
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

  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  // Use a fixed ET and force deterministic render settings.
  await page.goto('/?e2e=1&et=1234567')

  await page.waitForFunction(() => (window as any).__tspice_viewer__rendered_scene === true)

  const frameTransform = await page.evaluate(() =>
    (window as any).__tspice_viewer__e2e.getFrameTransform({
      from: 'J2000',
      to: 'J2000',
      et: 1234567,
    })
  )

  expect(frameTransform).toHaveLength(9)
  for (const v of frameTransform) {
    expect(typeof v).toBe('number')
    expect(Number.isFinite(v)).toBe(true)
  }

  expect(errors).toEqual([])

  const canvas = page.locator('canvas.sceneCanvas')
  await expect(canvas).toBeVisible()
})
