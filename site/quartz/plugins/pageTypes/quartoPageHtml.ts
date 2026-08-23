import { Element, ElementContent, Node, Root, RootContent, Text } from "hast"
import { fromHtml } from "hast-util-from-html"
import { slugifyPath } from "@quartz-community/utils"

export interface QuartoWikilinkResolution {
  href: string
  slug: string
  broken?: boolean
}

export type QuartoWikilinkResolver = (target: string) => QuartoWikilinkResolution | undefined

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

const excludedWikilinkParents = new Set(["code", "pre", "script", "style", "textarea"])
const wikilinkPattern = /\[\[([^\]]+)\]\]/g

function wikilinkDisplay(target: string, heading: string, alias?: string): string {
  if (alias) return alias
  const basename = target.split("/").at(-1)?.replace(/\.md$/i, "") ?? target
  return heading ? `${basename} > ${heading}` : basename
}

function replaceWikilinks(textNode: Text, resolve: QuartoWikilinkResolver): RootContent[] {
  const source = textNode.value
  const replacement: RootContent[] = []
  let cursor = 0

  for (const match of source.matchAll(wikilinkPattern)) {
    const index = match.index ?? 0
    if (index > cursor) replacement.push({ type: "text", value: source.slice(cursor, index) })

    const raw = match[1]
    const separator = raw.indexOf("|")
    const destination = (separator === -1 ? raw : raw.slice(0, separator)).trim()
    const alias = separator === -1 ? undefined : raw.slice(separator + 1).trim()
    const headingSeparator = destination.indexOf("#")
    const target = (
      headingSeparator === -1 ? destination : destination.slice(0, headingSeparator)
    ).trim()
    const heading = headingSeparator === -1 ? "" : destination.slice(headingSeparator + 1).trim()
    const resolution = target ? resolve(target) : undefined

    if (!resolution) {
      replacement.push({ type: "text", value: match[0] })
    } else {
      const href = heading ? `${resolution.href}#${slugifyPath(heading)}` : resolution.href
      replacement.push({
        type: "element",
        tagName: "a",
        properties: {
          href,
          className: ["internal", "internal-link", ...(resolution.broken ? ["broken"] : [])],
          dataSlug: resolution.slug,
        },
        children: [{ type: "text", value: wikilinkDisplay(target, heading, alias) }],
      })
    }
    cursor = index + match[0].length
  }

  if (cursor === 0) return [textNode]
  if (cursor < source.length) replacement.push({ type: "text", value: source.slice(cursor) })
  return replacement
}

function transformWikilinks(node: Root | Element, resolve: QuartoWikilinkResolver): void {
  if (node.type === "element" && excludedWikilinkParents.has(node.tagName)) return

  const children: RootContent[] = []
  for (const child of node.children) {
    if (child.type === "text") {
      children.push(...replaceWikilinks(child, resolve))
    } else {
      if (child.type === "element") transformWikilinks(child, resolve)
      children.push(child)
    }
  }
  node.children = children as typeof node.children
}

export function extractQuartoPage(html: string, resolveWikilink?: QuartoWikilinkResolver): Root {
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
  const resources = [...headResources, ...bodyResources]
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

  const root: Root = {
    type: "root",
    children: [
      ...resources,
      {
        type: "element",
        tagName: "div",
        properties: { className: ["quarto-content"] },
        children: content as ElementContent[],
      },
    ],
  }
  if (resolveWikilink) transformWikilinks(root, resolveWikilink)
  markLinksForFullPageNavigation(root)
  return root
}
