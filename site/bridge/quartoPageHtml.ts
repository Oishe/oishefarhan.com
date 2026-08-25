import { Element, ElementContent, Node, Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { slugifyPath } from "@quartz-community/utils"

export interface QuartoLinkResolution {
  href: string
  slug: string
  broken?: boolean
}

export type QuartoLinkResolver = (target: string) => QuartoLinkResolution | undefined

const isElement = (node: Node): node is Element => node.type === "element"

export function visitElements(node: Node, callback: (element: Element) => void): void {
  if (isElement(node)) {
    callback(node)
  }

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      visitElements(child, callback)
    }
  }
}

function findElement(root: Root, predicate: (element: Element) => boolean): Element | undefined {
  let found: Element | undefined
  visitElements(root, (element) => {
    if (!found && predicate(element)) {
      found = element
    }
  })
  return found
}

export function elementAttribute(element: Element, name: string): string | undefined {
  const value = element.properties?.[name]
  return typeof value === "string" ? value : undefined
}

function isStylesheet(element: Element): boolean {
  const rel = element.properties?.rel
  return element.tagName === "link" && Array.isArray(rel) && rel.includes("stylesheet")
}

function isQuartoResource(element: Element): boolean {
  return element.tagName === "script" || element.tagName === "style" || isStylesheet(element)
}

function resourcePath(element: Element): string | undefined {
  return elementAttribute(element, "src") ?? elementAttribute(element, "href")
}

function scriptText(element: Element): string {
  return element.children
    .map((child) => (child.type === "text" ? child.value : ""))
    .join("")
    .trim()
}

// Jupyter widget output (Plotly, Bokeh, ipywidgets) ships a RequireJS/AMD shim.
// Left in place it defines a global `define.amd`, which makes Quartz's own UMD
// bundles register as AMD modules instead of setting their globals — the graph
// and search components then fail with "Libraries not loaded". The widgets
// themselves load through a plain script tag inside the cell output, so the
// shim is redundant here and is dropped along with the guards that exist only
// to protect other libraries from it.
// Plotly's bare ESM preload omits the .js extension and 403s on the CDN. The
// cell output's own <script src="...min.js"> is the real loader, so this only
// ever contributes a console error. An extension-bearing import is left alone
// in case it turns out to be the only loader on the page.
function isBrokenPlotlyPreload(body: string): boolean {
  const match = body.match(/^import\s+["'](https?:\/\/cdn\.plot\.ly\/[^"']+)["'];?$/)
  return match !== undefined && match !== null && !match[1].endsWith(".js")
}

// Some Quarto output genuinely consumes AMD. The Jupyter widget manager ships
// as `embed-amd.js`, which throws "define is not defined" without a loader
// already in place, and it resolves third-party widget bundles (ipyleaflet and
// friends) through `require` long after first paint. On such a page the loader
// has to stay.
function consumesAmd(resources: Element[]): boolean {
  return resources.some((resource) => /embed-amd\.js/.test(resourcePath(resource) ?? ""))
}

