/** Error thrown when a backend violates a contract invariant or postcondition. */
export class SpiceBackendContractError extends Error {
  override name = "SpiceBackendContractError";

  constructor(message: string) {
    super(message);
  }
}
