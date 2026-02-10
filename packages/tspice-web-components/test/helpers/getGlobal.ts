export function getGlobal<K extends string>(key: K): unknown {
  return (globalThis as Record<string, unknown>)[key];
}
