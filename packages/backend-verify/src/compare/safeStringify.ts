export function safeStringify(value: unknown): string {
  if (typeof value === "bigint") return `${value.toString()}n`;
  try {
    const s = JSON.stringify(
      value,
      (_k, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
    );
    return s ?? String(value);
  } catch {
    return String(value);
  }
}
