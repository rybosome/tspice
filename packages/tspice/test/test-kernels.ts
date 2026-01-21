import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KERNEL_CACHE_DIR = path.join(os.tmpdir(), "tspice-test-kernels");

async function downloadFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const tmpPath = `${outPath}.tmp`;
  fs.writeFileSync(tmpPath, bytes);
  fs.renameSync(tmpPath, outPath);
}

async function readCached(url: string): Promise<Uint8Array> {
  fs.mkdirSync(KERNEL_CACHE_DIR, { recursive: true });

  const u = new URL(url);
  const fileName = path.basename(u.pathname);
  const cachePath = path.join(KERNEL_CACHE_DIR, fileName);

  if (!fs.existsSync(cachePath)) {
    await downloadFile(url, cachePath);
  }

  return fs.readFileSync(cachePath);
}

export const TEST_KERNEL_URLS = {
  LSK: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
  SPK: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de405s.bsp",
} as const;

export async function loadTestKernels(): Promise<{
  lsk: Uint8Array;
  spk: Uint8Array;
}> {
  const [lsk, spk] = await Promise.all([
    readCached(TEST_KERNEL_URLS.LSK),
    readCached(TEST_KERNEL_URLS.SPK),
  ]);

  return { lsk, spk };
}
