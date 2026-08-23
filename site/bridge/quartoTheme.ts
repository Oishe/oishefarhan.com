// The colour half of the Plotly theme pass, kept apart from the DOM glue in
// scripts/quartoTheme.inline.ts so it can be tested without a browser.
//
// Plotly is the one part of a Quarto fragment that CSS cannot reach: its
// surface, axis and hover colours live in the figure JSON and are written into
// inline SVG attributes at draw time. Following Quartz's theme toggle means
// rewriting those values, which is what this update describes.

export type PlotlyElement = HTMLElement & { layout?: Record<string, unknown> }

export type Plotly = {
  relayout: (element: PlotlyElement, update: Record<string, unknown>) => Promise<unknown>
}

/** The four Quartz theme variables a figure needs, already resolved to colours. */
export type PlotColors = {
  /** --darkgray: body text. */
  ink: string
  /** --lightgray: grid and zero lines. */
  muted: string
  /** --gray: axis and tick marks. */
  line: string
  /** --light: the page surface, for hover labels. */
  surface: string
}

export const TRANSPARENT = "rgba(0,0,0,0)"

export function plotlyThemeUpdate(
  layout: Record<string, unknown> | undefined,
  colors: PlotColors,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    paper_bgcolor: TRANSPARENT,
    plot_bgcolor: TRANSPARENT,
    "font.color": colors.ink,
    "legend.bgcolor": TRANSPARENT,
    "legend.bordercolor": colors.muted,
    "legend.font.color": colors.ink,
    "hoverlabel.bgcolor": colors.surface,
    "hoverlabel.bordercolor": colors.muted,
    "hoverlabel.font.color": colors.ink,
    "title.font.color": colors.ink,
  }

  // A figure can carry any number of axes (xaxis, xaxis2, yaxis3, ...). Only
  // the ones it actually declares are touched: naming an axis Plotly does not
  // have makes it draw one.
  for (const key of Object.keys(layout ?? {})) {
    if (!/^[xy]axis\d*$/.test(key)) continue
    update[`${key}.gridcolor`] = colors.muted
    update[`${key}.zerolinecolor`] = colors.muted
    update[`${key}.linecolor`] = colors.line
    update[`${key}.tickcolor`] = colors.line
    update[`${key}.tickfont.color`] = colors.ink
    update[`${key}.title.font.color`] = colors.ink
  }

  return update
}
