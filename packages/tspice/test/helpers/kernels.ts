import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cacheDir = path.join(__dirname, "..", ".cache", "kernels");

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, new Uint8Array(arrayBuffer));
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export async function ensureKernelFile(opts: {
  name: string;
  url: string;
  sha256: string;
}): Promise<{ path: string; bytes: Buffer }> {
  const outPath = path.join(cacheDir, opts.name);

  if (!fs.existsSync(outPath)) {
    await downloadToFile(opts.url, outPath);
  }

  const actual = sha256File(outPath);
  if (actual !== opts.sha256) {
    // If the cached file is wrong/corrupted, re-download once.
    await downloadToFile(opts.url, outPath);
    const actual2 = sha256File(outPath);
    if (actual2 !== opts.sha256) {
      throw new Error(
        `Kernel SHA-256 mismatch for ${opts.name}. Expected ${opts.sha256}, got ${actual2}. URL=${opts.url}`,
      );
    }
  }

  return { path: outPath, bytes: fs.readFileSync(outPath) };
}
