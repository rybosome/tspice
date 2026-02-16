#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const GENERIC_KERNELS_ROOT_URL = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'

const REPO_ROOT = path.resolve(process.cwd())
const OUTPUT_PATH = path.join(REPO_ROOT, 'apps/docs/guide/kernel-inventory.md')

/**
 * NOTE: This list is intentionally conservative and tuned for NAIF's
 * `generic_kernels/` directory. We still include the historical star
 * catalog transfer formats (`*.xdb.Z`) since they're hosted here.
 */
const KERNEL_SUFFIXES = [
  '.bsp',
  '.bpc',
  '.tpc',
  '.tls',
  '.tf',
  '.bds',
  '.dsk',
  '.bdb',
  '.xdb',
  '.xdb.z'
]

const TEXT_KERNEL_SUFFIXES = ['.tls', '.tpc', '.tf']

function usage() {
  return ['Usage: node scripts/generate-naif-generic-kernel-inventory.mjs', '', `Writes: ${OUTPUT_PATH}`].join(
    '\n'
  )
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

function isTextKernel(name) {
  const lower = name.toLowerCase()
  return TEXT_KERNEL_SUFFIXES.some((s) => lower.endsWith(s))
}

function splitIntoParagraphs(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  /** @type {string[]} */
  const paragraphs = []
  /** @type {string[]} */
  let buf = []

  const flush = () => {
    const joined = buf
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    buf = []
    if (joined) paragraphs.push(joined)
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    // Blank line => paragraph break.
    if (!line.trim()) {
      flush()
      continue
    }

    // Skip obvious banner/separator lines.
    const trimmed = line.trim()
    if (/^[=\-*#]{3,}$/.test(trimmed)) continue

    buf.push(trimmed)
  }

  flush()
  return paragraphs
}

function extractFirstSentence(text, { requireTerminalPunctuation }) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  // Prefer Intl.Segmenter sentence segmentation when available.
  // (This avoids naive abbreviation issues like "et. al.".)
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    // @ts-ignore - stashing on function to avoid module globals.
    const segmenter = extractFirstSentence._segmenter ??=
      new Intl.Segmenter('en', { granularity: 'sentence' })

    // The iterator yields objects like: { segment: string, index: number, input: string, isWordLike?: boolean }
    const first = segmenter.segment(cleaned)[Symbol.iterator]().next().value

    if (first?.segment) {
      const s = first.segment.trim()

      if (requireTerminalPunctuation && !/[.!?]$/.test(s)) return null

      if (!/[.!?]$/.test(s)) return `${s}.`
      return s
    }
  }

  // Fallback: prefer true sentence terminators.
  const m = /(.+?[.!?])(?:\s|$)/.exec(cleaned)
  if (m) return m[1].trim()

  if (requireTerminalPunctuation) return null

  // Fallback: keep it short-ish and add a period.
  const clipped = cleaned.length > 240 ? cleaned.slice(0, 240).trimEnd() : cleaned
  return clipped.endsWith('.') || clipped.endsWith('!') || clipped.endsWith('?') ? clipped : `${clipped}.`
}

function extractNaifSummaryFromText(text) {
  const paragraphs = splitIntoParagraphs(text)

  for (const p of paragraphs) {
    const lower = p.toLowerCase()

    // Skip NAIF kernel/doc format identifiers.
    if (lower.startsWith('kpl/')) continue

    // Skip common metadata blocks that often precede the real description.
    if (
      lower.startsWith('original file name:') ||
      lower.startsWith('created by:') ||
      lower.startsWith('creation date:') ||
      lower.startsWith('program version:')
    ) {
      continue
    }

    // Skip headings.
    if (
      new Set([
        'modifications',
        'modifications:',
        'explanation',
        'explanation:',
        'coverage',
        'coverage:',
        'description',
        'references',
        'particulars',
        'usage',
        'input files'
      ]).has(lower)
    ) {
      continue
    }

    // Skip short all-caps title blocks (common in NAIF text kernels).
    const hasLower = /[a-z]/.test(p)
    const hasUpper = /[A-Z]/.test(p)
    if (!hasLower && hasUpper && p.length < 80) {
      const sentence = extractFirstSentence(p, { requireTerminalPunctuation: true })
      if (!sentence) continue
    }

    const sentence = extractFirstSentence(p, { requireTerminalPunctuation: false })
    if (sentence) return sentence
  }

  return null
}

function escapeMarkdownTableCell(text) {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const textCache = new Map()

async function fetchText(url, { rangeBytes } = {}) {
  const cacheKey = rangeBytes ? `${url}#range=${rangeBytes}` : url
  const existing = textCache.get(cacheKey)
  if (existing) return await existing

  const p = (async () => {
    const headers = {}
    if (rangeBytes) {
      headers.Range = `bytes=0-${rangeBytes - 1}`
    }

    const res = await fetchWithRetry(url, Object.keys(headers).length ? { headers } : undefined)
    return await res.text()
  })()

  textCache.set(cacheKey, p)
  return await p
}

function parseAaSummaries(text) {
  /** @type {Map<string, string>} */
  const byFileLower = new Map()

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const blockRe = /^\s*Summary\s+for:\s*([^\s]+)\s*$/gim
  /** @type {{name: string; startIndex: number}[]} */
  const blocks = []

  let match
  while ((match = blockRe.exec(normalized))) {
    blocks.push({ name: match[1], startIndex: match.index })
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const start = b.startIndex
    const end = i + 1 < blocks.length ? blocks[i + 1].startIndex : normalized.length

    const slice = normalized.slice(start, end)

    // Find the first start/end interval line.
    const intervalMatch =
      /^(\s*\d{4}\s+[A-Z]{3}\s+\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d{4}\s+[A-Z]{3}\s+\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s*$/m.exec(
        slice
      )

    if (intervalMatch) {
      const startEt = intervalMatch[1].trim()
      const endEt = intervalMatch[2].trim()
      byFileLower.set(b.name.toLowerCase(), `ET coverage: ${startEt} → ${endEt}.`)
      continue
    }

    // Fallback: try to convert a "Bodies:" line into something one-line-ish.
    const bodiesMatch = /^\s*Bodies:\s*(.+)$/m.exec(slice)
    if (bodiesMatch) {
      const bodies = bodiesMatch[1].replace(/\s+/g, ' ').trim()
      byFileLower.set(b.name.toLowerCase(), `Bodies: ${bodies}.`)
      continue
    }
  }

  return byFileLower
}

async function crawlGenericKernels() {
  /** @type {Set<string>} */
  const visited = new Set()

  /** @type {Map<string, {url: string; entries: ApacheListingEntry[]}>} */
  const dirByRel = new Map()

  /**
   * @typedef {Object} KernelRecord
   * @property {string} relPath
   * @property {string} fileName
   * @property {string} dirRel
   * @property {string} dirUrl
   * @property {string} url
   * @property {string} size
   */

  /** @type {KernelRecord[]} */
  const kernels = []

  const crawlDir = async (dirUrl, dirRel) => {
    if (visited.has(dirUrl)) return
    visited.add(dirUrl)

    const html = await fetchText(dirUrl)
    const pre = extractApachePre(html)
    const entries = parseApacheListing(pre)

    dirByRel.set(dirRel, { url: dirUrl, entries })

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
        fileName: e.name,
        dirRel,
        dirUrl,
        url: new URL(e.href, dirUrl).toString(),
        size: e.size
      })
    }
  }

  await crawlDir(GENERIC_KERNELS_ROOT_URL, '')

  kernels.sort((a, b) => a.relPath.localeCompare(b.relPath))

  return { kernels, dirByRel }
}

