export interface ExecOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * Abstract executor interface for runner implementations.
 */
export interface Executor {
  exec(command: string, args: readonly string[], options?: ExecOptions): Promise<ExecResult>;
}
