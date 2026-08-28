# Authoring

The writing reference for this vault. Architecture rationale lives in
`Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md`; Obsidian install and plugin detail lives
in `vault/.obsidian/PLUGINS.md`.

```text
vault/          you edit here, and only here
generated/      derived, gitignored, never edited
site/public/    the built site
```

Nothing in `generated/` or `site/public/` survives a rebuild. Fix problems in `vault/`.

## Frontmatter

```yaml
---
title: Convergence Diagnostics       # falls back to the filename
description: One line.               # used for search and previews
aliases: [MC Diagnostics]            # extra URLs the page also answers on
tags: [research/computation]
publish: true                        # WITHOUT THIS THE PAGE IS NOT PUBLISHED
---
```

Templater scaffolds this: new notes in `about/ articles/ notes/ projects/`
get it automatically, and `templates/tpl-computational.qmd` adds the hidden theme-setup cell.

## Visibility

| State | Convention | GitHub | Website |
|---|---|---:|---:|
| Private | any path under a `*_hidden/` folder, or a `*.hidden.md` / `*.hidden.qmd` file | no | no |
| Unpublished | normal path, `publish: false` | yes | no |
| Fixture | normal path, `publish: false` and `fixture: true` | yes | no |
| Published | normal path, `publish: true` | yes | yes |

Path is the privacy boundary; frontmatter is the publication switch. Two conventions mark a path
private, and they share one word:

```text
*_hidden/          a folder -- `_hidden/`, `drafts_hidden/`, `research_hidden/`
*.hidden.md/qmd    a single file, when one note in an otherwise public folder must stay local
```

Both are invisible to publication prep, so `publish: true` inside them does nothing. Private
attachments and private frozen output must also sit below a `*_hidden/` folder. Notes move
`_hidden/inbox → section/_hidden → section (publish: false) → section (publish: true)`.

A published page may not link to an unpublished one — that fails the build with the file named. That
is the boundary working, not a bug.

### Fixtures

`vault/examples/` holds pages that exist to be tested, not read. They exercise paths no real note
does — a Python cell, a Jupyter widget, a Quarto fragment hosted inside a Quartz shell — and the
validators inspect the built HTML to prove the bridge still works.

They must still be built, and they must never reach the site. `fixture: true` is that seam:

```text
npm run build       stages publish:true only  -> site/public
npm run validate    stages publish:true + fixture:true -> generated/fixture-site, then validates
```

The production build cannot see them, so nothing under `examples/` can appear on the website even
by accident. A document that sets both `fixture: true` and `publish: true` fails the build rather
than resolving the contradiction quietly.

The staged copy of a fixture is rewritten to `publish: true`, because Quartz reads only the staged
tree and `explicit-publish` would otherwise drop it. The vault source keeps `publish: false` — that
is the flag that keeps it off the site.

## Where notes go

```text
about/       identity, resume, current focus
projects/    polished case studies and standalone work
experience/  professional practice and applied expertise
courses/     ordered curricula, lectures, course labs
knowledge/   evergreen, topic-oriented reference notes
writing/     essays and longer-form synthesis
```

Create a section when content needs it. Folders express a note's primary identity; links, tags,
and metadata express everything cross-cutting. Every substantial folder eventually gets an
`index.md`. Ordered material uses numbered files or an `order` property; evergreen notes use stable
descriptive names. Course labs stay with the course — work that becomes independently valuable gets
a project page linking back.

## `.md` or `.qmd`

The rule is only about execution: use `.qmd` when a page computes something, `.md` otherwise. A
`.qmd` with no executable cell is just a slower `.md`. An executable cell in a `.md` is a Quarto
error, not a silent no-op.

They are rendered by different engines, so Obsidian syntax does not survive equally:

| You write | `.md` (Quartz) | `.qmd` (Quarto) |
|---|---|---|
| `[Note](note.md)` | link | link |
| `![alt](../attachments/figure.svg)` | image | image |
| `[[Note]]`, `![[figure.png]]` | **build fails** — use a Markdown link or image | **build fails** — same |
| `%%comment%%` | stripped | **build fails** — would publish as visible text; use `<!-- -->` |
| `> [!note]` | callout | **build fails** — use a blockquote or a section heading |
| `==highlight==` | highlight | **build fails** — use `<mark>` |
| `#tag/inline` | tag link | literal text; put tags in frontmatter |
| single newline | line break | joined into one paragraph |
| `$math$` | MathJax SVG at build time | MathJax SVG in the browser |

