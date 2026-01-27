import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../..')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow the viewer to import sibling workspace packages (e.g. @rybosome/tspice)
    // in dev/e2e without hitting Vite's fs sandbox.
    fs: {
      allow: [REPO_ROOT],
    },
  },
  worker: {
    // Use ES module format for workers; required since we use `type: 'module'`
    // workers and code-splitting doesn't support IIFE.
    format: 'es',
  },
  test: {
    environment: 'node',
    // Prevent Vitest from trying to run Playwright specs.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
