/** Error used for invalid CLI usage / flag combinations. */
export class UsageError extends Error {
  override name = "UsageError";
}

/** Error used for invalid or unreadable repo-standards configuration. */
export class ConfigError extends Error {
  override name = "ConfigError";
}
