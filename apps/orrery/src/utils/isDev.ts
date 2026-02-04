/**
 * Runtime dev-mode check that doesn't assume Vite's `ImportMetaEnv` typings.
 *
 * - In Vite, this resolves to `import.meta.env.DEV`.
 * - In other environments where `import.meta.env` is absent, we fall back to
 *   `process.env.NODE_ENV !== 'production'` when `process` is safely available.
 */
export function isDev(): boolean {
  // Vite sets `import.meta.env` at build time.
  const viteEnv = (import.meta as unknown as { env?: { DEV?: unknown } } | undefined)?.env
  if (viteEnv && 'DEV' in viteEnv) {
    return Boolean(viteEnv.DEV)
  }

  // Cross-runtime fallback (safe even when `process` doesn't exist).
  const nodeEnv = (globalThis as unknown as { process?: { env?: { NODE_ENV?: unknown } } })?.process?.env?.NODE_ENV
  return typeof nodeEnv === 'string' ? nodeEnv !== 'production' : true
}
