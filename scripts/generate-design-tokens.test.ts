import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import {
  assertChartLegibility,
  contrastRatio,
  deriveSyntaxTokens,
  generateDesignTokens,
  loadTokens,
  parsePalette,
  loadSyntaxTheme,
  parseTokens,
  renderMplStyle,
  renderSiteScss,
  SYNTAX_CLASSES,
  SYNTAX_SCOPES,
  type DesignTokens,
} from "./generate-design-tokens.ts"

const tokensSource = await readFile("vault/_theme/tokens.yaml", "utf8")
const tokens = await loadTokens(tokensSource, "vault/_theme/palettes")

// The grounds a chart must survive are the palette's own backgrounds. Keeping a
// second copy in the file is how they drifted before.
test("chart grounds come from the palette, not a second copy", async () => {
  assert.equal(tokens.chart.grounds.light, tokens.colors.light.light)
  assert.equal(tokens.chart.grounds.dark, tokens.colors.dark.light)

  const withGrounds = tokensSource.replace(
    "chart:\n",
    'chart:\n  grounds:\n    light: "#ffffff"\n    dark: "#000000"\n',
  )
  assert.throws(() => parseTokens(withGrounds), /chart\.grounds is derived/)
})

test("the committed token file parses and passes its own legibility rule", () => {
  assertChartLegibility(tokens)
  assert.ok(tokens.chart.series.length > 0)
})

const paletteSource = await readFile(`vault/_theme/palettes/${parseTokens(tokensSource).palette}.yaml`, "utf8")

test("rejects an unknown colour key", () => {
  const broken = paletteSource.replace("  light:\n    light:", "  light:\n    accent: \"#ff0000\"\n    light:")
  assert.throws(() => parsePalette(broken, "p"), /p\.colors\.light has keys Quartz does not consume: accent/)
})

// The palette is one line, so it has to fail loudly when that line is wrong --
// otherwise a typo silently keeps the previous look.
test("rejects a palette name with no file", async () => {
  await assert.rejects(
    () => loadTokens(tokensSource.replace(/^palette: .*$/m, "palette: no-such-palette"), "vault/_theme/palettes"),
    /palette "no-such-palette" has no file/,
  )
})