The build failures are deliberate guardrails: publication prep rejects Obsidian-only syntax in a
`.qmd` rather than letting Quarto publish it verbatim, and rejects wikilink syntax anywhere, since
nothing resolves it any more. Prose, links, footnotes, tables, and maths work in both.

Callouts are a `.md`-only feature. Obsidian's `> [!note]` renders as a proper callout in Quartz, and
publication prep rejects it in a `.qmd` because it would publish with the `[!note]` marker showing.
Quarto's own `::: {.callout-note}` is **not** the workaround: Quarto only emits callout markup when
Bootstrap is loaded, and a published `.qmd` here is a body fragment with no Bootstrap, so the div
degrades to a blockquote with the callout type discarded before it ever reaches HTML. In a `.qmd`,
use a blockquote for an aside or a section heading for something substantial enough to want a title.

Maths is MathJax on both sides and renders as SVG, so an equation is glyph-identical whichever file
type it lives in: `.md` is typeset at build time and ships no maths JavaScript at all, while `.qmd`
loads a pinned MathJax runtime. The one exception is maths written *inside* an `{ojs}` cell — say a
`md` template literal that interpolates a reactive value. The Observable runtime renders that with
its own bundled KaTeX, which no configuration here reaches. It looks close but not identical; keep
equations in prose when you want them to match.

## Links and attachments

Link with Markdown syntax only, in both `.md` and `.qmd`, and always write **the path from the
vault folder** with the real source extension:

```markdown
[Convergence](research/convergence.md)
[Computational Features](examples/computational-features.qmd)
![Convergence](attachments/convergence.svg)
```

Obsidian is set to `newLinkFormat: absolute`, so it writes this form for you, resolves it, follows
it, and rewrites it when a note moves or is renamed. Publication prep rewrites `.qmd` targets to
`.md` while staging, because every page reaches the site as `.md`.

There is exactly one reading of a target and no fallbacks. That is the point of the vault-folder
form: a relative or shortest path has two plausible readings, and a bare `index.md` inside a section
means that section's index to Obsidian but the site root to Quartz. A target that only resolves
relative to the document fails the build rather than being guessed at. Linking to an unpublished
note also fails the build.

Wikilinks (`[[Note]]`, `![[figure.png]]`) are not supported and fail the build. There is no
transclusion; link to the source note instead.

Attachments live in `vault/attachments/`, and only those a published page references get copied.
Reference them with Markdown image syntax and the same vault-folder path:
`![alt](attachments/figure.svg)`.

### Data a document computes over

An attachment is something a page *displays*; publication prep finds it by reading the Markdown
image and link syntax. A recording an `{ojs}` cell decodes, or a CSV a `{python}` cell loads, is
neither — it is an input to the computation, and prep cannot see it, because
`FileAttachment("…")` and a raw `<audio src>` are not Markdown references.

Put those beside the note that reads them, in a `data/` folder inside the section, and reference
them **relative to the document** rather than from the vault folder:

```markdown
<audio controls src="data/flute-a4.wav"></audio>
FileAttachment("data/flute-a4.wav")
```

This is the one place the vault-folder rule does not apply, and it works for a different reason
from everything else on this page. Quarto's own resource discovery copies the file to
`generated/quarto/<section>/data/`, the bridge emitter mirrors that whole tree into `site/public/`,
and the relative URL resolves against the page's own address. Prep is not involved at any step.

The consequence worth remembering: **nothing validates these paths.** A renamed or deleted data
file does not fail the build the way a broken Markdown link does. It fails in the browser, and only
on the figures that needed it.

## Building

```bash
npm run build          # the whole pipeline
npm run build-serve    # ... and serve it
npm run site-fast      # prose-only change to a .md: restage and rebuild, no Quarto
npm run preview <f>    # live-reload one .qmd on its own, outside the site
```

`npm run build` is five steps, and knowing them tells you which one broke:

```text
1  design-tokens --check    are the generated theme files current?
2  prepare-publication      stage vault -> generated/quartz-content, clear generated/quarto
3  quarto render            render the generated allowlist of published .qmd
4  prepare-publication      re-check, now requiring a rendered artifact per published .qmd
5  quartz build             generated/quartz-content -> site/public
```

To re-render one document anywhere in the vault, including a private draft:

```bash
cd vault && uv run quarto render path/to/one-note.qmd
```

Then `npm run site-fast`. Plain `npm run site` only rebuilds the site from whatever is already
staged — it will not pick up a vault edit.

### Drafting one `.qmd` on its own

While a document is still being built, the site round-trip is too slow to iterate against. Preview
it directly, from anywhere in the repo:

```bash
npm run preview knowledge/new-signal.qmd     # path relative to vault/
```

