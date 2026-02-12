export type SpiceTransport = {
  request(op: string, args: unknown[]): Promise<unknown>;
};
