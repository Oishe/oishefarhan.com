import assert from "node:assert/strict"
import test from "node:test"
import { Element, Node } from "hast"
import { extractQuartoPage } from "./quartoPageHtml"

const isElement = (node: Node): node is Element => node.type === "element"

function elements(node: Node): Element[] {
  const found: Element[] = []
  if (isElement(node)) found.push(node)
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) found.push(...elements(child))
  }
  return found
}

test("extracts a standard Quarto main into a scoped content wrapper", () => {
  const result = extractQuartoPage(`<!doctype html><html><head>
    <style>.cell { color: red }</style>
    <script src="note_files/widget.js"></script>
  </head><body>
    <main id="quarto-document-content">
      <header id="title-block-header"><h1>Duplicate title</h1></header>
      <p><a href="../note">Body</a></p>
    </main>
    <script>window.widgetReady = true</script>
  </body></html>`)

  const all = elements(result)
  const wrapper = all.find((element) => element.properties?.className?.includes("quarto-content"))
  assert.ok(wrapper)
  assert.equal(
    all.some((element) => element.properties?.id === "title-block-header"),
    false,
  )
  assert.equal(all.filter((element) => element.tagName === "script").length, 2)
  const link = all.find((element) => element.tagName === "a")
  assert.equal(link?.properties?.dataRouterIgnore, "")
})

test("supports minimal Quarto HTML whose content is directly under body", () => {
  const result = extractQuartoPage(`<!doctype html><html><head>
    <script src="note_files/clipboard.js"></script>
  </head><body>
    <header id="title-block-header"><h1>Duplicate title</h1></header>
    <p>Computed prose</p>
    <script id="quarto-html-after-body">window.ready = true</script>
  </body></html>`)

  const all = elements(result)
  assert.equal(
    all.some((element) => element.properties?.id === "title-block-header"),
    false,
  )
  assert.equal(
    all.some((element) => element.tagName === "p"),
    true,
  )
  assert.equal(all.filter((element) => element.tagName === "script").length, 2)
})

test("rejects Bootstrap resources that could restyle the Quartz shell", () => {
  assert.throws(
    () =>
      extractQuartoPage(`<!doctype html><html><head>
        <link rel="stylesheet" href="note_files/libs/bootstrap/bootstrap.min.css">
      </head><body><main id="quarto-document-content"><p>Body</p></main></body></html>`),
    /minimal: true/,
  )
})

test("turns Quarto's literal wikilinks into resolved Quartz links", () => {
  const result = extractQuartoPage(
    `<!doctype html><html><head></head><body>
      <p>See [[Probability]], [[Statistics#Mean|the mean]], and <code>[[Example]]</code>.</p>
    </body></html>`,
    (target) => ({ href: `../concepts/${target.toLowerCase()}`, slug: `concepts/${target}` }),
  )

  const links = elements(result).filter((element) => element.tagName === "a")
  assert.equal(links.length, 2)
  assert.equal(links[0].properties?.href, "../concepts/probability")
  assert.deepEqual(links[0].properties?.className, ["internal", "internal-link"])
  assert.equal(links[0].properties?.dataRouterIgnore, "")
  assert.equal(links[1].properties?.href, "../concepts/statistics#mean")
  assert.deepEqual(links[1].children, [{ type: "text", value: "the mean" }])
})

test("drops the RequireJS/AMD shim that breaks Quartz library loading", () => {
  const result = extractQuartoPage(`<!doctype html><html><head>
    <script src="https://cdn.jsdelivr.net/npm/requirejs@2.3.6/require.min.js"></script>
    <script type="application/javascript">define('jquery', [],function() {return window.jQuery;})</script>
    <script type="module">import "https://cdn.plot.ly/plotly-3.7.0.min"</script>
    <script>window.backupDefine = window.define; window.define = undefined;</script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
    <script>window.define = window.backupDefine; window.backupDefine = undefined;</script>
  </head><body>
    <p>Prose</p>
    <div class="plotly-graph-div"></div>
    <script src="https://cdn.plot.ly/plotly-3.7.0.min.js"></script>
    <script>Plotly.newPlot("chart", [])</script>
  </body></html>`)

  const scripts = elements(result).filter((element) => element.tagName === "script")
  const sources = scripts.map((element) => element.properties?.src ?? "")
  const bodies = scripts.map((element) =>
    element.children.map((child) => (child.type === "text" ? child.value : "")).join(""),
  )

  // The shim and its guards are gone...
  assert.equal(
    sources.some((src) => String(src).includes("requirejs")),
    false,
  )
  assert.equal(
    bodies.some((body) => body.includes('import "https://cdn.plot.ly/plotly-3.7.0.min"')),
    false,
  )
  assert.equal(
    bodies.some((body) => body.includes("define('jquery'")),
    false,
  )
  assert.equal(
    bodies.some((body) => body.includes("backupDefine")),
    false,
  )

  // ...while the widget's own loader and initialiser survive.
  assert.equal(
    sources.some((src) => String(src) === "https://cdn.plot.ly/plotly-3.7.0.min.js"),
    true,
  )
  assert.equal(
    bodies.some((body) => body.includes("Plotly.newPlot")),
    true,
  )
  assert.equal(
    sources.some((src) => String(src).includes("katex")),
    true,
  )
})

test("keeps an ESM Plotly import that names a real .js bundle", () => {
  const result = extractQuartoPage(`<!doctype html><html><head>
    <script type="module">import "https://cdn.plot.ly/plotly-3.7.0.min.js"</script>
  </head><body><p>Prose</p></body></html>`)

  const bodies = elements(result)
    .filter((element) => element.tagName === "script")
    .map((element) =>
      element.children.map((child) => (child.type === "text" ? child.value : "")).join(""),
    )

  assert.equal(
    bodies.some((body) => body.includes("cdn.plot.ly/plotly-3.7.0.min.js")),
    true,
  )
})
