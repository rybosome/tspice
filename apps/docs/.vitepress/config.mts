import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, type DefaultTheme } from 'vitepress'

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readTypedocSidebar(jsonPathFromDocsRoot: string): DefaultTheme.SidebarItem[] {
  const jsonPath = path.resolve(docsRoot, jsonPathFromDocsRoot)
  if (!fs.existsSync(jsonPath)) return []

  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed as DefaultTheme.SidebarItem[]
  } catch {
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
          items: [{ text: 'Overview', link: '/concepts/' }]
        }
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [{ text: 'Overview', link: '/architecture/' }]
        }
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [{ text: 'Overview', link: '/examples/' }]
        }
      ],

      '/api/': apiSidebar
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/rybosome/tspice' }]
  }
})
