#!/usr/bin/env node
/**
 * Generate Mars 2k normal + roughness-proxy textures from the MOLA MEGDR 16ppd DEM
 * (PDS dataset: MGS-M-MOLA-5-MEGDR-L3-V1.0).
 *
 * Outputs:
 * - apps/orrery/public/textures/planets/mars-mola-normal-2k.png
 * - apps/orrery/public/textures/planets/mars-roughness-proxy-2k.png
 *
 * Roughness is a proxy intended to be "mostly matte" (values near 1.0) with subtle
 * large-scale variation from:
 * - topographic slope magnitude (from the DEM), and
 * - albedo luminance (from the existing Viking mosaic texture).
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

import pngjsPkg from 'pngjs'
import jpegPkg from 'jpeg-js'

const { PNG } = pngjsPkg
const jpeg = jpegPkg

const MOLA_IMG_URL = 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img'
const MOLA_LBL_URL = 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.lbl'

const TARGET_W = 2048
const TARGET_H = 1024

// Matches the MEGDR label (A/B/C axis radius = 3396 km).
const MARS_RADIUS_M = 3_396_000

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const orreryDir = path.resolve(scriptDir, '..')
const texturesDir = path.join(orreryDir, 'public', 'textures', 'planets')
const dataDir = path.join(scriptDir, 'data', 'mars-mola')

const molaImgPath = path.join(dataDir, 'megt90n000eb.img')
const molaLblPath = path.join(dataDir, 'megt90n000eb.lbl')

const albedoPath = path.join(texturesDir, 'mars-viking-colorized-4k.jpg')

const normalOutPath = path.join(texturesDir, 'mars-mola-normal-2k.png')
const roughOutPath = path.join(texturesDir, 'mars-roughness-proxy-2k.png')

function parseArgs(argv) {
  const flags = new Set(argv)
  return {
    force: flags.has('--force'),
    skipDownload: flags.has('--skip-download'),
  }
}

async function pathExists(p) {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function downloadToFile(url, outPath, opts = {}) {
  const expectedBytes = opts.expectedBytes
  const minBytes = opts.minBytes ?? 1

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch() is not available. Run this script with Node 18+ (or install/use undici fetch).')
  }

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }

  if (!res.body) {
    throw new Error(`Failed to download ${url}: missing response body`)
  }

  const contentLengthRaw = res.headers.get('content-length')
  const contentLength = contentLengthRaw ? Number(contentLengthRaw) : undefined

  await fsp.mkdir(path.dirname(outPath), { recursive: true })

  const tmpPath = `${outPath}.tmp-${process.pid}`

  try {
    // Node's fetch returns a web stream; convert for pipeline().
    const body = Readable.fromWeb(res.body)
    await pipeline(body, fs.createWriteStream(tmpPath))

    const size = (await fsp.stat(tmpPath)).size

    if (!Number.isFinite(size) || size < minBytes) {
      throw new Error(`Downloaded file too small: ${tmpPath} (${size} bytes)`)
    }

    if (expectedBytes !== undefined && size !== expectedBytes) {
      throw new Error(`Downloaded file size mismatch: ${tmpPath} (${size} bytes, expected ${expectedBytes})`)
    }

    if (Number.isFinite(contentLength) && contentLength > 0 && size !== contentLength) {
      throw new Error(
        `Downloaded file size mismatch: ${tmpPath} (${size} bytes, expected content-length ${contentLength})`,
      )
    }

    // Replace atomically.
    await fsp.rename(tmpPath, outPath)
  } catch (err) {
    await fsp.rm(tmpPath, { force: true })
    throw err
  }
}

async function ensureDownloadedFile(args) {
  const { url, outPath, force, minBytes, expectedBytes, label } = args

  const exists = await pathExists(outPath)
  if (exists && !force) {
    const size = (await fsp.stat(outPath)).size
    const ok =
      Number.isFinite(size) && size >= (minBytes ?? 1) && (expectedBytes === undefined || size === expectedBytes)

    if (ok) return

    console.warn(`Cached download invalid; re-downloading (${label ?? outPath})`, {
      outPath,
      size,
      expectedBytes,
    })
  }

  console.log(`Downloading ${label ?? url}...`)
  await downloadToFile(url, outPath, { minBytes, expectedBytes })
}

function parsePdsLabel(lblText) {
  // Minimal PDS3 key=value parser for the handful of fields we care about.
  // Example: LINE_SAMPLES = 5760
  const out = {}
  for (const rawLine of lblText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('/*')) continue
    const m = /^([A-Z0-9_\^]+)\s*=\s*(.+)$/.exec(line)
    if (!m) continue

    const key = m[1]
    let value = m[2].trim()

    // Strip units like: 3396.0 <KM>
    value = value.replace(/\s*<[^>]+>\s*$/, '')

    // Strip quotes.
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }

    // Numeric if possible.
    const num = Number(value)
    out[key] = Number.isFinite(num) && value !== '' ? num : value
  }
  return out
}

function requireLabelNumber(label, key, lblPath) {
  const v = label[key]
  if (!Number.isFinite(v)) {
    throw new Error(`Missing/invalid ${key} in PDS label (${lblPath}): got ${String(v)}`)
  }
  return v
}

function requireLabelString(label, key, lblPath) {
  const v = label[key]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing/invalid ${key} in PDS label (${lblPath}): got ${String(v)}`)
  }
  return v
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function normalize3(x, y, z) {
  const inv = 1 / Math.hypot(x, y, z)
  return [x * inv, y * inv, z * inv]
}

function uint8FromUnit(v) {
  // Map [-1, 1] -> [0, 255]
  return Math.round(clamp(v * 0.5 + 0.5, 0, 1) * 255)
}

function percentileSample(values, p, maxSamples = 120_000) {
  // Approximate percentile via uniform sampling to avoid sorting huge arrays.
  const step = Math.max(1, Math.floor(values.length / maxSamples))
  const sample = []
  for (let i = 0; i < values.length; i += step) sample.push(values[i])
  sample.sort((a, b) => a - b)
  const idx = Math.floor(clamp(p, 0, 1) * (sample.length - 1))
  return sample[idx]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  await fsp.mkdir(dataDir, { recursive: true })

  if (!args.skipDownload) {
    await ensureDownloadedFile({
      url: MOLA_LBL_URL,
      outPath: molaLblPath,
      force: args.force,
      minBytes: 32,
      label: 'PDS label',
    })
  }

  const lblText = await fsp.readFile(molaLblPath, 'utf8')
  const label = parsePdsLabel(lblText)

  const srcW = requireLabelNumber(label, 'LINE_SAMPLES', molaLblPath)
  const srcH = requireLabelNumber(label, 'LINES', molaLblPath)
  const sampleBits = requireLabelNumber(label, 'SAMPLE_BITS', molaLblPath)
  const sampleType = requireLabelString(label, 'SAMPLE_TYPE', molaLblPath)

  console.log('Label summary:', {
    LINE_SAMPLES: srcW,
    LINES: srcH,
    SAMPLE_BITS: sampleBits,
    SAMPLE_TYPE: sampleType,
  })

  // Requirements/assumptions for this script:
  // - 16-bit signed integer samples
  // - big-endian (MSB) byte order
  if (sampleBits != 16 || sampleType !== 'MSB_INTEGER') {
    throw new Error(
      `Unsupported DEM format: SAMPLE_BITS=${sampleBits}, SAMPLE_TYPE=${sampleType} (expected 16-bit MSB_INTEGER)`,
    )
  }

  // Optional PDS scaling/offset (not present in the MEGDR label today, but supported).
  const scalingFactor = Number(label.SCALING_FACTOR ?? label.SCALE_FACTOR ?? 1)
  const offset = Number(label.OFFSET ?? label.ADD_OFFSET ?? label.SCALING_OFFSET ?? 0)
  if (!Number.isFinite(scalingFactor) || !Number.isFinite(offset)) {
    throw new Error(`Invalid scaling fields in label: SCALING_FACTOR=${label.SCALING_FACTOR}, OFFSET=${label.OFFSET}`)
  }

  console.log(`Reading DEM: ${srcW}×${srcH} int16 (big-endian)...`)
  if (scalingFactor != 1 || offset != 0) {
    console.log(`Applying scaling: meters = raw * ${scalingFactor} + ${offset}`)
  }

  const expectedBytes = srcW * srcH * 2

  if (!args.skipDownload) {
    await ensureDownloadedFile({
      url: MOLA_IMG_URL,
      outPath: molaImgPath,
      force: args.force,
      // Validate exact expected size so partial/corrupt downloads fail early.
      expectedBytes,
      minBytes: expectedBytes,
      label: 'PDS IMG DEM',
    })
  }

  const imgBuf = await fsp.readFile(molaImgPath)
  if (imgBuf.length !== expectedBytes) {
    throw new Error(`Unexpected IMG size: got ${imgBuf.length} bytes, expected ${expectedBytes}`)
  }

  const readDemInt16 = (x, y) => {
    const xx = ((x % srcW) + srcW) % srcW
    const yy = clamp(y, 0, srcH - 1)
    const i = (yy * srcW + xx) * 2
    const u = (imgBuf[i] << 8) | imgBuf[i + 1]
    return u & 0x8000 ? u - 0x1_0000 : u
  }

  // Downsample DEM to 2k heightmap (meters).
  console.log(`Resampling DEM -> ${TARGET_W}×${TARGET_H}...`)
  const dem = new Float32Array(TARGET_W * TARGET_H)

  for (let y = 0; y < TARGET_H; y++) {
    const sy = (y + 0.5) * (srcH / TARGET_H) - 0.5
    const y0 = Math.floor(sy)
    const y1 = y0 + 1
    const ty = sy - y0

    for (let x = 0; x < TARGET_W; x++) {
      const sx = (x + 0.5) * (srcW / TARGET_W) - 0.5
      const x0 = Math.floor(sx)
      const x1 = x0 + 1
      const tx = sx - x0

      const h00 = readDemInt16(x0, y0)
      const h10 = readDemInt16(x1, y0)
      const h01 = readDemInt16(x0, y1)
      const h11 = readDemInt16(x1, y1)

      const h0 = lerp(h00, h10, tx)
      const h1 = lerp(h01, h11, tx)
      dem[y * TARGET_W + x] = lerp(h0, h1, ty) * scalingFactor + offset
    }
  }

  console.log('Decoding albedo...')
  const albedoJpg = await fsp.readFile(albedoPath)
  const albedoDecoded = jpeg.decode(albedoJpg, { useTArray: true })

  if (!albedoDecoded?.data) {
    throw new Error('Failed to decode mars albedo jpeg')
  }

  const albedoW = albedoDecoded.width
  const albedoH = albedoDecoded.height
  const albedoData = albedoDecoded.data

  // Precompute source luminance (linear combo; texture is effectively sRGB but this is a heuristic proxy).
  const albedoLumaSrc = new Float32Array(albedoW * albedoH)
  for (let i = 0; i < albedoW * albedoH; i++) {
    const r = albedoData[i * 4 + 0]
    const g = albedoData[i * 4 + 1]
    const b = albedoData[i * 4 + 2]
    albedoLumaSrc[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }

  console.log(`Resampling albedo luminance -> ${TARGET_W}×${TARGET_H}...`)
  const albedoLuma = new Float32Array(TARGET_W * TARGET_H)

  const readLuma = (x, y) => {
    const xx = clamp(x, 0, albedoW - 1)
    const yy = clamp(y, 0, albedoH - 1)
    return albedoLumaSrc[yy * albedoW + xx]
  }

  for (let y = 0; y < TARGET_H; y++) {
    const sy = (y + 0.5) * (albedoH / TARGET_H) - 0.5
    const y0 = Math.floor(sy)
    const y1 = y0 + 1
    const ty = sy - y0

    for (let x = 0; x < TARGET_W; x++) {
      const sx = (x + 0.5) * (albedoW / TARGET_W) - 0.5
      const x0 = Math.floor(sx)
      const x1 = x0 + 1
      const tx = sx - x0

      const l00 = readLuma(x0, y0)
      const l10 = readLuma(x1, y0)
      const l01 = readLuma(x0, y1)
      const l11 = readLuma(x1, y1)

      const l0 = lerp(l00, l10, tx)
      const l1 = lerp(l01, l11, tx)
      albedoLuma[y * TARGET_W + x] = lerp(l0, l1, ty)
    }
  }

  console.log('Computing normals + slope...')
  const dLon = (2 * Math.PI) / TARGET_W
  const dLat = Math.PI / TARGET_H

  const normalRgba = new Uint8Array(TARGET_W * TARGET_H * 4)
  const slopes = new Float32Array(TARGET_W * TARGET_H)

  for (let y = 0; y < TARGET_H; y++) {
    // +pi/2 at the top row, -pi/2 at the bottom row.
    const lat = (0.5 - (y + 0.5) / TARGET_H) * Math.PI
    const cosLat = Math.cos(lat)

    const dx = MARS_RADIUS_M * Math.max(cosLat, 1e-6) * dLon
    const dy = MARS_RADIUS_M * dLat

    const yPrev = Math.max(y - 1, 0)
    const yNext = Math.min(y + 1, TARGET_H - 1)

    for (let x = 0; x < TARGET_W; x++) {
      const xPrev = (x - 1 + TARGET_W) % TARGET_W
      const xNext = (x + 1) % TARGET_W

      const hL = dem[y * TARGET_W + xPrev]
      const hR = dem[y * TARGET_W + xNext]
      const hD = dem[yNext * TARGET_W + x]
      const hU = dem[yPrev * TARGET_W + x]

      // Central differences in meters, corrected for dx shrinking with latitude.
      const dzdx = (hR - hL) / (2 * dx)
      const dzdy = (hD - hU) / (2 * dy)

      slopes[y * TARGET_W + x] = Math.hypot(dzdx, dzdy)

      // Tangent-space normal (texture x=longitude east, y=latitude south since v increases downward).
      // The -dzdy sign accounts for image-space +y pointing toward -latitude.
      const [nx, ny, nz] = normalize3(-dzdx, dzdy, 1)

      const o = (y * TARGET_W + x) * 4
      normalRgba[o + 0] = uint8FromUnit(nx)
      normalRgba[o + 1] = uint8FromUnit(ny)
      normalRgba[o + 2] = uint8FromUnit(nz)
      normalRgba[o + 3] = 255
    }
  }

  // Slope normalization for roughness proxy.
  const slopeP95 = percentileSample(slopes, 0.95)
  const slopeP99 = percentileSample(slopes, 0.99)
  console.log(`Slope percentiles: p95=${slopeP95.toFixed(4)}, p99=${slopeP99.toFixed(4)}`)

  console.log('Computing roughness proxy...')
  // Tuned for Mars: mostly matte, small variation.
  const ROUGH_BASE = 0.9
  const ROUGH_AMP = 0.1
  const W_SLOPE = 0.7
  const W_ALBEDO = 0.3

  const roughRgba = new Uint8Array(TARGET_W * TARGET_H * 4)
  for (let i = 0; i < TARGET_W * TARGET_H; i++) {
    const slopeN = clamp(slopes[i] / Math.max(slopeP95, 1e-6), 0, 1)
    const luma = albedoLuma[i]

    // Darker albedo slightly rougher, flatter slightly smoother.
    const combined = W_SLOPE * slopeN + W_ALBEDO * (1 - luma)
    const rough = clamp(ROUGH_BASE + ROUGH_AMP * combined, 0, 1)
    const u8 = Math.round(rough * 255)

    roughRgba[i * 4 + 0] = u8
    roughRgba[i * 4 + 1] = u8
    roughRgba[i * 4 + 2] = u8
    roughRgba[i * 4 + 3] = 255
  }

  console.log(`Writing ${path.relative(orreryDir, normalOutPath)}...`)
  {
    const png = new PNG({
      width: TARGET_W,
      height: TARGET_H,
      filterType: 4,
      deflateLevel: 9,
    })
    png.data = Buffer.from(normalRgba)
    await pipeline(png.pack(), fs.createWriteStream(normalOutPath))
  }

  console.log(`Writing ${path.relative(orreryDir, roughOutPath)}...`)
  {
    const png = new PNG({
      width: TARGET_W,
      height: TARGET_H,
      filterType: 4,
      deflateLevel: 9,
    })
    png.data = Buffer.from(roughRgba)
    await pipeline(png.pack(), fs.createWriteStream(roughOutPath))
  }

  const normalSize = (await fsp.stat(normalOutPath)).size
  const roughSize = (await fsp.stat(roughOutPath)).size

  console.log('Done.')
  console.log(`- normal:   ${(normalSize / (1024 * 1024)).toFixed(2)} MiB (${normalSize} bytes)`)
  console.log(`- roughness:${(roughSize / (1024 * 1024)).toFixed(2)} MiB (${roughSize} bytes)`)
}

await main()
