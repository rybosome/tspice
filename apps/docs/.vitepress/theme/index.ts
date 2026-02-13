import { h, nextTick, onMounted, watch } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useData, useRoute } from 'vitepress'

import './custom.css'

async function renderMermaidDiagrams(isDark: boolean): Promise<void> {
  if (typeof window === 'undefined') return

  const mod = await import('mermaid')
  const mermaid = mod.default ?? mod

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: '#0b0f14',
      primaryColor: 'rgba(10, 14, 20, 0.85)',
      primaryBorderColor: '#3a7',
      primaryTextColor: 'rgba(255, 255, 255, 0.9)',
      lineColor: isDark ? '#8f8' : '#3a7',
      secondaryColor: 'rgba(136, 255, 136, 0.12)',
      tertiaryColor: 'rgba(10, 14, 20, 0.85)'
    }
  })

  // Mermaid avoids re-processing diagrams via a `data-processed` marker.
  // Clear it so theme toggles (and SPA route changes) can re-render.
  document
    .querySelectorAll<HTMLElement>('.mermaid[data-processed]')
    .forEach((el) => el.removeAttribute('data-processed'))

  if (typeof mermaid.run === 'function') {
    await mermaid.run({ querySelector: '.mermaid' })
  } else if (typeof mermaid.init === 'function') {
    mermaid.init(undefined, document.querySelectorAll('.mermaid'))
  }
}

export default {
  extends: DefaultTheme,

  Layout: () => {
    const { isDark } = useData()
    const route = useRoute()

    const render = async () => {
      if (typeof window === 'undefined') return

      await nextTick()
      await renderMermaidDiagrams(isDark.value)
    }

    onMounted(render)
    watch(() => route.path, render)
    watch(isDark, render)

    return h(DefaultTheme.Layout)
  }
} satisfies Theme
