import { defineConfig } from 'vitepress'

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

  // Ensure Turbo can cache the build output via `dist/**`.
  outDir: 'dist',

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

      '/api/': [
        {
          text: 'API',
          items: [{ text: 'Overview', link: '/api/' }]
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/rybosome/tspice' }]
  }
})
