import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, '../../..')

const srcDir = path.join(repoRoot, 'docs', 'images')
const destDir = path.join(repoRoot, 'apps', 'docs', 'public', 'images')

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

if (!(await pathExists(srcDir))) {
  console.warn(`[sync-images] Source directory not found: ${srcDir}`)
  process.exit(0)
}

await fs.rm(destDir, { recursive: true, force: true })
await fs.mkdir(destDir, { recursive: true })

await fs.cp(srcDir, destDir, {
  recursive: true
})

console.log(
  `[sync-images] Copied ${path.relative(repoRoot, srcDir)} → ${path.relative(
    repoRoot,
    destDir
  )}`
)
