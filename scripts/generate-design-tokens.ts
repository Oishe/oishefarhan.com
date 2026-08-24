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
  quartzConfigPath: string
  quartoTokensScssPath: string
  vaultTokensJsonPath: string
  mplStylePath: string
}

export const defaultOptions: GenerateOptions = {
  tokensPath: "vault/_theme/tokens.yaml",
  quartzConfigPath: "site/quartz.config.yaml",
  quartoTokensScssPath: "site/bridge/styles/quartoTokens.scss",
  vaultTokensJsonPath: "vault/_theme/knowledge_theme/tokens.json",
  mplStylePath: "vault/_theme/knowledge_theme/knowledge.mplstyle",
}

const BANNER = "Generated from vault/_theme/tokens.yaml by scripts/generate-design-tokens.ts."
const EDIT_HINT = "Edit that file and run `npm run design-tokens`; do not edit this one."

/**
 * Marker pair delimiting a generated region inside site/quartz.config.yaml.
 * Quartz reads one config file with no include mechanism, so token values have
 * to be inlined; the markers keep each generated region separate from the
 * hand-written plugin list around it.
 */
export const blockMarkers = (name: string, indent = "  ") => ({
  begin: `${indent}# >>> design tokens: ${name} (generated) >>>`,
  end: `${indent}# <<< design tokens: ${name} (generated) <<<`,
})

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

