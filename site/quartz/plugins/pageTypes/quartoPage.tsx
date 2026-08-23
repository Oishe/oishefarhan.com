import fs from "node:fs"
import path from "node:path"
import { Root } from "hast"
import { QuartzComponent, QuartzComponentConstructor } from "../../components/types"
import { QuartzPageTypePlugin } from "../types"
import { FilePath, FullSlug, resolveRelative } from "../../util/path"
import { htmlToJsx } from "../../util/jsx"
import style from "./styles/quartoPage.scss"
import { slugifyPath } from "@quartz-community/utils"
import {
  elementAttribute,
  extractQuartoPage,
  QuartoWikilinkResolver,
  visitElements,
} from "./quartoPageHtml"

interface QuartoPageOptions {
  sourceDirectory: string
}

function artifactPath(sourceRoot: string, slug: FullSlug): string {
  const root = path.resolve(sourceRoot)
  const candidate = path.resolve(root, `${slug}.html`)
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    throw new Error(`Quarto artifact path escapes its root: ${slug}`)
  }
  return candidate
}

export const QuartoPage: QuartzPageTypePlugin<QuartoPageOptions> = (options) => {
  if (!options?.sourceDirectory) {
    throw new Error("QuartoPage requires sourceDirectory")
  }

  const cache = new Map<string, Root>()

  const QuartoBody: QuartzComponent = ({ fileData, allFiles }) => {
    const slug = fileData.slug!
    let tree = cache.get(slug)
    if (!tree) {
      const source = artifactPath(options.sourceDirectory, slug)
      if (!fs.existsSync(source)) {
        throw new Error(`Quarto artifact does not exist for ${slug}: ${source}`)
      }
      const targets = new Map<string, { slug: FullSlug | null; priority: number }>()
      const normalize = (value: string) => slugifyPath(value.trim().replace(/\.md$/i, ""))
      const register = (value: unknown, target: FullSlug, priority: number) => {
        if (typeof value !== "string" || value.trim() === "") return
        const key = normalize(value)
        const previous = targets.get(key)
        if (!previous || priority > previous.priority) {
          targets.set(key, { slug: target, priority })
        } else if (priority === previous.priority && previous.slug !== target) {
          targets.set(key, { slug: null, priority })
        }
      }

      for (const file of allFiles) {
        if (!file.slug) continue
        register(file.slug, file.slug, 3)
        register(file.slug.split("/").at(-1), file.slug, 1)
        register(file.frontmatter?.title, file.slug, 2)
        const aliases = file.frontmatter?.aliases
        if (Array.isArray(aliases)) aliases.forEach((alias) => register(alias, file.slug!, 2))
      }

      const resolveWikilink: QuartoWikilinkResolver = (target) => {
        const key = normalize(target)
        const resolution = targets.get(key)
        if (resolution?.slug === null) return undefined
        const targetSlug = resolution?.slug ?? (key as FullSlug)
        return {
          href: resolveRelative(slug, targetSlug),
          slug: targetSlug,
          broken: resolution === undefined,
        }
      }
      tree = extractQuartoPage(fs.readFileSync(source, "utf8"), resolveWikilink)
      cache.set(slug, tree)
    }

    const frontmatter = fileData.frontmatter as Record<string, unknown> | undefined
    const cssClasses = Array.isArray(frontmatter?.cssclasses)
      ? frontmatter.cssclasses.filter((value): value is string => typeof value === "string")
      : []
    const relativePath = (fileData.relativePath ?? `${slug}.md`) as FilePath

    return (
      <article class={["popover-hint", "quarto-page", ...cssClasses].join(" ")}>
        <div class="markdown-preview-view markdown-rendered">{htmlToJsx(relativePath, tree)}</div>
      </article>
    )
  }
  QuartoBody.css = style

  return {
    name: "QuartoPage",
    priority: 100,
    match: ({ fileData }) => fileData.frontmatter?.quartoStub === true,
    layout: "content",
    body: (() => QuartoBody) satisfies QuartzComponentConstructor,
    treeTransforms: () => [
      (root, slug, componentData) => {
        const quartoSlugs = new Set(
          componentData.allFiles
            .filter((file) => file.frontmatter?.quartoStub === true)
            .flatMap((file) => {
              const slugs = file.slug ? [file.slug] : []
              const aliases = file.frontmatter?.aliases
              if (Array.isArray(aliases)) {
                slugs.push(
                  ...aliases
                    .filter((alias): alias is string => typeof alias === "string")
                    .map((alias) => slugifyPath(alias) as FullSlug),
                )
              }
              return slugs
            }),
        )

        visitElements(root, (element) => {
          if (element.tagName !== "a") return
          const href = elementAttribute(element, "href")
          if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return
          const target = new URL(href, `https://quartz.local/${slug}`).pathname.replace(/^\//, "")
          if (quartoSlugs.has(target as FullSlug)) {
            element.properties ??= {}
            element.properties.dataRouterIgnore = ""
          }
        })
      },
    ],
  }
}
