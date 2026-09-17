import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { parse as parseYaml } from "yaml"

// Shared visual language (Phase 11). vault/_theme/tokens.yaml is the
// only place a colour, font, or chart value is written down; this projects it
// into the four consumers that cannot read it directly. Every projection is
// reproducible from the source, so `--check` can prove none has drifted.

export type Mode = "light" | "dark"

export type DesignTokens = {
  colors: Record<Mode, Record<string, string>>
  typography: { header: string; body: string; code: string }
  /** The shiki theme each mode was derived from, kept for provenance. */
  syntaxThemes: Record<Mode, string>
  syntax: Record<Mode, Record<string, string>>
  chart: {
    grounds: Record<Mode, string>
    ink: string
    gridAlpha: number
    series: string[]
    fontSize: number
    lineWidth: number
    markerSize: number
  }
}

export type GeneratedFile = { path: string; contents: string }

export type GenerateOptions = {
  tokensPath: string
  palettesDir: string
  vaultTokensJsonPath: string
  mplStylePath: string
  siteScssPath: Record<Mode, string>
}

export const defaultOptions: GenerateOptions = {
  tokensPath: "vault/_theme/tokens.yaml",
  palettesDir: "vault/_theme/palettes",
  vaultTokensJsonPath: "vault/_theme/knowledge_theme/tokens.json",
  mplStylePath: "vault/_theme/knowledge_theme/knowledge.mplstyle",
  siteScssPath: {
    light: "vault/_theme/site-light.scss",
    dark: "vault/_theme/site-dark.scss",
  },
}

/** Reading measure, in px. The width of the article column. */
const BODY_WIDTH = "736px"

const BANNER = "Generated from vault/_theme/tokens.yaml by scripts/generate-design-tokens.ts."
const EDIT_HINT = "Edit that file and run `npm run design-tokens`; do not edit this one."

const COLOR_KEYS = [
  "light",
  "lightgray",
  "gray",
  "darkgray",
  "dark",
  "secondary",
  "tertiary",
  "highlight",
  "textHighlight",
] as const

// Pandoc/skylighting emits a two-letter class per token. Several classes map to
// the same semantic token; the grouping is documented alongside `syntax:` in
// vault/_theme/tokens.yaml and duplicated nowhere else.
export const SYNTAX_CLASSES: Record<string, string[]> = {
  keyword: ["kw", "cf", "im"],
  type: ["dt"],
  number: ["dv", "bn", "fl"],
  string: ["ch", "st", "vs", "ss"],
  comment: ["co", "do", "cv"],
  function: ["fu"],
  variable: ["va"],
  builtin: ["bu", "cn", "sc"],
  operator: ["op"],
  meta: ["pp", "at", "an", "in"],
  error: ["al", "er", "wa"],
}

/**
 * Where each semantic token comes from in a TextMate theme, most specific
 * first. Pandoc names tokens by role and shiki colours them by scope, so this
 * table is the join between the two vocabularies -- the one piece of the
 * mapping that is a judgement call rather than a lookup.
 *
 * A theme that declares none of a token's scopes falls back to its own body
 * text colour, which is what an editor shows for that token anyway. Catppuccin
 * genuinely renders variables as plain text, for instance; that is the theme
 * being faithful, not the resolver giving up.
 */
export const SYNTAX_SCOPES: Record<string, string[]> = {
  keyword: ["keyword.control", "keyword"],
  type: ["entity.name.type", "storage.type", "support.type"],
  number: ["constant.numeric"],
  string: ["string"],
  comment: ["comment"],
  function: ["entity.name.function", "support.function"],
  variable: ["variable"],
  builtin: ["support.function", "constant.language", "support"],
  operator: ["keyword.operator"],
  meta: ["meta.preprocessor", "entity.other.attribute-name"],
  error: ["invalid.illegal", "invalid"],
}

type TextMateTheme = {
  name?: string
  colors?: Record<string, string>
  tokenColors?: { scope?: string | string[]; settings?: { foreground?: string } }[]
}

