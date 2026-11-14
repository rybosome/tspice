// One issuer per host realm covers file tokens and WASM cell/window tokens.
// Keep the original symbol key so separately loaded package copies share the
// same sequence. Tokens exceed uint32 and cannot alias raw C IDs/pointers.
const HANDLE_ISSUER = Symbol.for("@rybosome/tspice/wasm-cell-handle-issuer/v1");
/** Issue a non-reused host-realm token for an owner-local opaque handle map. */
export function issueOpaqueSpiceHandle(): number {
  let issuer: unknown = Reflect.get(globalThis, HANDLE_ISSUER);
  if (issuer === undefined) {
    let next = 0x1_0000_0000;
    issuer = () => {
      if (!Number.isSafeInteger(next))
        throw new RangeError("opaque SPICE handle space exhausted");
      return next++;
    };
    if (!Reflect.defineProperty(globalThis, HANDLE_ISSUER, { value: issuer })) {
      throw new Error(
        "Cannot initialize the shared opaque SPICE handle issuer",
      );
    }
  }
  if (typeof issuer !== "function")
    throw new TypeError("Invalid opaque SPICE handle issuer");
  const handle: unknown = Reflect.apply(issuer, undefined, []);
  if (
    typeof handle !== "number" ||
    !Number.isSafeInteger(handle) ||
    handle < 0x1_0000_0000
  ) {
    throw new RangeError("Invalid issued opaque SPICE handle");
  }
  return handle;
}
