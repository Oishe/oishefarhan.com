import assert from "node:assert/strict"
import test from "node:test"
import { plotlyThemeUpdate, TRANSPARENT } from "./quartoTheme"

const colors = {
  ink: "#d4d4d4",
  muted: "#393639",
  line: "#646464",
  surface: "#161618",
}

test("clears the baked-in surfaces that make a figure a white box in dark mode", () => {
  const update = plotlyThemeUpdate({ xaxis: {}, yaxis: {} }, colors)

  assert.equal(update.paper_bgcolor, TRANSPARENT)
  assert.equal(update.plot_bgcolor, TRANSPARENT)
  assert.equal(update["legend.bgcolor"], TRANSPARENT)

  // Plotly's default template paints "white" paper and "#E5ECF6" plot area.
  const values = Object.values(update).map((value) => String(value).toLowerCase())
  assert.ok(!values.includes("white"))
  assert.ok(!values.includes("#e5ecf6"))
})

test("routes every colour through a Quartz theme variable", () => {
  const update = plotlyThemeUpdate({ xaxis: {} }, colors)
  const known = new Set([TRANSPARENT, ...Object.values(colors)])

  for (const [key, value] of Object.entries(update)) {
    assert.ok(known.has(String(value)), `${key} is not a theme colour: ${value}`)
  }
})

test("touches every axis the figure declares", () => {
  const update = plotlyThemeUpdate({ xaxis: {}, yaxis: {}, xaxis2: {}, yaxis3: {} }, colors)

  for (const axis of ["xaxis", "yaxis", "xaxis2", "yaxis3"]) {
    assert.equal(update[`${axis}.gridcolor`], colors.muted)
    assert.equal(update[`${axis}.tickfont.color`], colors.ink)
  }
})

test("names no axis the figure does not have, so relayout cannot invent one", () => {
  const update = plotlyThemeUpdate({ xaxis: {}, template: {}, annotations: [] }, colors)

  assert.ok(Object.keys(update).some((key) => key.startsWith("xaxis.")))
  assert.ok(!Object.keys(update).some((key) => key.startsWith("yaxis")))
  assert.ok(!Object.keys(update).some((key) => key.startsWith("axis")))
})

test("survives a figure with no layout at all", () => {
  const update = plotlyThemeUpdate(undefined, colors)

  assert.equal(update.paper_bgcolor, TRANSPARENT)
  assert.equal(update["font.color"], colors.ink)
})