/**
 * TextMate scope matching: a rule applies when its scope is a dot-delimited
 * prefix of the query, and the longest such prefix wins. Later rules win ties,
 * matching how editors resolve a theme.
 */
function foregroundForScope(theme: TextMateTheme, query: string): string | null {
  let best: string | null = null
  let bestDepth = -1

  for (const rule of theme.tokenColors ?? []) {
    const foreground = rule.settings?.foreground
    if (!foreground) continue
    const scopes = Array.isArray(rule.scope) ? rule.scope : rule.scope ? [rule.scope] : []
    for (const raw of scopes) {
      const scope = raw.trim()
      if (scope !== query && !query.startsWith(`${scope}.`)) continue
      const depth = scope.split(".").length
      if (depth >= bestDepth) {
        best = foreground
        bestDepth = depth
      }
    }
  }

  return best
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** Trim a #rrggbbaa to #rrggbb; theme UI colours sometimes carry alpha. */
function opaque(hex: string): string | null {
  const value = hex.trim()
  if (HEX.test(value)) return value.toLowerCase()
  if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7).toLowerCase()
  return null
}

export function deriveSyntaxTokens(theme: TextMateTheme, where: string): Record<string, string> {
  const foreground = opaque(theme.colors?.["editor.foreground"] ?? "")
  if (!foreground) {
    fail(`${where}: theme "${theme.name ?? "?"}" declares no usable editor.foreground`)
  }

  const resolved: Record<string, string> = {}
  for (const [token, scopes] of Object.entries(SYNTAX_SCOPES)) {
    let hex: string | null = null
    for (const scope of scopes) {
      const found = foregroundForScope(theme, scope)
      if (found) {
        hex = opaque(found)
        if (hex) break
      }
    }
    // Errors are the one token worth chasing outside the scope table: a theme
    // that never highlights `invalid` still names an error colour for its UI,
    // and stderr rendered in body text would read as ordinary output.
    if (!hex && token === "error") {
      for (const key of ["errorForeground", "editorError.foreground"]) {
        const found = theme.colors?.[key]
        if (found) {
          hex = opaque(found)
          if (hex) break
        }
      }
    }
    resolved[token] = hex ?? foreground
  }

  return resolved
}

/**
 * Load a bundled shiki theme by name. The same themes are compiled into
 * @quartz-community/syntax-highlighting, so naming one here and the same one in
 * quartz.config.yaml is what keeps a Python cell in a .qmd and a fenced block
 * in a .md reading identically.
 */
export async function loadSyntaxTheme(name: string, where: string): Promise<TextMateTheme> {
  try {
    return (await import(`@shikijs/themes/${name}`)).default as TextMateTheme
  } catch {
    fail(`${where}: "${name}" is not a bundled shiki theme name`)
  }
}

function fail(message: string): never {
  throw new Error(`vault/_theme/tokens.yaml: ${message}`)
}

function requireString(record: Record<string, unknown>, key: string, where: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${where}.${key} must be a non-empty string`)
  }
  return value
}

function requireNumber(record: Record<string, unknown>, key: string, where: string): number {
  const value = record[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${where}.${key} must be a number`)
  }
  return value
}

function requireRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${where} must be a mapping`)
  }
  return value as Record<string, unknown>
}

export type ParsedTokens = {
  palette: string
  typography: DesignTokens["typography"]
  chart: Omit<DesignTokens["chart"], "grounds">
}

export type Palette = {
  colors: DesignTokens["colors"]
  syntaxThemes: DesignTokens["syntaxThemes"]
}

export function parseTokens(source: string): ParsedTokens {
  const root = requireRecord(parseYaml(source), "root")

  const palette = requireString(root, "palette", "root")

  const typographyRecord = requireRecord(root.typography, "typography")
  const typography = {
    header: requireString(typographyRecord, "header", "typography"),
    body: requireString(typographyRecord, "body", "typography"),
    code: requireString(typographyRecord, "code", "typography"),
  }


  const chartRecord = requireRecord(root.chart, "chart")
  const series = chartRecord.series
  if (!Array.isArray(series) || series.length === 0) {
    fail("chart.series must be a non-empty list")
  }
  if (chartRecord.grounds !== undefined) {
    fail(
      "chart.grounds is derived from colors.*.light; remove it rather than keeping a second copy",
    )
  }
  const chart = {
    ink: requireString(chartRecord, "ink", "chart"),
    gridAlpha: requireNumber(chartRecord, "gridAlpha", "chart"),
    series: series.map((value, index) => {
      if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
        fail(`chart.series[${index}] must be a #rrggbb colour`)
      }
      return value
    }),
    fontSize: requireNumber(chartRecord, "fontSize", "chart"),
    lineWidth: requireNumber(chartRecord, "lineWidth", "chart"),
    markerSize: requireNumber(chartRecord, "markerSize", "chart"),
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(chart.ink)) {
    fail("chart.ink must be a #rrggbb colour")
  }

  return { palette, typography, chart }
}


