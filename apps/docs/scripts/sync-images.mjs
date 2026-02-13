import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, '../../..')

const srcDir = path.join(repoRoot, 'docs', 'images')
const destDir = path.join(repoRoot, 'apps', 'docs', 'public', 'images')

// Avoid destructive deletes by tracking which files were previously synced.
// This reduces the chance of wiping manually-added assets under `public/images`.
const manifestPath = path.join(destDir, '.synced-from-docs-images.json')

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function resolveInsideDest(relPath) {
  const destRoot = path.resolve(destDir)
  const absPath = path.resolve(destDir, relPath)

  if (absPath === destRoot || !absPath.startsWith(destRoot + path.sep)) {
    throw new Error(
      `[sync-images] Refusing to remove path outside destDir: ${relPath}`
    )
  }

  return absPath
}

async function readManifest() {
  if (!(await pathExists(manifestPath))) return null

  try {
    const raw = await fs.readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.files)) return null

    const files = parsed.files.filter((f) => typeof f === 'string')

    return { ...parsed, files }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[sync-images] Failed to read manifest (${msg}); skipping prune.`)
    return null
  }
}

async function listFilesRecursive(dir, rootDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  const files = []
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absPath, rootDir)))
      continue
    }

    if (entry.isFile()) {
      files.push(path.relative(rootDir, absPath))
    }
  }

  return files.sort()
}

if (!(await pathExists(srcDir))) {
  console.warn(`[sync-images] Source directory not found: ${srcDir}`)
  process.exit(0)
}

await fs.mkdir(destDir, { recursive: true })

const previous = await readManifest()
if (previous?.files?.length) {
  for (const relPath of previous.files) {
    const absPath = resolveInsideDest(relPath)
    if (absPath === manifestPath) continue

    // `force: true` means it's fine if the file doesn't exist.
    await fs.rm(absPath, { force: true })
  }
}

await fs.cp(srcDir, destDir, {
  recursive: true
})

const files = await listFilesRecursive(srcDir)
await fs.writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      srcDir: path.relative(repoRoot, srcDir),
      files
    },
    null,
    2
  )}\n`
)

console.log(
  `[sync-images] Copied ${path.relative(repoRoot, srcDir)} → ${path.relative(
    repoRoot,
    destDir
  )}`
)
