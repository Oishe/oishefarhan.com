// Runtime half of the shared visual language (Phase 11).
//
// Most of a Quarto fragment can be themed from CSS, because it is markup inside
// the Quartz page frame. Plotly is the exception, for the reason quartoTheme.ts
// gives. This is the glue: find the figures, resolve the theme variables the
// stylesheet already uses, and hand both to plotlyThemeUpdate -- on load, on
// every theme toggle, and whenever a figure appears late.
//
// The build-time Plotly template in vault/_theme/knowledge_theme already lands
// a figure on a transparent background, so nothing flashes white before this
// runs. This pass upgrades the ink from the dual-theme neutral a rasterised
// figure is stuck with to the live theme's actual text colour.

import { plotlyThemeUpdate, type Plotly, type PlotColors, type PlotlyElement } from "../quartoTheme"

/** Signature of the theme last applied, so a redraw does not retrigger a relayout. */
const applied = new WeakMap<PlotlyElement, string>()

let installed = false

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function themePlots(): void {
  const plotly = (window as unknown as { Plotly?: Plotly }).Plotly
  if (!plotly) return

  // `.js-plotly-plot` is set by Plotly on the container it has drawn into, so
  // its presence also means the library finished loading.
  const plots = document.querySelectorAll<PlotlyElement>(".quarto-content .js-plotly-plot")
  if (plots.length === 0) return

  const colors: PlotColors = {
    ink: token("--darkgray"),
    muted: token("--lightgray"),
    line: token("--gray"),
    surface: token("--light"),
  }
  if (!colors.ink) return

  const signature = Object.values(colors).join("|")
  for (const plot of plots) {
    if (applied.get(plot) === signature) continue
    applied.set(plot, signature)
    void plotly.relayout(plot, plotlyThemeUpdate(plot.layout, colors))
  }
}

function install(): void {
  if (installed) return
  const content = document.querySelector(".quarto-page .quarto-content")
  if (!content) return
  installed = true

  themePlots()

  // Plotly draws asynchronously, and a widget can be created long after load,
  // so the sweep repeats whenever the content subtree changes. The signature
  // guard above keeps a relayout from retriggering the observer forever.
  let scheduled = 0
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = window.setTimeout(() => {
      scheduled = 0
      themePlots()
    }, 50)
  })
  observer.observe(content, { childList: true, subtree: true })

  document.addEventListener("themechange", themePlots)
}

install()
// Entering a Quarto page is always a full document load (the bridge marks the
// page data-spa-exclude), so this only matters if that ever stops being true.
document.addEventListener("nav", install)