/**
 * A palette file: the nine colour roles for both modes, plus the shiki theme
 * each mode derives its syntax colours from.
 *
 * The two travel together on purpose. A page palette and a code palette that
 * disagree is exactly the drift this indirection exists to prevent, and it is
 * the drift that was already in the tree -- quartz.config.yaml named one GitHub
 * variant while the hand-written syntax hexes came from another.
 */
export function parsePalette(source: string, where: string): Palette {
  const root = requireRecord(parseYaml(source), where)

  const colorsRoot = requireRecord(root.colors, `${where}.colors`)
  const colors = {} as DesignTokens["colors"]
  for (const mode of ["light", "dark"] as const) {
    const modeRecord = requireRecord(colorsRoot[mode], `${where}.colors.${mode}`)
    const resolved: Record<string, string> = {}
    for (const key of COLOR_KEYS) {
      resolved[key] = requireString(modeRecord, key, `${where}.colors.${mode}`)
    }
    const unknown = Object.keys(modeRecord).filter(
      (key) => !(COLOR_KEYS as readonly string[]).includes(key),
    )
    if (unknown.length > 0) {
      fail(`${where}.colors.${mode} has keys Quartz does not consume: ${unknown.join(", ")}`)
    }
    colors[mode] = resolved
  }

  const syntaxRoot = requireRecord(root.syntax, `${where}.syntax`)
  const syntaxThemes = {} as DesignTokens["syntaxThemes"]
  for (const mode of ["light", "dark"] as const) {
    syntaxThemes[mode] = requireString(syntaxRoot, mode, `${where}.syntax`)
  }

  return { colors, syntaxThemes }
}

/**
 * Read the token file and colour in the syntax palette from the named shiki
 * themes. Split from `parseTokens` only because loading a theme is an async
 * import; everything that validates the source stays synchronous.
 */
export async function loadTokens(source: string, palettesDir: string): Promise<DesignTokens> {
  const parsed = parseTokens(source)

  const palettePath = path.join(palettesDir, `${parsed.palette}.yaml`)
  let paletteSource: string
  try {
    paletteSource = await readFile(palettePath, "utf8")
  } catch {
    fail(`palette "${parsed.palette}" has no file at ${palettePath}`)
  }
  const { colors, syntaxThemes } = parsePalette(paletteSource, `palettes/${parsed.palette}.yaml`)

  const syntax = {} as DesignTokens["syntax"]
  for (const mode of ["light", "dark"] as const) {
    const theme = await loadSyntaxTheme(syntaxThemes[mode], `syntax.${mode}`)
    syntax[mode] = deriveSyntaxTokens(theme, `syntax.${mode}`)
  }

  return {
    ...parsed,
    colors,
    syntaxThemes,
    syntax,
    // A figure is rasterised once and served to both themes, so it has to stay
    // legible on both page backgrounds -- which are the palette's own.
    chart: { ...parsed.chart, grounds: { light: colors.light.light, dark: colors.dark.light } },
  }
}

// ---------------------------------------------------------------------------
// Contrast. Chart tokens are the only ones that have to survive both themes at
// once, so the generator refuses to emit values that would not.
// ---------------------------------------------------------------------------

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** WCAG 1.4.11: graphical objects need 3:1 against their background. */
const MIN_CHART_CONTRAST = 3

