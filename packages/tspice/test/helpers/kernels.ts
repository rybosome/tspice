import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cacheDir = path.join(__dirname, "..", ".cache", "kernels");

function sha256Bytes(bytes: Uint8Array): string {
  const hash = crypto.createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

async function readFileAndSha256(filePath: string): Promise<{
  bytes: Buffer;
  sha256: string;
}> {
  const bytes = await fsp.readFile(filePath);
  return { bytes, sha256: sha256Bytes(bytes) };
}

async function downloadBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function writeFileAtomic(opts: {
  outPath: string;
  bytes: Buffer;
  expectedSha256: string;
}): Promise<void> {
  const dir = path.dirname(opts.outPath);
  await fsp.mkdir(dir, { recursive: true });

  const tmpPath = path.join(
    dir,
    `.${path.basename(opts.outPath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  let fh: fsp.FileHandle | undefined;
  try {
    fh = await fsp.open(tmpPath, "wx");
    await fh.writeFile(opts.bytes);
    await fh.sync();
    await fh.close();
    fh = undefined;

    try {
      // Atomic on POSIX when staying on the same filesystem.
      await fsp.rename(tmpPath, opts.outPath);
      return;
    } catch (err: any) {
      // On Windows, rename() can't replace an existing file. If another worker
      // won the race, keep the existing file if it matches.
      if (err?.code === "EEXIST" || err?.code === "EPERM") {
        try {
          const existing = await readFileAndSha256(opts.outPath);
          if (existing.sha256 === opts.expectedSha256) {
            return;
          }
        } catch {
          // Ignore and try replacing below.
        }

        await fsp.rm(opts.outPath, { force: true });
        await fsp.rename(tmpPath, opts.outPath);
        return;
      }
      throw err;
    }
  } finally {
    try {
      await fh?.close();
    } catch {
      // ignore
    }
    await fsp.rm(tmpPath, { force: true });
  }
}

export async function ensureKernelFile(opts: {
  name: string;
  url: string;
  sha256: string;
}): Promise<{ path: string; bytes: Buffer }> {
  const outPath = path.join(cacheDir, opts.name);

  // Read the cached file once (hash + bytes) to avoid races where another
  // worker truncates/replaces the file between separate reads.
  try {
    const cached = await readFileAndSha256(outPath);
    if (cached.sha256 === opts.sha256) {
      return { path: outPath, bytes: cached.bytes };
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      throw err;
    }
  }

  // Cache miss or corrupted cache: (re)download with an atomic swap to avoid
  // other Vitest workers reading a partially-written kernel.
  let lastSha: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const bytes = await downloadBytes(opts.url);
    const sha = sha256Bytes(bytes);
    lastSha = sha;

    if (sha !== opts.sha256) {
      continue;
    }

    await writeFileAtomic({ outPath, bytes, expectedSha256: opts.sha256 });
    return { path: outPath, bytes };
  }

  throw new Error(
    `Kernel SHA-256 mismatch for ${opts.name}. Expected ${opts.sha256}, got ${lastSha}. URL=${opts.url}`,
  );
}