That wraps `quarto preview --profile preview`, watching the file and reloading the browser on save.
`_quarto-preview.yml` is gitignored scratch that does two things.

It makes a single file renderable at all. The render list in `_quarto.yml` is negations-only, so it
resolves to zero inputs and a bare `quarto preview <file>` fails with "No output created" rather
than overriding it; the profile adds the one positive glob that makes a file eligible. Never move
that glob into `_quarto.yml`, where it would concatenate with the generated publish allowlist.

It also undoes the stripped-down site format. `_quarto.yml` sets `minimal: true` because Quartz
hosts the body and supplies everything around it; on its own that page has no theme and no chrome.
Profiles merge over the base and scalars override rather than concatenate, so the profile restores
`minimal: false`, a theme, the TOC, and the title block, and you draft against an ordinary Quarto
page. Nothing reaches the site: `npm run render` uses `--profile publish`, and staging clears
`generated/quarto/` before the real render.

**Always pass a file.** A bare `npm run preview` renders every `.qmd` in the vault, drafts included.
Nothing leaks — staging clears `generated/quarto/` and prep rejects an artifact for a non-public
document — but it is slow and not what you meant.

What you get is a Quarto page, not *your* page — readable, but styled by Quarto's default theme
rather than the site's. Everything on the Quartz side is still missing: Markdown links stay dead
because the bridge resolves them at Quartz build time, the `--qmd-chart-*` tokens are unset, and
the `themechange` event never fires, so an Observable Plot chart reading the palette gets empty
strings. Draft here for prose, layout, and whether the computation runs. Switch to
`npm run build-serve` to judge how it actually looks.

### Parking a `.qmd` you are not working on

Quarto's project startup costs about five seconds whatever the render list holds, so trimming that
list buys less than it looks like: five documents render in 8.3s, three in 6.6s, one in 5.0s. Park
a document to cut noise from the build, not to make the build fast.

To park one, set `publish: false` and move its frozen output aside:

```bash
mv vault/_freeze/<section>/<note> vault/_freeze-parked/<section>/<note>
```

The second step is not optional. Prep rejects a tree under `vault/_freeze/` whose owning document
is not published — a frozen result can carry output derived from private data, so a stale one
counts as a leak rather than a cache — and the build fails with the freeze directory named.
`vault/_freeze-parked/` is skipped by prep's source walk and by the freeze check, so the render
stays in version control and restoring is a directory move rather than a re-execution.

Do **not** park by renaming to `*.hidden.qmd`. That is the privacy boundary, and `.gitignore`
drops those files from version control entirely; a tracked fixture renamed that way disappears from
the repo. Path marks a file private, frontmatter marks it unpublished, and parking is the second.

Check what still links to it before you park it — a published page pointing at an unpublished one
fails the build, which is the boundary working. Check what *validates* against it too:
`scripts/validate-*.sh` name specific example pages, and several checks (ipywidgets, Plotly, a
Python `ojs_define` handoff) have no substitute on an Observable-only page. Parking
`examples/computational-features.qmd` or `examples/interactive-features.qmd` takes five of the six
validators down with it.

### Checking it

```bash
npm test                                      # prep, stubs, design tokens
(cd site && npx tsx --test bridge/*.test.ts)  # the Quarto bridge
for f in scripts/validate-*.sh; do sh "$f" || echo "FAILED $f"; done
```

`scripts/validate-*.sh` run against the built site, so build first.

## Things that will bite you

**Freeze can serve you a stale page, and it is worse than it sounds.** `execute: freeze: true`
reuses the frozen result in `vault/_freeze/`, and what that stores is the whole rendered document —
prose, `{ojs}` cell source, and Python cell options, not just the outputs a kernel produced. The
invalidation check looks at the executable code. So editing body text, an Observable cell, or a
`#| label:` can leave the frozen render in place, and the page keeps serving the previous version
with a completely green build and no warning anywhere.

Treat any edit to a `.qmd` as needing an explicit re-render:

```bash
rm -rf vault/_freeze/<section>/<note>      # then
cd vault && uv run quarto render <section>/<note>.qmd
```

Changing the *environment* (a new package, an edited `.mplstyle`, a changed token) does not
invalidate it either. If a rendered page disagrees with its source, this is why.
`vault/_freeze/` is committed on purpose; commit the freeze churn with the change that caused it.

**Observable JS cells share one namespace.** Every `{ojs}` cell in a document, plus every name from
`ojs_define`, lives in one scope. Defining a name twice is a runtime error visible only in the
browser console — the build stays green. If an OJS chart renders blank, open the console first.

