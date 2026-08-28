import assert from "node:assert/strict"
import test from "node:test"
import { h } from "preact"
import { render } from "preact-render-to-string"
import { SiteNav, SiteNavOptions } from "./siteNav"
import { QuartzComponentProps } from "../quartz/components/types"

// No JSX here on purpose: the bridge test runner globs `bridge/*.test.ts`, and
// the JSX this file would need to be `.test.tsx` to compile would fall out of
// that glob and silently stop running.

const links = [
  { label: "Knowledge", slug: "knowledge/" },
  { label: "About", slug: "about/" },
]

function navHtml(slug: string, options: SiteNavOptions = { links }): string {
  const Nav = SiteNav(options)
  const props = {
    fileData: { slug },
    cfg: { pageTitle: "Wordmark" },
  } as unknown as QuartzComponentProps
  return render(h(Nav, props))
}

/** The labels of the links rendered with an active marker. */
function activeLabels(html: string): string[] {
  return [...html.matchAll(/<a class="site-nav-link active"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1])
}

test("marks the section a page belongs to, not just the section index", () => {
  // The bug this pins: simplifySlug strips the leading slash only, so a section
  // slug keeps its trailing one. Testing membership with `${section}/` builds a
  // double slash, and the section index -- which matches by equality -- is then
  // the only page that ever lights up. It renders perfectly otherwise.
  assert.deepEqual(activeLabels(navHtml("knowledge/index")), ["Knowledge"])
  assert.deepEqual(activeLabels(navHtml("knowledge/signals-as-vectors")), ["Knowledge"])
  assert.deepEqual(activeLabels(navHtml("knowledge/deep/nested/note")), ["Knowledge"])
})

test("marks exactly one section, and none on the home page", () => {
  assert.deepEqual(activeLabels(navHtml("about/index")), ["About"])
  assert.deepEqual(activeLabels(navHtml("index")), [])
})

test("does not mistake a section for a longer name sharing its prefix", () => {
  const html = navHtml("knowledgebase/note", {
    links: [{ label: "Knowledge", slug: "knowledge" }],
  })
  assert.deepEqual(activeLabels(html), [])
})

test("accepts a section slug written with or without its trailing slash", () => {
  const withSlash = navHtml("knowledge/note", { links: [{ label: "K", slug: "knowledge/" }] })
  const without = navHtml("knowledge/note", { links: [{ label: "K", slug: "knowledge" }] })
  assert.deepEqual(activeLabels(withSlash), ["K"])
  assert.deepEqual(activeLabels(without), ["K"])
})

test("resolves link hrefs relative to the page, so a subdirectory does not 404", () => {
  assert.match(navHtml("index"), /href="\.\/knowledge\/"/)
  assert.match(navHtml("knowledge/signals-as-vectors"), /href="\.\.\/knowledge\/"/)
  // pathToRoot yields "." at the root and ".." one level down -- no trailing
  // slash, unlike the section links, which come from resolveRelative.
  assert.match(navHtml("index"), /class="site-nav-wordmark" href="\."/)
  assert.match(navHtml("knowledge/signals-as-vectors"), /class="site-nav-wordmark" href="\.\."/)
})

test("falls back to the configured page title for the wordmark", () => {
  assert.match(navHtml("index"), /class="site-nav-wordmark"[^>]*>Wordmark</)
  assert.match(
    navHtml("index", { wordmark: "Oishe Farhan", links }),
    /class="site-nav-wordmark"[^>]*>Oishe Farhan</,
  )
})

test("renders no nav element at all when there are no links to show", () => {
  const html = navHtml("index", { links: [] })
  assert.equal(html.includes("<nav"), false)
  assert.match(html, /site-nav-wordmark/)
})

test("carries its own stylesheet, which is what registration has to collect", () => {
  const Nav = SiteNav({ links })
  assert.match(String(Nav.css), /\.site-nav\b/)
})
