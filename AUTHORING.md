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

Templater scaffolds this: new notes in `about/ projects/ experience/ courses/ knowledge/ writing/`
get it automatically, and `templates/tpl-computational.qmd` adds the hidden theme-setup cell.

## Visibility

| State | Convention | GitHub | Website |
|---|---|---:|---:|
| Private | any path under a `*_hidden/` folder, or a `*.hidden.md` / `*.hidden.qmd` file | no | no |
| Unpublished | normal path, `publish: false` | yes | no |
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
| `> [!note]` | callout | **build fails** — use `::: {.callout-note}` |
| `==highlight==` | highlight | **build fails** — use `<mark>` |
| `#tag/inline` | tag link | literal text; put tags in frontmatter |
| single newline | line break | joined into one paragraph |
| `$math$` | KaTeX at build time | KaTeX in the browser |

The build failures are deliberate guardrails: publication prep rejects Obsidian-only syntax in a
`.qmd` rather than letting Quarto publish it verbatim, and rejects wikilink syntax anywhere, since
nothing resolves it any more. Prose, links, footnotes, tables, and maths work in both.

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

## Building

```bash
npm run build          # the whole pipeline
npm run build-serve    # ... and serve it
npm run site-fast      # prose-only change to a .md: restage and rebuild, no Quarto
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

### Checking it

```bash
npm test                                      # prep, stubs, design tokens
(cd site && npx tsx --test bridge/*.test.ts)  # the Quarto bridge
for f in scripts/validate-*.sh; do sh "$f" || echo "FAILED $f"; done
```

`scripts/validate-*.sh` run against the built site, so build first.

## Things that will bite you

**Freeze can serve you a stale page.** `execute: freeze: true` reuses the frozen result in
`vault/_freeze/`. It keys on the source file, so an ordinary edit invalidates it — but a change to
the *environment* (a new package, an edited `.mplstyle`, a changed token) does not. If a rendered
page disagrees with its source, re-render that document explicitly. `vault/_freeze/` is committed on
purpose; commit the freeze churn with the change that caused it.

**Observable JS cells share one namespace.** Every `{ojs}` cell in a document, plus every name from
`ojs_define`, lives in one scope. Defining a name twice is a runtime error visible only in the
browser console — the build stays green. If an OJS chart renders blank, open the console first.

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

which rewrites the four generated files it feeds — the Quartz theme block, the Quarto stylesheet's
custom properties, and the two files the vault's Python environment reads. Never edit those four by
hand; `npm run build` fails on a stale one.

Two caveats:

- **The `colors` block in `tokens.yaml` is inert.** The site loads `@quartz-themes/core`, whose CSS
  is injected unlayered and outranks the palette Quartz generates. The live values are `#ffffff` and
  `#1C1C1C`, recorded separately as `chart.grounds`. Which one should own the palette is open.
- **Figures are drawn once for both themes.** A matplotlib PNG cannot follow the light/dark toggle,
  so `chart.ink` and `chart.series` stay legible against both; the generator refuses colours below
  3:1 on either. Live output — Plotly, Observable Plot — is rethemed in the browser.

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

In Observable, read the palette from the page instead of naming a colour:

````markdown
```{ojs}
seriesColor = (n) => getComputedStyle(document.documentElement)
  .getPropertyValue(`--qmd-chart-series-${n}`).trim()
```
````

## Not built yet

- **Reproducibility (Phase 12).** `vault/uv.lock` and a committed `_freeze/` make today's documents
  rebuild deterministically, but nothing *enforces* it — no CI, no lockfile/freeze agreement check.
- **Deployment (Phase 13).** Local only; `baseUrl` is `localhost:8080`. Before deploying: set an
  analytics provider, fill in the footer links, and pin the two unpinned CDN references
  (`katex@latest`, `@jupyter-widgets/html-manager@*`). Note that `.qmd` pages currently load KaTeX
  twice, at `0.16.11` from Quartz and `latest` from Quarto.
