import fs from "node:fs"
import path from "node:path"
import { Root } from "hast"
import { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { QuartzPageTypePlugin } from "../quartz/plugins/types"
import { FilePath, FullSlug } from "../quartz/util/path"
import { htmlToJsx } from "../quartz/util/jsx"
import style from "./styles/quartoPage.scss"
// @ts-ignore -- resolved to a string by the inline-script loader at build time
import themeScript from "./scripts/quartoTheme.inline"
import {
  simplifySlug,
  slugifyPath,
  stripSlashes,
  transformLink,
} from "@quartz-community/utils"
import {
  elementAttribute,
  extractQuartoPage,
  QuartoLinkResolver,
  visitElements,
} from "./quartoPageHtml"

interface QuartoPageOptions {
  sourceDirectory: string
  /**
   * Classic scripts to execute at the top of the Quarto fragment, before any
   * module or AMD loader the document brings with it. Used to pin Quartz's own
   * UMD libraries as globals; see the note in quartoPageHtml.ts.
   */
  preloadScripts?: string[]
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
      // Link targets are paths from the vault folder, which is also how Quartz
      // is configured to read them (markdownLinkResolution: absolute), so the
      // bridge resolves them with Quartz's own transformLink and nothing else.
      // The Quartz link crawler never sees this fragment -- it runs over the
      // .qmd stub, not the rendered artifact -- which is why resolution has to
      // happen here at all. Quartz slugification strips `.md` but not `.qmd`,
      // so a Quarto target is normalised to the extension its staged
      // counterpart already has.
      const allSlugs = allFiles
        .map((file) => file.slug)
        .filter((value): value is FullSlug => Boolean(value))
      const resolveLink: QuartoLinkResolver = (target) => {
        const normalized = target.replace(/\.qmd$/i, ".md")
        const href = transformLink(slug, normalized, { strategy: "absolute", allSlugs })
        const base = `https://quarto.invalid/${stripSlashes(simplifySlug(slug), true)}`
        let canonical = new URL(href, base).pathname
        if (canonical.endsWith("/")) canonical += "index"
        const full = decodeURIComponent(stripSlashes(canonical, true)) as FullSlug
        return { href, slug: full, broken: !allSlugs.includes(full) }
      }
      tree = extractQuartoPage(
        fs.readFileSync(source, "utf8"),
        resolveLink,
        options.preloadScripts ?? [],
      )
      cache.set(slug, tree)
    }

    const frontmatter = fileData.frontmatter as Record<string, unknown> | undefined
    const cssClasses = Array.isArray(frontmatter?.cssclasses)
      ? frontmatter.cssclasses.filter((value): value is string => typeof value === "string")
      : []
    const relativePath = (fileData.relativePath ?? `${slug}.md`) as FilePath

    return (
      // `data-spa-exclude` keeps navigation across the renderer boundary out of
      // the SPA lifecycle: Quarto's own scripts initialize on a full document
      // load and have no Quartz `nav`/cleanup handlers.
      <article class={["popover-hint", "quarto-page", ...cssClasses].join(" ")} data-spa-exclude="">
        <div class="markdown-preview-view markdown-rendered">{htmlToJsx(relativePath, tree)}</div>
      </article>
    )
  }
  QuartoBody.css = style
  QuartoBody.afterDOMLoaded = themeScript

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
