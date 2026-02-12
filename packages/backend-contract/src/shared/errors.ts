export class SpiceBackendContractError extends Error {
  override name = "SpiceBackendContractError";

  constructor(message: string) {
    super(message);
  }
}
