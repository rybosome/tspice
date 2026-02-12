export type SpiceTransport = {
  request(op: string, args: unknown[]): Promise<unknown>;
};

export type SpiceTransportSync = {
  request(op: string, args: unknown[]): unknown;
};
