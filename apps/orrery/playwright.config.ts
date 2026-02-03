import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '../..')

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

// Note: `--disable-gpu` can cause SwiftShader WebGL to render without textures
// on some ARM64 environments. Keep it enabled on x64 (where it historically
// improved determinism), but skip it on arm64 so e2e snapshots render correctly.
const CHROMIUM_LAUNCH_ARGS = ['--use-gl=swiftshader', '--disable-dev-shm-usage']
if (process.arch !== 'arm64') CHROMIUM_LAUNCH_ARGS.push('--disable-gpu')

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  outputDir: path.join(__dirname, 'playwright-report', 'test-results'),
  reporter: process.env.CI
    ? [['list']]
    : [['list'], ['html', { outputFolder: path.join(__dirname, 'playwright-report', 'html'), open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // video: 'retain-on-failure',
  },

  webServer: {
    command: `pnpm -C apps/orrery dev --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: REPO_ROOT,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: CHROMIUM_LAUNCH_ARGS,
        },
      },
    },
  ],
})
