export const DEFAULT_CSPICE_TOOLKIT_VERSION = "N0067" as const;

export function resolveExpectedCspiceToolkitVersion(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (trimmed.length > 0) {
    return trimmed;
  }

  return DEFAULT_CSPICE_TOOLKIT_VERSION;
}
