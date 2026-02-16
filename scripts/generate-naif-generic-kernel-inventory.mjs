#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const GENERIC_KERNELS_ROOT_URL = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'

const REPO_ROOT = path.resolve(process.cwd())
const OUTPUT_PATH = path.join(REPO_ROOT, 'apps/docs/guide/kernel-inventory.md')
const DESCRIPTIONS_PATH = path.join(REPO_ROOT, 'scripts/naif-generic-kernel-descriptions.json')

/**
 * NOTE: This list is intentionally conservative and tuned for NAIF's
 * `generic_kernels/` directory. We still include the historical star
 * catalog transfer formats (`*.xdb.Z`) since they're hosted here.
 */
const KERNEL_SUFFIXES = ['.bsp', '.bpc', '.tpc', '.tls', '.tf', '.bds', '.dsk', '.bdb', '.bdb', '.xdb', '.xdb.z']

function usage() {
  return [
    'Usage: node scripts/generate-naif-generic-kernel-inventory.mjs',
    '',
    `Reads:  ${DESCRIPTIONS_PATH}`,
    `Writes: ${OUTPUT_PATH}`,
    '',
    'Options:',
    '  --allow-missing-descriptions   Generate markdown with placeholder summaries (default: fail)',
    '  -h, --help                     Show help'
  ].join('\n')
}

function createLimiter(concurrency) {
  let active = 0
  /** @type {{fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void}[]} */
  const queue = []

  const pump = () => {
    while (active < concurrency && queue.length) {
      const item = queue.shift()
      if (!item) continue

      active++
      Promise.resolve()
        .then(item.fn)
        .then(
          (v) => {
            active--
            item.resolve(v)
            pump()
          },
          (err) => {
            active--
            item.reject(err)
            pump()
          }
        )
    }
  }

  return (fn) => {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      pump()
    })
  }
}

const limitNetwork = createLimiter(12)

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url, init) {
  /** @type {unknown} */
  let lastErr

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await limitNetwork(() => fetch(url, init))
      if (!res.ok) {
        // Retry 5xx and 429; treat others as terminal.
        if ((res.status >= 500 || res.status === 429) && attempt < 4) {
          await sleep(250 * attempt)
          continue
        }
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt < 4) {
        await sleep(250 * attempt)
        continue
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function extractApachePre(html) {
  const match = /<pre>([\s\S]*?)<\/pre>/i.exec(html)
  if (!match) {
    throw new Error('Failed to locate <pre>...</pre> directory listing block')
  }
  return match[1]
}

/**
 * @typedef {Object} ApacheListingEntry
 * @property {string} name
 * @property {string} href
 * @property {'file' | 'dir'} kind
 * @property {string | null} size
 */

/** @returns {ApacheListingEntry[]} */
function parseApacheListing(preHtml) {
  /** @type {ApacheListingEntry[]} */
  const entries = []

  for (const line of preHtml.split(/\r?\n/)) {
    const anchorMatch = /<a\s+href="([^"]+)">([^<]+)<\/a>/i.exec(line)
    if (!anchorMatch) continue

    const href = anchorMatch[1]
    const name = anchorMatch[2]

    // Skip sort links and parent dir (and avoid leaving generic_kernels/).
    if (href.startsWith('?')) continue
    if (name.toLowerCase() === 'parent directory') continue
    if (href.startsWith('/')) continue
    if (/^https?:/i.test(href)) continue

    const isDir = href.endsWith('/')

    const afterAnchor = line.slice(line.toLowerCase().indexOf('</a>') + '</a>'.length)
    const sizeToken = afterAnchor.trim().split(/\s+/).at(-1) ?? ''
    const size = sizeToken && sizeToken !== '-' ? sizeToken : null

    entries.push({ name, href, kind: isDir ? 'dir' : 'file', size })
  }

  return entries
}

function normalizeDirRel(relDir) {
  if (!relDir) return ''
  return relDir.endsWith('/') ? relDir : `${relDir}/`
}

function isProbablyReadmeOrIndex(name) {
  const lower = name.toLowerCase()

  // These files are *useful for summaries* but should not appear in the inventory.
  if (lower.startsWith('aareadme')) return true
  if (lower.startsWith('aa_')) return true

  // Also omit generic readmes.
  if (lower === 'readme.txt' || lower.startsWith('readme')) return true

  return false
}

function isKernelFile(name) {
  const lower = name.toLowerCase()

  if (isProbablyReadmeOrIndex(name)) return false
  if (lower.endsWith('.cmt')) return false

  // Match longest suffix first (e.g. `.xdb.z`).
  for (const suffix of KERNEL_SUFFIXES) {
    if (lower.endsWith(suffix)) return true
  }

  return false
}

