import { h, nextTick, onMounted, watch } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useRoute } from 'vitepress'

import './custom.css'

type MermaidApi = {
  initialize: (config: unknown) => void
  run?: (config: { querySelector: string }) => Promise<void>
  init?: (config: unknown, nodes: NodeListOf<Element>) => void
}

let mermaidPromise: Promise<MermaidApi> | null = null
let lastMermaidThemeKey: string | null = null

async function getMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => (mod.default ?? mod) as MermaidApi)
  }

  return mermaidPromise
}

function getCssVariable(styles: CSSStyleDeclaration, name: string): string | undefined {
  const value = styles.getPropertyValue(name).trim()
  return value.length > 0 ? value : undefined
}

function getMermaidThemeVariables(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement)

  // These are defined in `apps/docs/.vitepress/theme/custom.css`.
  const bg = getCssVariable(styles, '--orrery-bg')
  const panelBg = getCssVariable(styles, '--orrery-panel-bg')
  const panelBorder = getCssVariable(styles, '--orrery-panel-border')
  const text = getCssVariable(styles, '--orrery-text')
  const phosphor = getCssVariable(styles, '--orrery-phosphor-fg')
  const activeBg = getCssVariable(styles, '--orrery-active-bg')

  return {
    background: bg ?? '#0b0f14',
    primaryColor: panelBg ?? 'rgba(10, 14, 20, 0.85)',
    primaryBorderColor: panelBorder ?? 'rgba(255, 255, 255, 0.1)',
    primaryTextColor: text ?? 'rgba(255, 255, 255, 0.9)',
    lineColor: phosphor ?? '#8f8',
    secondaryColor: activeBg ?? 'rgba(136, 255, 136, 0.12)',
    tertiaryColor: panelBg ?? 'rgba(10, 14, 20, 0.85)'
  }
}

async function ensureMermaidInitialized(): Promise<MermaidApi | null> {
  if (typeof window === 'undefined') return null

  const mermaid = await getMermaid()
  const themeVariables = getMermaidThemeVariables()
  const themeKey = JSON.stringify(themeVariables)
  if (themeKey === lastMermaidThemeKey) return mermaid

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables
  })

  lastMermaidThemeKey = themeKey
  return mermaid
}

async function renderMermaidDiagrams(): Promise<void> {
  if (typeof window === 'undefined') return

  const mermaid = await ensureMermaidInitialized()
  if (!mermaid) return

  // Mermaid marks processed diagrams via `data-processed`.
  // Avoid forcing a re-parse of already-rendered SVG.
  const selector = '.mermaid:not([data-processed])'

  if (typeof mermaid.run === 'function') {
    await mermaid.run({ querySelector: selector })
  } else if (typeof mermaid.init === 'function') {
    mermaid.init(undefined, document.querySelectorAll(selector))
  }
}

export default {
  extends: DefaultTheme,

  Layout: () => {
    const route = useRoute()

    let rendering: Promise<void> | null = null
    let pending = false
    let renderToken = 0

    const render = async () => {
      if (typeof window === 'undefined') return

      renderToken += 1
      const token = renderToken

      // Coalesce rapid triggers (navigation / hydration) so we never run Mermaid
      // concurrently and only render the latest page state.
      if (rendering) {
        pending = true
        return
      }

      rendering = (async () => {
        await nextTick()
        if (token !== renderToken) return
        await renderMermaidDiagrams()
      })()

      try {
        await rendering
      } finally {
        rendering = null
        if (pending) {
          pending = false
          await render()
        }
      }
    }

    onMounted(render)
    watch(() => route.path, render)

    return h(DefaultTheme.Layout)
  }
} satisfies Theme
