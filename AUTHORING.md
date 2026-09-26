# Authoring

Quick reference for writing pages. Obsidian setup is in `vault/.obsidian/PLUGINS.md`.

## New article

1. Create `vault/articles/<slug>.qmd`. Use a lowercase, hyphenated filename; it becomes the URL.
   Use `.md` instead if the page has no code cells.
2. Start from this skeleton:

   ````markdown
   ---
   title: Compression via Sparsity
   description: One sentence for the listing, search, and link previews.
   date: 2026-09-17
   tags:
     - ml/signal-processing
   publish: false
   ---

   {{< include ../_theme/_ojs-setup.qmd >}}

   ## Introduction
   ````

   The include line is only needed for Observable figures.

   In Obsidian, run Templater's *Insert template* in the new file instead. It fills in the title
   from the filename (edit it into a proper title) and today's date:

   | Template | For |
   |---|---|
   | `tpl-article.qmd` | an article with Observable figures (the skeleton above) |
   | `tpl-computational.qmd` | a page with Python cells, with the theme setup cell included |
   | `tpl-note.md` | a prose page; also applied to any new `.md` in `about/` or `articles/` |
3. Put data files in `vault/articles/data/` and load them with a relative path.
4. Preview while you write: `npm run preview articles/<slug>.qmd`
5. Commit the draft whenever you like. With `publish: false` it stays off the site and out of the
   Articles listing. The repo is public, though, so anything that must stay private goes in
   `_hidden/` instead.
6. To publish, set `publish: true`, run `npm run build`, and push to `main`.

## Frontmatter

```yaml
title: Required. Needs quotes if it contains a colon.
description: One line, for listings, search, and link previews. Also quote it if it has a colon.
date: 2026-09-17            # sorts the Articles listing, newest first
tags: [ml/linear-algebra]
aliases: [/old/url]         # old URLs that redirect here; must start with /
image: data/card.png        # optional link-preview image; defaults to the site card
publish: true               # without this, the page is not published
```

`aliases` are URLs, not names. Quarto publishes a redirect page for each one, so a display-only
alias creates a junk page. The build rejects any alias without a leading `/`.

## Visibility

| Where it lives | GitHub | Site |
|---|:---:|:---:|
| `*_hidden/` folder, or a `*.hidden.md` / `*.hidden.qmd` file | no | no |
| anywhere else, `publish: false` or no `publish` | yes | no |
| anywhere else, `publish: true` | yes | yes |

- A published page cannot link to an unpublished one. The build fails and names the file.
- Comments are not private. `%%…%%` fails the build, and an HTML comment ships in the page source.
  Notes to yourself go in `_hidden/`.
- A section index with a `listing:` must keep `include: { publish: true }`, or drafts beside it get
  listed and their source is copied into the site. The build enforces this.

## Syntax

Quarto renders Pandoc Markdown, not Obsidian Markdown. The build rejects the Obsidian-only forms:

| Instead of | Write |
|---|---|
| `> [!note]` | `::: {.callout-note}` … `:::` |
| `==highlight==` | `<mark>highlight</mark>` |
| `%%comment%%` | nothing; put it in `_hidden/` |
| `[[Note]]`, `![[figure.png]]` | `[Note](note.md)`, `![](figure.png)` |
| `#inline/tag` | `tags:` in frontmatter |
| a single newline as a line break | a blank line |

Callouts, cross-references, columns, code folding and MathJax maths all work.

## Links and files

Every link is **relative to the page doing the linking**, and uses the source extension:

```markdown
[Signals as Vectors](signals-as-vectors.qmd)
[About](../about/index.md)
![Convergence](../attachments/convergence.svg)
```

Obsidian writes links in this form (`newLinkFormat: relative`), so a link that works in Obsidian
works on the site. The build fails on a link that resolves to nothing.

Files that code reads, such as `FileAttachment("data/x.csv")` or `<audio src="data/x.wav">`, are
copied by Quarto automatically. **Nothing validates these paths**: a renamed data file breaks in the
browser, not in the build.

## Figures

**Observable (interactive).** The `_ojs-setup.qmd` include defines three things:

- `figW`: the reading-column width, capped at 720px, reactive to resizes
- `col.ink`: the chart ink colour
- `col.series[0..5]`: six series colours

```ojs
Plot.plot({
  width: figW,
  marks: [Plot.line(data, { x: "t", y: "v", stroke: col.series[0] })],
})
```

Axes and grid lines need no colour; Plot draws them in `currentColor`. Hand-built SVG can use
`style="stroke: var(--qmd-chart-series-1)"` directly.

**Python (static).** Put a hidden setup cell first, then use matplotlib normally:

````markdown
```{python}
#| include: false
import knowledge_theme
knowledge_theme.apply()
```
````

Figures have transparent backgrounds and colours that work on both themes. Frozen output under
`vault/_freeze/` is committed so CI never runs Python. Commit it with the change that caused it.

## Commands

```bash
npm run preview <file>   # live-reload one page (path relative to vault/); always pass a file
npm run build            # full build -> generated/site
npm run serve            # serve the build on :8080
npm run validate         # build, then check the built site
npm run design-tokens    # after editing vault/_theme/tokens.yaml
```

When `npm run build` fails, the error names the file and the rule it broke. The build runs in four
stages: token check, prep, `quarto render`, and prep again to verify the output.

## Gotchas

- **OJS cells share one namespace** per page. Defining a name twice is an error visible only in the
  browser console; the build stays green. If a chart is blank, open the console first.
- **No Plotly on a page with maths.** Quarto nests a MathJax 2 loader inside Plotly output, and it
  breaks the page's MathJax 3; KaTeX double-renders instead. Use Observable Plot or matplotlib.
  `npm run validate` fails on a published page with Plotly. A fix would be a Lua filter that drops the
  nested loader from inside the figure output.
- **Maths inside an OJS `md` template** is rendered by Observable's KaTeX, which looks slightly
  different from the page's MathJax. Keep equations in prose.
- **Stale frozen output.** `freeze: auto` re-runs a `.qmd` when its source changes, but not when a
  package, `.mplstyle` or token changes. Delete `vault/_freeze/<section>/<page>/` and re-render.
- **Unpublishing a Python `.qmd`**: also delete its `vault/_freeze/<section>/<page>/`. The build
  treats frozen output of an unpublished page as a leak.
- **Never spell out an include shortcode inside a file that can be included**, even in a comment.
  Quarto expands it anyway, and the file includes itself until the stack overflows. The error is a
  wall of `retrieveInclude` frames; `grep -v retrieveInclude` finds the real message.
- `WARN: OJS block count mismatch` on pages using the include is expected and harmless.
- **Obsidian's core search skips `.qmd`.** Use Omnisearch (`Cmd+Shift+O`).

## Changing the look

All colours, fonts and chart values come from `vault/_theme/tokens.yaml`, with the palette itself in
`vault/_theme/palettes/`. Edit, then run `npm run design-tokens`. The build fails if the generated
files are stale.

`vault/_theme/site-custom.scss` is hand-written page furniture (home hero, cards, timeline). It must
use CSS variables such as `var(--secondary)` rather than hex colours, because one copy serves both
themes. `npm run validate` rejects a literal colour there.