export function parseTokens(source: string): DesignTokens {
  const root = requireRecord(parseYaml(source), "root")

  const colorsRoot = requireRecord(root.colors, "colors")
  const colors = {} as DesignTokens["colors"]
  for (const mode of ["light", "dark"] as const) {
    const modeRecord = requireRecord(colorsRoot[mode], `colors.${mode}`)
    const resolved: Record<string, string> = {}
    for (const key of COLOR_KEYS) {
      resolved[key] = requireString(modeRecord, key, `colors.${mode}`)
    }
    const unknown = Object.keys(modeRecord).filter(
      (key) => !(COLOR_KEYS as readonly string[]).includes(key),
    )
    if (unknown.length > 0) {
      fail(`colors.${mode} has keys Quartz does not consume: ${unknown.join(", ")}`)
    }
    colors[mode] = resolved
  }

  const typographyRecord = requireRecord(root.typography, "typography")
  const typography = {
    header: requireString(typographyRecord, "header", "typography"),
    body: requireString(typographyRecord, "body", "typography"),
    code: requireString(typographyRecord, "code", "typography"),
  }

  const syntaxRoot = requireRecord(root.syntax, "syntax")
  const syntax = {} as DesignTokens["syntax"]
  for (const mode of ["light", "dark"] as const) {
    const modeRecord = requireRecord(syntaxRoot[mode], `syntax.${mode}`)
    const resolved: Record<string, string> = {}
    for (const token of Object.keys(SYNTAX_CLASSES)) {
      resolved[token] = requireString(modeRecord, token, `syntax.${mode}`)
    }
    resolved satisfies Record<string, string>
    syntax[mode] = resolved
  }

  const chartRecord = requireRecord(root.chart, "chart")
  const series = chartRecord.series
  if (!Array.isArray(series) || series.length === 0) {
    fail("chart.series must be a non-empty list")
  }
  const groundsRecord = requireRecord(chartRecord.grounds, "chart.grounds")
  const chart = {
    grounds: {
      light: requireString(groundsRecord, "light", "chart.grounds"),
      dark: requireString(groundsRecord, "dark", "chart.grounds"),
    },
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

  return { colors, typography, syntax, chart }
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

/** The `configuration.theme` region: colours and typography Quartz emits as CSS. */
export function renderQuartzThemeBlock(tokens: DesignTokens): string {
  const { begin, end } = blockMarkers("theme")
  const lines: string[] = [
    begin,
    `  # ${BANNER}`,
    `  # ${EDIT_HINT}`,
    "  theme:",
    "    fontOrigin: googleFonts",
    "    cdnCaching: true",
    "    typography:",
    `      header: ${tokens.typography.header}`,
    `      body: ${tokens.typography.body}`,
    `      code: ${tokens.typography.code}`,
    "    colors:",
  ]

  for (const [mode, key] of [
    ["light", "lightMode"],
    ["dark", "darkMode"],
  ] as const) {
    lines.push(`      ${key}:`)
    for (const colorKey of COLOR_KEYS) {
      lines.push(`        ${colorKey}: "${tokens.colors[mode][colorKey]}"`)
    }
  }

  lines.push(end)
  return lines.join("\n")
}

/**
 * The `quartz-fonts` plugin region. The plugin restates the typography the
 * theme already carries — it is what actually self-hosts the font files — so it
 * has to be generated too or the two drift apart.
 */
export function renderQuartzFontsBlock(tokens: DesignTokens): string {
  const { begin, end } = blockMarkers("fonts")
  return [
    begin,
    `  # ${BANNER}`,
    "  - source: \"@quartz-community/quartz-fonts\"",
    "    enabled: true",
    "    options:",
    `      body: ${tokens.typography.body}`,
    `      interface: ${tokens.typography.body}`,
    `      header: ${tokens.typography.header}`,
    `      code: ${tokens.typography.code}`,
    end,
  ].join("\n")
}

export function applyGeneratedBlock(config: string, name: string, block: string): string {
  const { begin, end } = blockMarkers(name)
  const start = config.indexOf(begin)
  const stop = config.indexOf(end)
  if (start === -1 || stop === -1) {
    throw new Error(
      `site/quartz.config.yaml is missing the generated "${name}" markers.\n` +
        `Wrap that region in:\n${begin}\n  ...\n${end}`,
    )
  }
  if (stop < start) {
    throw new Error(`site/quartz.config.yaml has the "${name}" markers in the wrong order`)
  }
  return config.slice(0, start) + block + config.slice(stop + end.length)
}

function rgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Custom properties the Quarto frame needs and Quartz does not define. Colours
 * that Quartz *does* define are deliberately absent: quartoPage.scss reads
 * --darkgray, --lightgray and friends straight from Quartz's own :root.
 */
export function renderQuartoTokensScss(tokens: DesignTokens): string {
  const lines: string[] = [
    `// ${BANNER}`,
    `// ${EDIT_HINT}`,
    "//",
    "// Only the tokens Quartz has no equivalent for live here. Everything else in",
    "// the Quarto frame is written against Quartz's own theme variables.",
    "",
    ":root {",
  ]

  for (const [token, value] of Object.entries(tokens.syntax.light)) {
    lines.push(`  --qmd-syntax-${token}: ${value};`)
  }
  lines.push("")
  lines.push(`  --qmd-chart-ink: ${tokens.chart.ink};`)
  lines.push(`  --qmd-chart-grid: ${rgba(tokens.chart.ink, tokens.chart.gridAlpha)};`)
  tokens.chart.series.forEach((colour, index) => {
    lines.push(`  --qmd-chart-series-${index + 1}: ${colour};`)
  })
  lines.push("}")
  lines.push("")
  lines.push(`:root[saved-theme="dark"] {`)
  for (const [token, value] of Object.entries(tokens.syntax.dark)) {
    lines.push(`  --qmd-syntax-${token}: ${value};`)
  }
  lines.push("}")
  lines.push("")
  lines.push("// Pandoc emits one two-letter class per highlighted token. The mixin keeps the")
  lines.push("// class-to-token mapping next to the values it resolves, and quartoPage.scss")
  lines.push("// decides where it applies.")
  lines.push("@mixin quarto-syntax-tokens {")
  for (const [token, classes] of Object.entries(SYNTAX_CLASSES)) {
    const selector = classes.map((name) => `span.${name}`).join(",\n  ")
    lines.push(`  ${selector} {`)
    lines.push(`    color: var(--qmd-syntax-${token});`)
    lines.push("  }")
    lines.push("")
  }
  lines.pop()
  lines.push("}")
  lines.push("")

  return lines.join("\n")
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
  const tokens = parseTokens(await readFile(options.tokensPath, "utf8"))
  assertChartLegibility(tokens)

  const quartzConfig = await readFile(options.quartzConfigPath, "utf8")

  return [
    {
      path: options.quartzConfigPath,
      contents: applyGeneratedBlock(
        applyGeneratedBlock(quartzConfig, "theme", renderQuartzThemeBlock(tokens)),
        "fonts",
        renderQuartzFontsBlock(tokens),
      ),
    },
    { path: options.quartoTokensScssPath, contents: renderQuartoTokensScss(tokens) },
    { path: options.vaultTokensJsonPath, contents: renderVaultTokensJson(tokens) },
    { path: options.mplStylePath, contents: renderMplStyle(tokens) },
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
