/** Options passed to {@link Executor.exec}. */
export interface ExecOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
}

/** Result from {@link Executor.exec}. */
export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * Abstract executor interface for runner implementations.
 */
export interface Executor {
  /** Execute a command and capture stdout/stderr + exit code. */
  exec(command: string, args: readonly string[], options?: ExecOptions): Promise<ExecResult>;
}
