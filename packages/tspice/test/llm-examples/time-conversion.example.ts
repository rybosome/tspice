import { spiceClients } from "@rybosome/tspice";

/**
 * Example: UTC <-> ET conversions.
 *
 * Requires a leap-seconds kernel (LSK) to be loaded first.
 */
export async function utcEtRoundTrip(lskBytes: Uint8Array) {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });

  try {
    spice.kit.loadKernel({ path: "naif0012.tls", bytes: lskBytes });

    const utc = "2000 JAN 01 12:00:00";
    const et = spice.kit.utcToEt(utc);

    // Common formats include: "C", "ISOC", ... (see SPICE docs for details)
    const utcAgain = spice.kit.etToUtc(et, "ISOC", 3);

    return { utc, et, utcAgain };
  } finally {
    await dispose();
  }
}