export function assertChartLegibility(tokens: DesignTokens): void {
  const grounds = Object.values(tokens.chart.grounds)
  const failures: string[] = []

  const check = (name: string, colour: string) => {
    for (const ground of grounds) {
      const ratio = contrastRatio(colour, ground)
      if (ratio < MIN_CHART_CONTRAST) {
        failures.push(`${name} (${colour}) is ${ratio.toFixed(2)}:1 on ${ground}`)
      }
    }
  }

  check("chart.ink", tokens.chart.ink)
  tokens.chart.series.forEach((colour, index) => check(`chart.series[${index}]`, colour))

  if (failures.length > 0) {
    throw new Error(
      "Chart tokens are rendered once and served to both themes, so each must clear " +
        `${MIN_CHART_CONTRAST}:1 against both background colours. Below threshold:\n` +
        failures.map((line) => `  ${line}`).join("\n"),
    )
  }
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

function rgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The two halves of the --qmd-* surface, shared by both consumers: the Quartz
 * stylesheet that styles the embedded Quarto fragment, and the Quarto theme
 * that makes `quarto preview` show the same colours. One emitter means the two
 * cannot drift.
 */
function qmdSyntaxDeclarations(tokens: DesignTokens, mode: Mode): string[] {
  return Object.entries(tokens.syntax[mode]).map(
    ([token, value]) => `  --qmd-syntax-${token}: ${value};`,
  )
}

/** Chart tokens are mode-independent: one raster has to survive both themes. */
function qmdChartDeclarations(tokens: DesignTokens): string[] {
  return [
    `  --qmd-chart-ink: ${tokens.chart.ink};`,
    `  --qmd-chart-grid: ${rgba(tokens.chart.ink, tokens.chart.gridAlpha)};`,
    ...tokens.chart.series.map((colour, index) => `  --qmd-chart-series-${index + 1}: ${colour};`),
  ]
}

/**
 * A Quarto theme for `quarto preview`, one file per mode.
 *
 * The published page is a body fragment: `minimal: true` means Quarto compiles
 * no theme at all and Quartz supplies every colour. That leaves `quarto
 * preview` with nothing to look at, so the preview profile turns the chrome
 * back on -- and until this file existed it turned on *bootswatch* chrome,
 * which is why drafting happened against a page that looked nothing like the
 * published one.
 *
 * Two files rather than one because Quarto compiles a separate Bootstrap
 * bundle per mode and switches them by toggling `rel` on link#quarto-bootstrap.
 * `$body-bg` cannot hold both values. It also means each bundle can define
 * `--qmd-*` on a plain `:root`: exactly one is ever active, so a cell reading
 * `getComputedStyle(document.body)` resolves the right mode with no
 * dark-mode selector in sight.
 */
export function renderSiteScss(tokens: DesignTokens, mode: Mode): string {
  const colors = tokens.colors[mode]
  const { header, body, code } = tokens.typography
  const families = (name: string, fallback: string) => `"${name}", ${fallback}`
  const sans = families(body, "system-ui, -apple-system, sans-serif")

  return `// ${BANNER}
// ${EDIT_HINT}
//
// The ${mode} half of the site theme. Paired with site-${mode === "light" ? "dark" : "light"}.scss
// in vault/_quarto.yml; Quarto compiles one bundle per mode.

/*-- scss:defaults --*/

// Bootstrap's surface, repainted from tokens.yaml. These are the
// variables that decide what the page looks like before a single rule runs.
$body-bg: ${colors.light};
$body-color: ${colors.darkgray};
$link-color: ${colors.secondary};
$link-hover-color: ${colors.secondary};
$border-color: ${colors.lightgray};

$font-family-sans-serif: ${sans};
$font-family-monospace: ${families(code, "ui-monospace, SFMono-Regular, monospace")};
$headings-font-family: ${families(header, sans)};
$headings-color: ${colors.dark};

// The top bar reads as part of the page rather than a separate surface: the
// same ground, separated by a rule rather than a fill. Left unset it keeps
// Bootswatch's $gray-100 in *both* bundles, so the bar stayed light on a dark
// page -- measured as rgb(248, 249, 250) either way.
//
// $navbar-fg has to be set explicitly, not inherited. Quarto hardcodes
// data-bs-theme="dark" on the <nav> element, and one HTML file serves both
// stylesheets, so that attribute cannot vary by mode; without an explicit
// foreground Bootstrap's dark-context defaults would paint light text onto the
// light bundle's bar.
$navbar-bg: ${colors.light};
$navbar-fg: ${colors.darkgray};
$navbar-hl: ${colors.secondary};

// Google Fonts, the three the palette names. Bootswatch's hook, so Quarto emits
// the stylesheet link rather than an @import that would land mid-file.
$web-font-path: "https://fonts.googleapis.com/css2?family=${header.replace(/ /g, "+")}:wght@400;600;700&family=${body.replace(/ /g, "+")}:wght@400;600&family=${code.replace(/ /g, "+")}:wght@400&display=swap";

$code-color: ${colors.secondary};
$code-block-bg: ${colors.light};
$code-block-border-left: ${colors.lightgray};

// The reading measure. A figure sized from the column width is sized from this
// number.
$grid-body-width: ${BODY_WIDTH};
// Quarto scales the root up to 1.0625rem. Measured: MathJax scales with it, so
// a display equation rendered 224px wide at 17px against 211px at 16px. Pinned
// so the measure and the equations stay on one scale. It is $font-size-root
// that does it, not $font-size-base; the root is what every rem is measured
// against.
$font-size-root: 16px;
$font-size-base: 1rem;
// There is no left sidebar -- navigation is the navbar -- so that gutter is
// zero. The right one is not: toc-location: right puts the table of contents
// in the margin column, and at 0px it rendered into a zero-width box. The
// markup was in every article and none of it was visible. 300px is Quarto's
// own default and the width the sticky TOC was designed against.
$grid-sidebar-width: 0px;
$grid-margin-width: 300px;

$callout-color-note: ${colors.secondary};
$callout-color-tip: ${colors.tertiary};
$callout-color-important: ${tokens.syntax[mode].error};
$callout-color-warning: ${tokens.syntax[mode].variable};
$callout-color-caution: ${tokens.syntax[mode].type};

/*-- scss:rules --*/

// A rule, not a fill: the bar shares the page's ground, so without this it has
// no edge at all. The background is restated here because Quarto's own navbar
// stylesheet loads after the theme bundle.
.navbar {
  background-color: ${colors.light};
  border-bottom: 1px solid ${colors.lightgray};
}

// The wordmark is the one navbar item that carries heading weight.
.navbar .navbar-brand,
.navbar .navbar-title {
  color: ${colors.dark};
}

:root {
  // Native controls -- the audio player, scrollbars, form fields -- are painted
  // by the browser, not by CSS. Without this they stay light on a dark page.
  color-scheme: ${mode};

${qmdSyntaxDeclarations(tokens, mode).join("\n")}

${qmdChartDeclarations(tokens).join("\n")}

  // Palette names exposed directly, so a document reaching for var(--darkgray)
  // in an inline style resolves against the same tokens.
${Object.entries(colors)
  .map(([name, value]) => `  --${name}: ${value};`)
  .join("\n")}
}

// Pandoc's highlight classes. Quarto ships its own colours for these from a
// separate stylesheet that loads *before* the theme bundle, so these win on
// order at equal specificity and repaint them from the shared tokens.
${Object.entries(SYNTAX_CLASSES)
  .map(
    ([token, classes]) =>
      `${classes.map((name) => `code span.${name}`).join(",\n")} {\n  color: var(--qmd-syntax-${token});\n}`,
  )
  .join("\n\n")}
`
}

/** The whole token tree, for the Python side to read without a YAML parser. */
export function renderVaultTokensJson(tokens: DesignTokens): string {
  return `${JSON.stringify({ _generated: BANNER, ...tokens }, null, 2)}\n`
}

/**
 * matplotlib rc. Backgrounds are transparent so the Quartz surface shows
 * through in either theme, and every colour comes from chart tokens, which the
 * generator has already proven legible against both.
 */
export function renderMplStyle(tokens: DesignTokens): string {
  const { chart, typography } = tokens
  const cycle = chart.series.join(", ")
  return [
    `# ${BANNER}`,
    `# ${EDIT_HINT}`,
    "#",
    "# A figure is rasterised once and served to both themes, so it carries no",
    "# background of its own and draws in a neutral that clears 3:1 on each.",
    "",
    "figure.facecolor: none",
    "axes.facecolor: none",
    "savefig.facecolor: none",
    "savefig.edgecolor: none",
    "savefig.transparent: True",
    "",
    `font.family: sans-serif`,
    `font.sans-serif: ${typography.body}, DejaVu Sans, sans-serif`,
    `font.size: ${chart.fontSize}`,
    "",
    `text.color: ${chart.ink}`,
    `axes.labelcolor: ${chart.ink}`,
    `axes.edgecolor: ${chart.ink}`,
    `axes.titlecolor: ${chart.ink}`,
    `xtick.color: ${chart.ink}`,
    `ytick.color: ${chart.ink}`,
    `xtick.labelcolor: ${chart.ink}`,
    `ytick.labelcolor: ${chart.ink}`,
    "",
    "axes.grid: True",
    `grid.color: ${chart.ink}`,
    `grid.alpha: ${chart.gridAlpha}`,
    "grid.linewidth: 0.6",
    "",
    "axes.spines.top: False",
    "axes.spines.right: False",
    `axes.prop_cycle: cycler('color', [${chart.series.map((c) => `'${c.replace("#", "")}'`).join(", ")}])`,
    "",
    `lines.linewidth: ${chart.lineWidth}`,
    `lines.markersize: ${chart.markerSize}`,
    "",
    "legend.frameon: False",
    `legend.labelcolor: ${chart.ink}`,
    "",
    "figure.dpi: 144",
    "savefig.dpi: 144",
    "savefig.bbox: tight",
    "",
    `# series: ${cycle}`,
    "",
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export async function generateDesignTokens(
  overrides: Partial<GenerateOptions> = {},
): Promise<GeneratedFile[]> {
  const options = { ...defaultOptions, ...overrides }
  const tokens = await loadTokens(await readFile(options.tokensPath, "utf8"), options.palettesDir)
  assertChartLegibility(tokens)

  return [
    { path: options.vaultTokensJsonPath, contents: renderVaultTokensJson(tokens) },
    { path: options.mplStylePath, contents: renderMplStyle(tokens) },
    {
      path: options.siteScssPath.light,
      contents: renderSiteScss(tokens, "light"),
    },
    {
      path: options.siteScssPath.dark,
      contents: renderSiteScss(tokens, "dark"),
    },
  ]
}

async function isStale(file: GeneratedFile): Promise<boolean> {
  try {
    return (await readFile(file.path, "utf8")) !== file.contents
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true
    throw error
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check")
  let files: GeneratedFile[]
  try {
    files = await generateDesignTokens()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return
  }

  if (check) {
    const stale: string[] = []
    for (const file of files) {
      if (await isStale(file)) stale.push(file.path)
    }
    if (stale.length > 0) {
      console.error(
        "These files no longer match vault/_theme/tokens.yaml:\n" +
          stale.map((file) => `  ${file}`).join("\n") +
          "\nRun `npm run design-tokens`.",
      )
      process.exitCode = 1
      return
    }
    console.log(`Design tokens are current in ${files.length} generated file(s).`)
    return
  }

  const written: string[] = []
  for (const file of files) {
    if (await isStale(file)) {
      await writeFile(file.path, file.contents, "utf8")
      written.push(path.relative(process.cwd(), file.path))
    }
  }
  console.log(
    written.length === 0
      ? `Design tokens already current in ${files.length} generated file(s).`
      : `Rewrote ${written.join(", ")}.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
