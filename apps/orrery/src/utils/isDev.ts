/**
* Runtime dev-mode check that doesn't assume Vite's `ImportMetaEnv` typings.
*
* - In Vite, this resolves to `import.meta.env.DEV`.
* - In other environments (or older builds) where `import.meta.env` is absent,
*   this safely returns `false`.
*/
export function isDev(): boolean {
  return Boolean((import.meta as unknown as { env?: { DEV?: unknown } })?.env?.DEV)
}