async function generateInventoryMarkdown() {
  const t0 = Date.now()

  const { kernels, dirByRel } = await crawlGenericKernels()

  /** @type {Map<string, Map<string, string>>} */
  const aaSummariesByDir = new Map()

  const getAaSummariesForDir = async (dirRel) => {
    const existing = aaSummariesByDir.get(dirRel)
    if (existing) return existing

    const dir = dirByRel.get(dirRel)
    if (!dir) {
      const empty = new Map()
      aaSummariesByDir.set(dirRel, empty)
      return empty
    }

    const aa = dir.entries.find((e) => e.kind === 'file' && e.name.toLowerCase() === 'aa_summaries.txt')
    if (!aa) {
      const empty = new Map()
      aaSummariesByDir.set(dirRel, empty)
      return empty
    }

    const url = new URL(aa.href, dir.url).toString()
    const parsed = parseAaSummaries(await fetchText(url))

    aaSummariesByDir.set(dirRel, parsed)
    return parsed
  }

  const summaries = new Map()

  for (const k of kernels) {
    const dir = dirByRel.get(k.dirRel)
    const dirEntries = dir?.entries ?? []

    // 1) Prefer per-file .cmt.
    const base = k.fileName.replace(/\.[^.]+$/, '')
    const cmt = dirEntries.find((e) => e.kind === 'file' && e.name.toLowerCase() === `${base}.cmt`.toLowerCase())
    if (cmt) {
      const cmtUrl = new URL(cmt.href, k.dirUrl).toString()
      const sum = extractNaifSummaryFromText(await fetchText(cmtUrl))
      if (sum) {
        summaries.set(k.relPath, sum)
        continue
      }
    }

    // 2) Text kernels: pull a limited range and extract from comment header.
    if (isTextKernel(k.fileName)) {
      const header = await fetchText(k.url, { rangeBytes: 64 * 1024 })
      // Drop anything after \begindata if present (comment area only).
      const commentOnly = header.split(/\\begindata/i)[0] ?? header
      const sum = extractNaifSummaryFromText(commentOnly)
      if (sum) {
        summaries.set(k.relPath, sum)
        continue
      }
    }

    // 3) Directory-level BRIEF summaries (common for SPKs without .cmt).
    const aaSummaries = await getAaSummariesForDir(k.dirRel)
    const aa = aaSummaries.get(k.fileName.toLowerCase())
    if (aa) {
      summaries.set(k.relPath, aa)
      continue
    }

    // 4) AAREADME/readme heuristics.
    const readmes = dirEntries
      .filter((e) => e.kind === 'file')
      .map((e) => e.name)
      .filter((n) => isProbablyReadmeOrIndex(n) || n.toLowerCase().startsWith('aareadme'))

    /** @type {string | null} */
    let readmeSummary = null

    for (const readmeName of readmes) {
      try {
        const url = new URL(readmeName, k.dirUrl).toString()
        const text = await fetchText(url)

        const paragraphs = splitIntoParagraphs(text)
        const fileLower = k.fileName.toLowerCase()
        const baseLower = base.toLowerCase()

        const paraIndex = paragraphs.findIndex(
          (p) => p.toLowerCase().includes(fileLower) || (!fileLower.endsWith('.xdb.z') && p.toLowerCase().includes(baseLower))
        )

        // Try surrounding paragraphs (readme blocks often list filenames in non-sentence form).
        const candidates = []
        if (paraIndex >= 0) {
          for (let offset = 0; offset <= 3; offset++) {
            const idx = paraIndex - offset
            if (idx < 0) break
            candidates.push(paragraphs[idx])
          }
        } else {
          candidates.push(...paragraphs.slice(0, 6))
        }

        for (const c of candidates) {
          const s = extractFirstSentence(c, { requireTerminalPunctuation: true })
          if (s) {
            readmeSummary = s
            break
          }
        }

        if (readmeSummary) break
      } catch {
        // ignore
      }
    }

    if (readmeSummary) {
      summaries.set(k.relPath, readmeSummary)
      continue
    }

    summaries.set(k.relPath, '(no per-file summary found; see directory aareadme)')
  }

  const groupByTop = new Map()
  for (const k of kernels) {
    const top = k.relPath.split('/')[0] || '(root)'
    const arr = groupByTop.get(top) ?? []
    arr.push(k)
    groupByTop.set(top, arr)
  }

  /** @returns {string} */
  const renderTable = (records) => {
    const rows = records.map((k) => {
      const summary = summaries.get(k.relPath) ?? '(no summary)'

      const kernelCell = `\`${k.relPath}\``
      const sizeCell = k.size
      const summaryCell = escapeMarkdownTableCell(summary)
      const urlCell = `[download](${k.url})`

      return `| ${kernelCell} | ${sizeCell} | ${summaryCell} | ${urlCell} |`
    })

    return [
      '| Kernel | Size | Summary | URL |',
      '| --- | --- | --- | --- |',
      ...rows,
      ''
    ].join('\n')
  }

  /** @type {string[]} */
  const out = []

  out.push('# NAIF generic kernel inventory')
  out.push('')
  out.push('This file is generated by `node scripts/generate-naif-generic-kernel-inventory.mjs`.')
  out.push(`Source: ${GENERIC_KERNELS_ROOT_URL}`)
  out.push('')
  out.push('Notes:')
  out.push('- Sizes are parsed from NAIF\'s Apache directory listings (humanized).')
  out.push('- Summaries are best-effort from per-file `.cmt` (preferred), text-kernel headers, and/or directory `aa_summaries.txt`/`aareadme*`.')
  out.push('')

  const topOrder = [...groupByTop.keys()].sort((a, b) => a.localeCompare(b))

  for (const top of topOrder) {
    const topKernels = groupByTop.get(top) ?? []
    if (!topKernels.length) continue

    out.push(`## ${top}`)
    out.push('')

    if (top === 'spk') {
      const byCategory = new Map()
      for (const k of topKernels) {
        const parts = k.relPath.split('/')
        const category = parts[1] ?? '(root)'
        const arr = byCategory.get(category) ?? []
        arr.push(k)
        byCategory.set(category, arr)
      }

      const cats = [...byCategory.keys()].sort((a, b) => a.localeCompare(b))
      for (const cat of cats) {
        const catRecords = byCategory.get(cat) ?? []
        out.push(`<details>`)
        out.push(`<summary><code>spk/${cat}</code> (${catRecords.length} kernels)</summary>`)
        out.push('')

        const byDir = new Map()
        for (const k of catRecords) {
          const dir = k.relPath.split('/').slice(0, -1).join('/') + '/'
          const arr = byDir.get(dir) ?? []
          arr.push(k)
          byDir.set(dir, arr)
        }

        const dirs = [...byDir.keys()].sort((a, b) => a.localeCompare(b))
        for (const dir of dirs) {
          const records = byDir.get(dir) ?? []
          out.push(`<details>`)
          out.push(`<summary><code>${dir}</code> (${records.length})</summary>`)
          out.push('')
          out.push(renderTable(records))
          out.push(`</details>`)
          out.push('')
        }

        out.push(`</details>`)
        out.push('')
      }

      continue
    }

    const byDir = new Map()
    for (const k of topKernels) {
      const dir = k.relPath.split('/').slice(0, -1).join('/') + '/'
      const arr = byDir.get(dir) ?? []
      arr.push(k)
      byDir.set(dir, arr)
    }

    const dirs = [...byDir.keys()].sort((a, b) => a.localeCompare(b))
    for (const dir of dirs) {
      const records = byDir.get(dir) ?? []
      out.push(`<details>`)
      out.push(`<summary><code>${dir}</code> (${records.length} kernels)</summary>`)
      out.push('')
      out.push(renderTable(records))
      out.push(`</details>`)
      out.push('')
    }
  }

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

  await generateInventoryMarkdown()
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