function isAmdShim(element: Element, amdIsLoadBearing: boolean): boolean {
  if (element.tagName !== "script") return false

  const source = resourcePath(element)
  if (source) {
    return !amdIsLoadBearing && /\brequirejs\b/.test(source)
  }

  const body = scriptText(element)
  if (isBrokenPlotlyPreload(body)) return true
  if (amdIsLoadBearing) return false
  return (
    /^define\(\s*['"]jquery['"]/.test(body) ||
    /window\.(backupDefine|define)\s*=\s*(window\.(backupDefine|define)|undefined)\s*;/.test(body)
  )
}

function assertNoBootstrapResources(resources: Element[]): void {
  const bootstrapResource = resources.find((resource) =>
    resourcePath(resource)?.split(/[?#]/, 1)[0].split("/").includes("bootstrap"),
  )

  if (bootstrapResource) {
    throw new Error(
      `Quarto page includes a Bootstrap resource (${resourcePath(bootstrapResource)}). ` +
        "Render QMD pages with format.html.minimal: true so Quarto cannot restyle the Quartz shell.",
    )
  }
}

function markLinksForFullPageNavigation(root: Root): void {
  visitElements(root, (element) => {
    if (element.tagName !== "a") return
    const href = elementAttribute(element, "href")
    if (!href || href.startsWith("#")) return
    element.properties ??= {}
    element.properties.dataRouterIgnore = ""
  })
}

// Quarto emits link hrefs verbatim -- it performs no extension rewriting under
// `project: type: default` -- and the Quartz link crawler never sees this
// fragment, because it runs over the .qmd stub rather than the rendered
// artifact. Source-file links therefore arrive here still pointing at
// `something.md` / `something.qmd` relative to the source file, and would 404
// against the page URL. Resolving them to site URLs is the whole job; Quartz
// slugification drops `.md` but not `.qmd`, so both extensions are handled.
const sourceFileLink = /\.(md|qmd)$/i
const absoluteUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

function resolveSourceLinks(root: Root, resolve: QuartoLinkResolver): void {
  visitElements(root, (element) => {
    if (element.tagName !== "a") return
    const href = elementAttribute(element, "href")
    if (!href || href.startsWith("#") || absoluteUrl.test(href)) return

    const separator = href.indexOf("#")
    const target = separator === -1 ? href : href.slice(0, separator)
    const anchor = separator === -1 ? "" : href.slice(separator + 1)
    if (!sourceFileLink.test(target)) return

    const resolution = resolve(target)
    if (!resolution) return

    element.properties ??= {}
    element.properties.href = anchor
      ? `${resolution.href}#${slugifyPath(anchor)}`
      : resolution.href
    element.properties.className = [
      "internal",
      "internal-link",
      ...(resolution.broken ? ["broken"] : []),
    ]
    element.properties.dataSlug = resolution.slug
  })
}

// Quartz loads its graph libraries (d3, PIXI) lazily at runtime, well after the
// Quarto fragment has installed a module loader. Both are UMD bundles, so an
// AMD loader on the page hijacks them: d3 calls an anonymous define(), RequireJS
// rejects it with "Mismatched anonymous define", window.d3 is never set, and the
// graph dies -- and the failed define can poison the require context badly enough
// that third-party widget bundles stop resolving too. Loading them as classic
// scripts at the top of the fragment makes them execute during parsing, before
// any loader exists, so both sides get what they need.
export function extractQuartoPage(
  html: string,
  resolveLink?: QuartoLinkResolver,
  preloadScripts: string[] = [],
): Root {
  const document = fromHtml(html) as Root
  const head = findElement(document, (element) => element.tagName === "head")
  const body = findElement(document, (element) => element.tagName === "body")
  const main = findElement(
    document,
    (element) =>
      element.tagName === "main" && elementAttribute(element, "id") === "quarto-document-content",
  )

  if (!head || !body) {
    throw new Error("Quarto HTML must contain head and body elements")
  }

  const headResources = head.children.filter(
    (child): child is Element => isElement(child) && isQuartoResource(child),
  )
  const bodyResources = body.children.filter(
    (child): child is Element => isElement(child) && child !== main && isQuartoResource(child),
  )
  const allResources = [...headResources, ...bodyResources]
  const amdIsLoadBearing = consumesAmd(allResources)
  const resources = allResources.filter((resource) => !isAmdShim(resource, amdIsLoadBearing))
  assertNoBootstrapResources(resources)

  const contentRoot = main ?? body
  const content = contentRoot.children.filter(
    (child) =>
      !(
        isElement(child) &&
        ((child.tagName === "header" && elementAttribute(child, "id") === "title-block-header") ||
          (contentRoot === body && isQuartoResource(child)))
      ),
  )

  const preloads: Element[] = preloadScripts.map((src) => ({
    type: "element",
    tagName: "script",
    properties: { src, crossOrigin: "anonymous" },
    children: [],
  }))

  const root: Root = {
    type: "root",
    children: [
      ...preloads,
      ...resources,
      {
        type: "element",
        tagName: "div",
        properties: { className: ["quarto-content"] },
        children: content as ElementContent[],
      },
    ],
  }
  if (resolveLink) resolveSourceLinks(root, resolveLink)
  markLinksForFullPageNavigation(root)
  return root
}