// Every palette in the directory is a candidate the site can be switched to on
// one line, so each must be complete and legible, not just the active one.
test("every saved palette is complete and passes the legibility rule", async () => {
  const names = (await readdir("vault/_theme/palettes")).filter((f) => f.endsWith(".yaml"))
  assert.ok(names.length > 1, "the alternatives are the point; keep more than one")
  for (const name of names) {
    const loaded = await loadTokens(
      tokensSource.replace(/^palette: .*$/m, `palette: ${name.replace(/\.yaml$/, "")}`),
      "vault/_theme/palettes",
    )
    assertChartLegibility(loaded)
    for (const mode of ["light", "dark"] as const) {
      assert.equal(Object.keys(loaded.colors[mode]).length, 9, `${name} ${mode}`)
      assert.match(loaded.syntax[mode].keyword, /^#[0-9a-f]{6}$/, `${name} ${mode}`)
    }
  }
})

test("rejects a syntax theme name that shiki does not ship", async () => {
  await assert.rejects(
    () => loadSyntaxTheme("not-a-real-theme", "syntax.light"),
    /"not-a-real-theme" is not a bundled shiki theme name/,
  )
})

test("rejects a palette whose syntax block is missing a mode", () => {
  const broken = paletteSource.replace(/^  light: \S+$/m, "")
  assert.throws(() => parsePalette(broken, "p"), /p\.syntax\.light must be a non-empty string/)
})

// The point of deriving rather than hand-writing: every token a pandoc class
// maps to must come out of the theme, so a theme swap can never leave one
// token behind at the old palette's value.
test("derives every semantic token from a theme, with no gaps", async () => {
  for (const name of ["github-light-default", "github-dark-default", "catppuccin-latte"]) {
    const theme = await loadSyntaxTheme(name, "test")
    const derived = deriveSyntaxTokens(theme, "test")
    assert.deepEqual(Object.keys(derived).sort(), Object.keys(SYNTAX_CLASSES).sort())
    for (const [token, hex] of Object.entries(derived)) {
      assert.match(hex, /^#[0-9a-f]{6}$/, `${name}.${token} is not a plain hex colour`)
    }
  }
})

// The scope table is the join between pandoc's vocabulary and shiki's. If a
// token loses its scope list it silently falls back to body text everywhere.
test("every semantic token has a scope to resolve from", () => {
  assert.deepEqual(Object.keys(SYNTAX_SCOPES).sort(), Object.keys(SYNTAX_CLASSES).sort())
})

// A figure is rasterised once and served to both themes, so a chart colour that
// disappears against one of the two backgrounds has to fail the build rather
// than ship. This is the rule that stops someone "fixing" a chart for light
// mode and losing it in dark.
test("refuses chart colours that vanish against either background", () => {
  const illegible: DesignTokens = {
    ...tokens,
    chart: { ...tokens.chart, ink: "#ffffff" },
  }
  assert.throws(() => assertChartLegibility(illegible), /chart\.ink \(#ffffff\)/)

  const illegibleSeries: DesignTokens = {
    ...tokens,
    chart: { ...tokens.chart, series: [...tokens.chart.series, "#111111"] },
  }
  assert.throws(() => assertChartLegibility(illegibleSeries), /chart\.series\[6\] \(#111111\)/)
})

test("contrast ratio matches the WCAG reference values", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff") * 100) / 100, 21)
  assert.equal(contrastRatio("#777777", "#777777"), 1)
  // Order must not matter.
  assert.equal(contrastRatio("#000000", "#ffffff"), contrastRatio("#ffffff", "#000000"))
})

test("every pandoc highlight class resolves to a token", () => {
  for (const mode of ["light", "dark"] as const) {
    const scss = renderSiteScss(tokens, mode)
    for (const [token, classes] of Object.entries(SYNTAX_CLASSES)) {
      assert.match(scss, new RegExp(`--qmd-syntax-${token}:`))
      for (const name of classes) {
        assert.match(scss, new RegExp(`span\\.${name}[,\\s]`))
      }
    }
  }
})

// The two modes are separate stylesheets now rather than a block and an
// override, so nothing structural stops one from defining a token the other
// leaves unset -- which would read as the light value bleeding into dark.
test("both site themes define exactly the same token set", () => {
  const names = (mode: "light" | "dark") =>
    [...renderSiteScss(tokens, mode).matchAll(/--(qmd-syntax-[a-z]+):/g)].map((m) => m[1]).sort()

  assert.deepEqual(names("dark"), names("light"))
})

test("the matplotlib style paints no background of its own", () => {
  const style = renderMplStyle(tokens)

  assert.match(style, /^figure\.facecolor: none$/m)
  assert.match(style, /^axes\.facecolor: none$/m)
  assert.match(style, /^savefig\.transparent: True$/m)
  assert.ok(!/white/i.test(style))
  for (const colour of tokens.chart.series) {
    assert.ok(style.includes(colour.replace("#", "")), `${colour} missing from the prop cycle`)
  }
})

// One Bootstrap bundle is compiled per mode and only one is ever enabled, so
// each file must state its own mode unconditionally -- no dark-mode selector.
// That is what lets a cell read a token off :root and get the right answer.
test("each site theme paints one mode with no dark-mode selector", () => {
  const light = renderSiteScss(tokens, "light")
  const dark = renderSiteScss(tokens, "dark")

  assert.ok(light.includes(`$body-bg: ${tokens.colors.light.light};`))
  assert.ok(dark.includes(`$body-bg: ${tokens.colors.dark.light};`))
  assert.ok(light.includes("color-scheme: light;"))
  assert.ok(dark.includes("color-scheme: dark;"))

  for (const scss of [light, dark]) {
    assert.ok(!scss.includes("saved-theme"), "preview theme must not carry Quartz's dark selector")
    assert.ok(!scss.includes("prefers-color-scheme"), "the bundle swap decides the mode, not a media query")
  }
})

// Quarto ships its own colours for pandoc's classes from a stylesheet that
// loads before the theme bundle. Same selector shape, so ours wins on order.
test("the site theme repaints every pandoc highlight class", () => {
  const scss = renderSiteScss(tokens, "light")
  for (const [token, classes] of Object.entries(SYNTAX_CLASSES)) {
    for (const name of classes) {
      assert.ok(scss.includes(`code span.${name}`), `span.${name} unstyled in preview`)
    }
    assert.ok(scss.includes(`color: var(--qmd-syntax-${token});`))
  }
})

test("every generated file is current", async () => {
  const files = await generateDesignTokens()
  assert.equal(files.length, 4)
  for (const file of files) {
    assert.equal(await readFile(file.path, "utf8"), file.contents, `${file.path} is stale`)
  }
})

// Bootswatch paints the navbar $gray-100 in both bundles if nothing overrides
// it, so the bar stayed light on a dark page. And Quarto hardcodes
// data-bs-theme="dark" on the <nav> while one HTML serves both stylesheets, so
// the foreground cannot be left to Bootstrap's context defaults either.
test("the top bar is painted from the palette, and shares the page ground", () => {
  for (const mode of ["light", "dark"] as const) {
    const scss = renderSiteScss(tokens, mode)
    const value = (name: string) =>
      scss.match(new RegExp(`^\\$${name}: (#[0-9a-fA-F]{6});$`, "m"))?.[1]

    assert.equal(value("navbar-bg"), value("body-bg"))
    assert.equal(value("navbar-fg"), tokens.colors[mode].darkgray)
    assert.equal(value("navbar-hl"), tokens.colors[mode].secondary)
    assert.match(scss, /border-bottom: 1px solid #[0-9a-fA-F]{6};/)
  }
})
