import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  applyGeneratedBlock,
  assertChartLegibility,
  blockMarkers,
  contrastRatio,
  generateDesignTokens,
  parseTokens,
  renderMplStyle,
  renderQuartoTokensScss,
  renderQuartzThemeBlock,
  SYNTAX_CLASSES,
  type DesignTokens,
} from "./generate-design-tokens.ts"

const tokensSource = await readFile("design/tokens.yaml", "utf8")
const tokens = parseTokens(tokensSource)

test("the committed token file parses and passes its own legibility rule", () => {
  assertChartLegibility(tokens)
  assert.ok(tokens.chart.series.length > 0)
})

test("rejects a colour key Quartz would silently ignore", () => {
  const broken = tokensSource.replace("  light:\n    light:", "  light:\n    accent: \"#ff0000\"\n    light:")
  assert.throws(() => parseTokens(broken), /colors\.light has keys Quartz does not consume: accent/)
})

test("rejects a missing syntax token rather than emitting an empty custom property", () => {
  const broken = tokensSource.replace('    keyword: "#cf222e"\n', "")
  assert.throws(() => parseTokens(broken), /syntax\.light\.keyword/)
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
  const scss = renderQuartoTokensScss(tokens)
  for (const [token, classes] of Object.entries(SYNTAX_CLASSES)) {
    assert.match(scss, new RegExp(`--qmd-syntax-${token}:`))
    for (const name of classes) {
      assert.match(scss, new RegExp(`span\\.${name}[,\\s]`))
    }
  }
})

test("the dark override redefines every token the light block defines", () => {
  const scss = renderQuartoTokensScss(tokens)
  const [, light, dark] = scss.split(/:root(?:\[saved-theme="dark"\])? \{/)
  const names = (block: string) => [...block.matchAll(/--(qmd-syntax-[a-z]+):/g)].map((m) => m[1])

  assert.deepEqual(names(dark).sort(), names(light).sort())
})

test("replaces only the marked region of the Quartz config", () => {
  const { begin, end } = blockMarkers("theme")
  const config = `before\n${begin}\nold\n${end}\nafter\n`

  assert.equal(applyGeneratedBlock(config, "theme", `${begin}\nnew\n${end}`), "before\n" + begin + "\nnew\n" + end + "\nafter\n")
})

test("fails loudly when the markers are gone rather than appending a second theme", () => {
  assert.throws(
    () => applyGeneratedBlock("configuration:\n  theme: {}\n", "theme", "x"),
    /missing the generated "theme" markers/,
  )
})

test("the Quartz theme block carries every colour and font from the source", () => {
  const block = renderQuartzThemeBlock(tokens)
  for (const mode of ["light", "dark"] as const) {
    for (const value of Object.values(tokens.colors[mode])) {
      assert.ok(block.includes(value), `${value} missing from the theme block`)
    }
  }
  for (const font of Object.values(tokens.typography)) {
    assert.ok(block.includes(font), `${font} missing from the theme block`)
  }
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

test("every generated file is current", async () => {
  const files = await generateDesignTokens()
  assert.ok(files.length === 4)
  for (const file of files) {
    assert.equal(await readFile(file.path, "utf8"), file.contents, `${file.path} is stale`)
  }
})
