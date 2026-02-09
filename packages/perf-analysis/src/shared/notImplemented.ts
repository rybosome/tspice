/**
 * Helper for scaffold-only entrypoints.
 *
 * We keep error messaging consistent so accidental use of this scaffolded package
 * fails loudly with a clear next step.
 */
export function notImplemented(feature: string): never {
  throw new Error(
    `@rybosome/tspice-perf-analysis scaffold: ${feature} is not implemented yet`,
  );
}
