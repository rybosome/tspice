export function resolveVitePublicUrl(pathOrUrl: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.href)
  return new URL(pathOrUrl, base).toString()
}
