import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, type DefaultTheme } from 'vitepress'

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const docsApiStrict =
  process.env.DOCS_API_STRICT === '1' ||
  process.env.CI === '1' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true'

function readTypedocSidebar(jsonPathFromDocsRoot: string): DefaultTheme.SidebarItem[] {
  const jsonPath = path.resolve(docsRoot, jsonPathFromDocsRoot)

  if (!fs.existsSync(jsonPath)) {
    const message =
      `[docs] Missing TypeDoc sidebar JSON: ${jsonPathFromDocsRoot}. ` +
      `Did you run \`pnpm docs:api\`?`

    if (docsApiStrict) throw new Error(message)
    console.warn(message)
    return []
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    if (!Array.isArray(parsed)) {
      const message = `[docs] Invalid TypeDoc sidebar JSON (expected array): ${jsonPathFromDocsRoot}`

      if (docsApiStrict) throw new Error(message)
      console.warn(message)
      return []
    }
    return parsed as DefaultTheme.SidebarItem[]
  } catch (err) {
    const message =
      `[docs] Failed to parse TypeDoc sidebar JSON: ${jsonPathFromDocsRoot}. ` +
      `(${err instanceof Error ? err.message : String(err)})`

    if (docsApiStrict) throw new Error(message)
    console.warn(message)
    return []
  }
}

const tspiceReferenceSidebar = readTypedocSidebar('api/reference/tspice/typedoc-sidebar.json')
const backendContractReferenceSidebar = readTypedocSidebar(
  'api/reference/backend-contract/typedoc-sidebar.json'
)

const apiSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'API',
    items: [
      { text: 'Overview', link: '/api/' },
      { text: '@rybosome/tspice', link: '/api/reference/tspice/' },
      { text: '@rybosome/tspice-backend-contract', link: '/api/reference/backend-contract/' }
    ]
  },
  ...(tspiceReferenceSidebar.length
    ? [
        {
          text: '@rybosome/tspice',
          collapsed: true,
          items: tspiceReferenceSidebar
        }
      ]
    : []),
  ...(backendContractReferenceSidebar.length
    ? [
        {
          text: '@rybosome/tspice-backend-contract',
          collapsed: true,
          items: backendContractReferenceSidebar
        }
      ]
    : [])
]

function normalizeBase(input: string): string {
  let base = input.trim()

  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`

  return base
}

const base = (() => {
  if (process.env.VITEPRESS_BASE) {
    return normalizeBase(process.env.VITEPRESS_BASE)
  }

  // GitHub Pages project sites are typically served from `/<repoName>/`.
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repoName) return normalizeBase(`/${repoName}/`)
  }

  return '/'
})()

export default defineConfig({
  title: 'tspice',
  description: 'TypeScript SPICE toolkit',
  base,

  // Orrery is the visual authority for this repo; keep docs dark.
  appearance: 'force-dark',

  // Ensure Turbo can cache the build output via `dist/**`.
  outDir: 'dist',

  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence

      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const info = token.info.trim().split(/\s+/g)[0]

        if (info === 'mermaid') {
          const code = token.content.trim()
          return `<div class="mermaid">${md.utils.escapeHtml(code)}</div>`
        }

        if (defaultFence) return defaultFence(tokens, idx, options, env, self)
        return self.renderToken(tokens, idx, options)
      }
    }
  },

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Concepts', link: '/concepts/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'API', link: '/api/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        }
      ],

      '/concepts/': [
        {
          text: 'Concepts',
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'tspice mental model', link: '/concepts/tspice-mental-model' },
            { text: 'Time systems', link: '/concepts/time-systems' },
            { text: 'Frames', link: '/concepts/frames' },
            { text: 'Aberration corrections', link: '/concepts/aberration-corrections' },
            { text: 'Kernel taxonomy', link: '/concepts/kernel-taxonomy' }
          ]
        }
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Facade + contract seam', link: '/architecture/facade-contract/' },
            { text: 'Shared C shim', link: '/architecture/backend-shim-c/' },
            { text: 'Kernel staging + virtual paths', link: '/architecture/kernel-staging/' },
            { text: 'Backend: Node (native addon)', link: '/architecture/backend-node/' },
            { text: 'Backend: WASM', link: '/architecture/backend-wasm/' }
          ]
        }
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Browser ephemeris', link: '/examples/browser-ephemeris' },
            { text: 'Lighting', link: '/examples/lighting' },
            { text: 'Geometry', link: '/examples/geometry' }
          ]
        }
      ],

      '/api/': apiSidebar
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/rybosome/tspice' }]
  }
})
