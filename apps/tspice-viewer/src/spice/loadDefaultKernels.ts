import { transferKernel } from "@rybosome/tspice-web/client";
import type { KernelSource } from "@rybosome/tspice";

type KernelLoader = {
  loadKernel(kernel: KernelSource): Promise<void>;
};

const KERNELS = {
  lsk: {
    urlPath: "kernels/naif/naif0012.tls",
    fsPath: "/kernels/naif/naif0012.tls",
  },
  pck: {
    urlPath: "kernels/naif/pck00011.tpc",
    fsPath: "/kernels/naif/pck00011.tpc",
  },
  spk: {
    urlPath: "kernels/naif/de432s.bsp",
    fsPath: "/kernels/naif/de432s.bsp",
  },
} as const;

async function fetchKernelBytes(url: URL): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch kernel: ${url.toString()} (status=${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
* Loads the viewer's default NAIF kernels into the provided tspice instance.
*
* Load order matters:
* - LSK (leap seconds)
* - PCK (planetary constants)
* - SPK (ephemeris)
*/
export async function loadDefaultKernels(spice: KernelLoader): Promise<void> {
  // In Vite, BASE_URL accounts for non-root deployments (e.g. GitHub pages).
  const base = new URL(import.meta.env.BASE_URL, window.location.href);

  const lskUrl = new URL(KERNELS.lsk.urlPath, base);
  const pckUrl = new URL(KERNELS.pck.urlPath, base);
  const spkUrl = new URL(KERNELS.spk.urlPath, base);

  const [lskBytes, pckBytes, spkBytes] = await Promise.all([
    fetchKernelBytes(lskUrl),
    fetchKernelBytes(pckUrl),
    fetchKernelBytes(spkUrl),
  ]);

  await spice.loadKernel(transferKernel({ path: KERNELS.lsk.fsPath, bytes: lskBytes }));
  await spice.loadKernel(transferKernel({ path: KERNELS.pck.fsPath, bytes: pckBytes }));
  await spice.loadKernel(transferKernel({ path: KERNELS.spk.fsPath, bytes: spkBytes }));
}