**Observable's `width` is not the reading column.** The builtin measures the Quarto frame, which is
wider than the column the text occupies inside the Quartz page, so a figure sized from it overflows
and picks up a horizontal scrollbar. Measure the content element instead:

````markdown
```{ojs}
contentWidth = Generators.observe((notify) => {
  const el = document.querySelector(".quarto-page .quarto-content") ?? document.body
  const read = () => notify(el.getBoundingClientRect().width)
  read()
  const observer = new ResizeObserver(read)
  observer.observe(el)
  return () => observer.disconnect()
})
```
````

**Quarto pages are a full page load.** Navigating into or out of a `.qmd`-backed page leaves the SPA
deliberately. A visible reload there is correct.

**Obsidian's search cannot see `.qmd`.** The `qmd as md` plugin registers the extension but does not
patch Obsidian's index. Use Omnisearch (`Cmd+Shift+O`), which is configured to index `.qmd`. The
quick switcher sees them; core search does not.

**Bookmarks track publication state.** The bookmarks pane carries saved searches for Published, Not
published, Missing description, and Private.

## Changing how it looks

Every colour, font, and chart value comes from **`vault/_theme/tokens.yaml`**. Edit it, then:

```bash
npm run design-tokens
```

which rewrites everything it feeds — the Quartz theme block, the Quarto stylesheet's custom
properties, the Quarto preview theme, and the two files the vault's Python environment reads. Never
edit a generated file by hand; `npm run build` fails on a stale one.

### Swapping the palette

The colours themselves live in **`vault/_theme/palettes/`**, one file per palette, each carrying the
nine colour roles for both modes *and* the shiki theme its code blocks use. Those two travel
together on purpose: a page palette and a code palette that disagree is the drift this prevents.

Switching the whole site is one line in `tokens.yaml`:

```yaml
palette: catppuccin          # or catppuccin-warm, neutral, neutral-catppuccin-code
```

then `npm run design-tokens`. Both renderers follow — Quartz's chrome, the Quarto fragment, the
`quarto preview` theme, and matplotlib.

To add one, copy an existing file. Every palette in that directory is checked by the test suite for
completeness and chart legibility, not just the active one, so an unused alternative cannot rot.

One caveat that is not a matter of taste:

- **Figures are drawn once for both themes.** A matplotlib PNG cannot follow the light/dark toggle,
  so `chart.ink` and `chart.series` stay legible against both page backgrounds; the generator
  refuses colours below 3:1 on either. Live output — Plotly, Observable Plot — is rethemed in the
  browser. Because the grounds come from the palette, swapping palettes re-runs that check.

Quarto-specific CSS goes in `site/bridge/styles/quartoPage.scss`, scoped beneath `.quarto-page`,
using `var(--…)` only. A literal hex there fails validation.

For a Python figure, one hidden setup cell picks up the shared styling:

````markdown
```{python}
#| label: theme-setup
#| include: false
import knowledge_theme
knowledge_theme.apply()
```
````

In Observable, read the palette from the page instead of naming a colour. Hand-built SVG can hold a
`var(--...)` reference directly, in an inline `style` rather than a presentation attribute, and then
needs nothing else:

````markdown
```{ojs}
htl.svg`<line style="stroke: var(--qmd-chart-series-1); stroke-width: 2"/>`
```
````

Observable Plot cannot: it writes its marks as SVG attributes, which take a literal colour. Reading
one at cell time would freeze the chart in whichever theme was active at load, so read it through a
generator that re-reads on the `themechange` event the Quarto bridge dispatches:

````markdown
```{ojs}
theme = Generators.observe((notify) => {
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (k) => cs.getPropertyValue(k).trim()
    return { ink: v("--qmd-chart-ink"), series: [1, 2, 3].map((i) => v(`--qmd-chart-series-${i}`)) }
  }
  notify(read())
  const onChange = () => notify(read())
  document.addEventListener("themechange", onChange)
  return () => document.removeEventListener("themechange", onChange)
})
```
````

Plot needs no help with axes, ticks, or grid lines: it draws them in `currentColor`, and
`quartoPage.scss` already binds that to the chart-ink token.

## Not built yet

- **Reproducibility (Phase 12).** `vault/uv.lock` and a committed `_freeze/` make today's documents
  rebuild deterministically, but nothing *enforces* it — no CI, no lockfile/freeze agreement check.
- **Deployment (Phase 13).** Local only; `baseUrl` is `localhost:8080`. Before deploying: set an
  analytics provider, fill in the footer links, and pin the remaining unpinned CDN reference
  (`@jupyter-widgets/html-manager@*`).
