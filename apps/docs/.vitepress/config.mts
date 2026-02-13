import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'tspice',
  description: 'TypeScript SPICE toolkit',
  base: '/tspice/',

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
