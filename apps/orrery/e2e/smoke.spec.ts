import { expect, test } from '@playwright/test'

test('smoke: loads without runtime errors', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (err) => {
    pageErrors.push(String(err))
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  await page.goto('/')

  await page.waitForLoadState('domcontentloaded')

  // Give Three a beat to initialize and render a frame.
  await page.waitForTimeout(2000)

  expect(pageErrors, `pageerror events:\n${pageErrors.join('\n')}`).toEqual([])
  expect(consoleErrors, `console.error messages:\n${consoleErrors.join('\n')}`).toEqual([])

  // Basic readiness: app header appears.
  await expect(page.getByRole('heading', { name: 'Orrery' })).toBeVisible()
})
