import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Prevent Vitest from trying to run Playwright specs.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
