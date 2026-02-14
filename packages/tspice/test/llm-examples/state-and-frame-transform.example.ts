import type { Vec3 } from "@rybosome/tspice";
import { J2000, Mat3, spiceClients } from "@rybosome/tspice";

type KernelBytes = {
  lsk: Uint8Array;
  spk: Uint8Array;
  // Optional: additional kernels depending on your frame needs.
  fk?: Uint8Array;
  pck?: Uint8Array;
};

function applyMat3(m: Mat3, v: Vec3): Vec3 {
  const r = m.rowMajor;
  return [
    r[0] * v[0] + r[1] * v[1] + r[2] * v[2],
    r[3] * v[0] + r[4] * v[1] + r[5] * v[2],
    r[6] * v[0] + r[7] * v[1] + r[8] * v[2],
  ] as const;
}

/**
 * Example: ephemeris state + frame transform.
 *
 * Requires kernels appropriate to the calls you make:
 * - LSK for time conversion
 * - SPK for ephemeris state
 * - Additional frame kernels (FK/PCK/etc) for some transforms
 */
export async function earthStateAndEarthFixedPosition(kernels: KernelBytes) {
  const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });

  try {
    spice.kit.loadKernel({ path: "naif0012.tls", bytes: kernels.lsk });
    spice.kit.loadKernel({ path: "de405s.bsp", bytes: kernels.spk });
    if (kernels.fk) spice.kit.loadKernel({ path: "frames.tf", bytes: kernels.fk });
    if (kernels.pck) spice.kit.loadKernel({ path: "pck.tpc", bytes: kernels.pck });

    const et = spice.kit.utcToEt("2000 JAN 01 12:00:00");

    const stateJ2000 = spice.kit.getState({
      target: "EARTH",
      observer: "SUN",
      at: et,
      frame: J2000,
      aberration: "NONE",
    });

    const j2000ToEarthFixed = spice.kit.frameTransform(J2000, "IAU_EARTH", et);
    const positionEarthFixed = applyMat3(j2000ToEarthFixed, stateJ2000.position);

    return { stateJ2000, positionEarthFixed };
  } finally {
    await dispose();
  }
}