function escapeMarkdownTableCell(text) {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchText(url) {
  const res = await fetchWithRetry(url)
  return await res.text()
}

/**
 * @typedef {Object} KernelRecord
 * @property {string} relPath
 * @property {string} url
 * @property {string} size
 */

/** @returns {Promise<{kernels: KernelRecord[]}>} */
async function crawlGenericKernels() {
  /** @type {Set<string>} */
  const visited = new Set()

  /** @type {KernelRecord[]} */
  const kernels = []

  const crawlDir = async (dirUrl, dirRel) => {
    if (visited.has(dirUrl)) return
    visited.add(dirUrl)

    const html = await fetchText(dirUrl)
    const pre = extractApachePre(html)
    const entries = parseApacheListing(pre)

    for (const e of entries) {
      if (e.kind === 'dir') {
        await crawlDir(new URL(e.href, dirUrl).toString(), normalizeDirRel(`${dirRel}${e.href}`))
        continue
      }

      if (!isKernelFile(e.name)) continue
      if (!e.size) continue // shouldn't happen for real files, but keep it simple.

      const relPath = `${dirRel}${e.name}`
      kernels.push({
        relPath,
        url: new URL(e.href, dirUrl).toString(),
        size: e.size
      })
    }
  }

  await crawlDir(GENERIC_KERNELS_ROOT_URL, '')

  kernels.sort((a, b) => a.relPath.localeCompare(b.relPath))

  return { kernels }
}

/** @returns {Promise<Record<string, string>>} */
async function loadDescriptions() {
  let raw
  try {
    raw = await readFile(DESCRIPTIONS_PATH, 'utf8')
  } catch (err) {
    throw new Error(`Failed to read descriptions JSON at ${DESCRIPTIONS_PATH}: ${err instanceof Error ? err.message : String(err)}`)
  }

  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Failed to parse JSON at ${DESCRIPTIONS_PATH}: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Descriptions JSON must be an object mapping relPath -> string: ${DESCRIPTIONS_PATH}`)
  }

  /** @type {Record<string, string>} */
  const out = {}

  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'string') {
      throw new Error(`Descriptions JSON value for ${JSON.stringify(k)} must be a string (got ${typeof v})`)
    }

    const trimmed = v.replace(/\s+/g, ' ').trim()
    if (!trimmed) {
      throw new Error(`Descriptions JSON value for ${JSON.stringify(k)} must be non-empty`) 
    }

    out[k] = trimmed
  }

  return out
}

function kernelTypeFromRelPath(relPath) {
  return (relPath.split('/')[0] ?? '').toUpperCase() || '(ROOT)'
}

async function generateInventoryMarkdown({ allowMissingDescriptions }) {
  const t0 = Date.now()

  const { kernels } = await crawlGenericKernels()
  const descriptions = await loadDescriptions()

  const kernelSet = new Set(kernels.map((k) => k.relPath))

  const missing = []
  for (const k of kernels) {
    if (!descriptions[k.relPath]) missing.push(k.relPath)
  }

  const extra = Object.keys(descriptions).filter((k) => !kernelSet.has(k))

  if (extra.length) {
    process.stderr.write(
      `Warning: ${extra.length} description entries are not present in NAIF inventory (JSON may be stale):\n` +
        extra.slice(0, 50).map((k) => `- ${k}`).join('\n') +
        (extra.length > 50 ? `\n... (${extra.length - 50} more)` : '') +
        '\n'
    )
  }

  if (missing.length) {
    const msg =
      `Missing curated descriptions for ${missing.length} kernels in ${DESCRIPTIONS_PATH}:\n` +
      missing.slice(0, 80).map((k) => `- ${k}`).join('\n') +
      (missing.length > 80 ? `\n... (${missing.length - 80} more)` : '')

    if (!allowMissingDescriptions) {
      throw new Error(`${msg}\n\nAdd them to the descriptions JSON (we want full manual coverage).`)
    }

    process.stderr.write(`Warning: ${msg}\n\nUsing placeholder summaries due to --allow-missing-descriptions.\n`)
  }

  const rows = kernels.map((k) => {
    const typeCell = kernelTypeFromRelPath(k.relPath)
    const kernelCell = `\`${k.relPath}\``
    const sizeCell = k.size

    const summary = descriptions[k.relPath] ?? '(missing curated summary; update scripts/naif-generic-kernel-descriptions.json)'
    const summaryCell = escapeMarkdownTableCell(summary)

    const urlCell = `[download](${k.url})`

    return `| ${typeCell} | ${kernelCell} | ${sizeCell} | ${summaryCell} | ${urlCell} |`
  })

  /** @type {string[]} */
  const out = []

  out.push('# NAIF generic kernel inventory')
  out.push('')
  out.push('This file is generated by `node scripts/generate-naif-generic-kernel-inventory.mjs`.')
  out.push(`Source: ${GENERIC_KERNELS_ROOT_URL}`)
  out.push(`Descriptions: \`${path.relative(REPO_ROOT, DESCRIPTIONS_PATH)}\` (curated, 1 sentence each).`)
  out.push('')
  out.push('| Type | Kernel | Size | Summary | URL |')
  out.push('| --- | --- | --- | --- | --- |')
  out.push(...rows)
  out.push('')

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, out.join('\n'), 'utf8')

  const seconds = ((Date.now() - t0) / 1000).toFixed(1)
  process.stdout.write(`Generated ${kernels.length} kernel rows in ${seconds}s -> ${OUTPUT_PATH}\n`)
}

async function main() {
  const args = new Set(process.argv.slice(2))

  if (args.has('--help') || args.has('-h')) {
    process.stdout.write(usage() + '\n')
    process.exit(0)
  }

  await generateInventoryMarkdown({ allowMissingDescriptions: args.has('--allow-missing-descriptions') })
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
