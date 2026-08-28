# Authoring

The writing reference for this vault. Why the system is shaped this way lives in `REDESIGN.md`;
Obsidian install and plugin detail lives in `vault/.obsidian/PLUGINS.md`.

```text
vault/            you edit here, and only here
generated/site/   the built site
generated/        everything else here is derived, gitignored, never edited
```

Nothing in `generated/` survives a rebuild. Fix problems in `vault/`.

One renderer: Quarto renders every page, prose and computational alike. There is no staging step
and no second Markdown dialect.

## Frontmatter

```yaml
---
title: Convergence Diagnostics       # falls back to the filename
description: One line.               # used for listings, search, and previews
aliases: [/old/url]                  # URLs this page also answers on; must start with /
tags: [research/computation]
publish: true                        # WITHOUT THIS THE PAGE IS NOT PUBLISHED
---
```

Templater scaffolds this: new notes in `about/ articles/ notes/ projects/` get it automatically, and
`templates/tpl-computational.qmd` adds the hidden theme-setup cell.

**Aliases are URLs, not names.** Obsidian treats `aliases:` as extra names for the quick switcher;
Quarto treats each one as a URL and publishes a redirect page there. Prep requires the leading
slash so the key means one thing — see the note in `REDESIGN.md`. A display-only alias is not worth
a junk page; drop it.

A colon inside an unquoted `description:` breaks the YAML parse. Use an em dash.

## Visibility

| State | Convention | GitHub | Website |
|---|---|---:|---:|
| Private | any path under a `*_hidden/` folder, or a `*.hidden.md` / `*.hidden.qmd` file | no | no |
| Unpublished | normal path, `publish: false` | yes | no |
| Fixture | normal path, `publish: false` and `fixture: true` | yes | no |
| Published | normal path, `publish: true` | yes | yes |

Path is the privacy boundary; frontmatter is the publication switch.

```text
*_hidden/          a folder -- `_hidden/`, `drafts_hidden/`, `research_hidden/`
*.hidden.md/qmd    a single file, when one note in an otherwise public folder must stay local
```

Both are invisible to publication prep, so `publish: true` inside them does nothing. Private
attachments and private frozen output must also sit below a `*_hidden/` folder.

A published page may not link to an unpublished one — that fails the build with the file named.
That is the boundary working.

**The repo is public.** A comment is not a privacy mechanism: `%%…%%` is rejected outright (it
publishes as visible text, and Quarto has no Obsidian comment), and an HTML comment still ships in
the page source. Notes-to-self go in `_hidden/`. `vault/_hidden/todo-site-prose.md` holds the ones
for the pages that are still placeholders.

**Drafts may not sit in a listed folder.** `articles/`, `notes/` and `projects/` are Quarto
`listing:` pages, and a Quarto listing globs the filesystem rather than the render allowlist — so an
unpublished draft there gets linked from the public listing *and* has its raw source copied into the
site. Prep fails the build on it. Draft in `_hidden/` and move the file in when it is ready.

### Fixtures

`vault/examples/` holds pages that exist to be tested, not read: a Python cell, a Jupyter widget, an
Observable cell, a Plotly figure. The validators inspect the built HTML.

They must still be built, and never reach the site. `fixture: true` is that seam:

```text
npm run build       renders publish:true only            -> generated/site
npm run validate    renders publish:true + fixture:true  -> generated/fixture-site, then validates
```

A document that sets both `fixture: true` and `publish: true` fails the build rather than resolving
the contradiction quietly.

## `.md` or `.qmd`

The rule is only about execution: use `.qmd` when a page computes something, `.md` otherwise. A
`.qmd` with no executable cell is just a slower `.md`. An executable cell in a `.md` is a Quarto
error, not a silent no-op.

Both are rendered by the same engine, so there is one dialect. Quarto is Pandoc Markdown, not
Obsidian Markdown, and prep rejects the Obsidian-only constructs in **both** file types rather than
letting them publish verbatim:

| Obsidian writes | Write instead |
|---|---|
| `> [!note]` | `::: {.callout-note}` |
| `==highlight==` | `<mark>highlight</mark>` |
| `%%comment%%` | nothing — put it in `_hidden/` |
| `[[Note]]`, `![[figure.png]]` | a Markdown link or image |
| `#tag/inline` | put tags in frontmatter |
| single newline as a line break | a blank line; Pandoc joins single newlines into one paragraph |

Callouts, cross-references, column layouts and code folding all work, because Quarto owns the page
and Bootstrap is loaded. Maths is MathJax 3, pinned in `_quarto.yml`, and identical in both file
types.

## Links and attachments

Link with Markdown syntax, **relative to the document doing the linking**:

```markdown
[Two](two.md)                       a sibling
[Home](../index.md)                 up a level
[Examples](index.md)                this section's index
![Convergence](../attachments/convergence.svg)
```

Obsidian is set to `newLinkFormat: relative`, so it writes this form, resolves it, follows it, and
rewrites it when a note moves. Quarto resolves it the same way. Nothing rewrites a link in between —
which is why a link that works while drafting works on the site.

Write the real source extension (`.qmd` or `.md`); Quarto maps it to `.html`. Linking to an
unpublished note fails the build, as does a target that resolves to nothing.

Attachments live in `vault/attachments/`. Only those a published page references are copied.

### Data a document computes over

An attachment is something a page *displays*, and prep finds it by reading Markdown image and link
syntax. A recording an `{ojs}` cell decodes, or a CSV a `{python}` cell loads, is neither — prep
cannot see it, because `FileAttachment("…")` and a raw `<audio src>` are not Markdown references.

Put those beside the note that reads them, in a `data/` folder inside the section:

```markdown
<audio controls src="data/flute-a4.wav"></audio>
FileAttachment("data/flute-a4.wav")
```

Quarto's own resource discovery copies the file next to the rendered page, and the relative URL
resolves against the page's address. Prep is not involved.

The consequence worth remembering: **nothing validates these paths.** A renamed or deleted data file
does not fail the build the way a broken Markdown link does. It fails in the browser, on the figures
that needed it.

## Building

```bash
npm run build          # the whole pipeline -> generated/site
npm run serve          # serve what was built, on :8080
npm run preview <f>    # live-reload one document while drafting
npm run validate       # build the fixtures, then run the three validators
npm test               # 52 unit tests
```

`npm run build` is four steps, and knowing them tells you which one broke:

```text
1  design-tokens --check    are the generated theme files current?
2  prepare-publication      validate the vault, write the render allowlist, clear generated/site
3  quarto render            render the allowlist
4  prepare-publication      re-check, now requiring a rendered page per published document
```

To re-render one document anywhere in the vault, including a private draft:

```bash
cd vault && uv run quarto render path/to/one-note.qmd
```

### Drafting

```bash
npm run preview articles/new-signal.qmd     # path relative to vault/
```

**What you draft against is the published page.** Same theme, same measure, same maths, live links.
The preview profile adds one thing — a positive render glob, because the base render list is
negations-only and a bare `quarto preview <file>` would fail with "No output created". It overrides
no format option, and it must stay that way.

**Always pass a file.** A bare `npm run preview` renders every document in the vault, drafts
included. Nothing leaks — it writes to its own output directory and the site is built from the
allowlist — but it is slow and not what you meant.

### Parking a `.qmd` you are not working on

Quarto's project startup costs about five seconds whatever the render list holds, so trimming that
list buys less than it looks like. Park a document to cut noise from the build, not to make it fast.

Set `publish: false` and move its frozen output aside:

```bash
mv vault/_freeze/<section>/<note> vault/_freeze-parked/<section>/<note>
```

The second step is not optional. Prep rejects a tree under `vault/_freeze/` whose owning document is
not published — a frozen result can carry output derived from private data, so a stale one counts as
a leak rather than a cache. `vault/_freeze-parked/` is skipped by both the source walk and the
freeze check, so the render stays in version control and restoring is a directory move.

Do **not** park by renaming to `*.hidden.qmd`. That is the privacy boundary, and `.gitignore` drops
those files from version control entirely.

If the document lives in a listed folder, parking it is not enough — move it to `_hidden/`, or the
listing guard will fail the build.

## Things that will bite you

**Freeze can still serve a stale page, but only in one way now.** `_quarto.yml` sets `freeze: auto`,
which re-executes when the source changes — that closes the old trap where editing a frozen `.qmd`
was silently dropped on a green build. What `auto` does *not* notice is a change to the
*environment*: a new package, an edited `.mplstyle`, a changed token. If a rendered page disagrees
with its inputs, delete its freeze entry and re-render.

```bash
rm -rf vault/_freeze/<section>/<note>
cd vault && uv run quarto render <section>/<note>.qmd
```

`vault/_freeze/` is committed on purpose; commit the churn with the change that caused it. An
OJS-only document needs no freeze at all — OJS runs in the browser.

**Plotly and maths do not coexist.** Quarto nests a MathJax 2.7.5 loader inside Plotly's cell output
which claims `window.MathJax`; MathJax 3 then aborts with `Cannot read properties of undefined
(reading 'loader')` and the page's equations do not render. Switching to KaTeX makes it worse, not
better — MathJax 2 reaches inside KaTeX's MathML annotation and renders the equation a second time.
Use Observable Plot for interactive figures and matplotlib for static ones.
`validate-interactive-components.sh` fails the build if Plotly appears outside the one fixture.

**Observable JS cells share one namespace.** Every `{ojs}` cell in a document, plus every name from
`ojs_define`, lives in one scope. Defining a name twice is a runtime error visible only in the
browser console — the build stays green. If an OJS chart renders blank, open the console first.

**Maths inside an `{ojs}` cell** — an `md` template literal interpolating a reactive value — is
rendered by Observable's own bundled KaTeX, which no configuration here reaches. It looks close to
the page's MathJax but not identical. Keep equations in prose when you want them to match.

**An include shifts OJS source lines**, so every render of a document using `_ojs-setup.qmd` prints
`WARN: OJS block count mismatch` once per included cell. It degrades line numbers in OJS *runtime*
errors and nothing else. Accepted cost, not a regression.

**Never write `{{< include … >}}` verbatim inside a file that can itself be included**, not even in
a comment. Quarto resolves includes in a pre-engine text pass that ignores HTML comments, so the
file includes itself until `RangeError: Maximum call stack size exceeded`. The trace is a thousand
identical `retrieveInclude` frames and names no file; `grep -v retrieveInclude` is what makes the
real error visible.

**Obsidian's search cannot see `.qmd`.** The `qmd as md` plugin registers the extension but does not
patch Obsidian's index. Use Omnisearch (`Cmd+Shift+O`), which is configured to index `.qmd`. The
quick switcher sees them; core search does not.

## Changing how it looks

Every colour, font, and chart value comes from **`vault/_theme/tokens.yaml`**. Edit it, then:

```bash
npm run design-tokens
```

which rewrites the four files it feeds: the light and dark site stylesheets
(`_theme/site-{light,dark}.scss`) and the two files the vault's Python environment reads. Never edit
a generated file by hand; `npm run build` fails on a stale one.

### Swapping the palette

The colours live in **`vault/_theme/palettes/`**, one file per palette, each carrying the nine colour
roles for both modes *and* the shiki theme its code blocks derive from. Those travel together on
purpose: a page palette and a code palette that disagree is the drift this prevents.

Switching the whole site is one line in `tokens.yaml`:

```yaml
palette: catppuccin          # or catppuccin-warm, neutral, neutral-catppuccin-code
```

then `npm run design-tokens`. To add one, copy an existing file. Every palette in that directory is
checked by the test suite for completeness and chart legibility, not just the active one, so an
unused alternative cannot rot.

One caveat that is not a matter of taste:

- **Figures are drawn once for both themes.** A matplotlib PNG cannot follow the light/dark toggle,
  so `chart.ink` and `chart.series` stay legible against both page backgrounds; the generator
  refuses colours below 3:1 on either. Live output — Observable Plot — is rethemed in the browser.

For a Python figure, one hidden setup cell picks up the shared styling:

````markdown
```{python}
#| label: theme-setup
#| include: false
import knowledge_theme
knowledge_theme.apply()
```
````

In Observable, read the palette from the page rather than naming a colour. Hand-built SVG can hold a
`var(--…)` reference directly, in an inline `style` rather than a presentation attribute:

````markdown
```{ojs}
htl.svg`<line style="stroke: var(--qmd-chart-series-1); stroke-width: 2"/>`
```
````

Observable Plot cannot: it writes its marks as SVG attributes, which take a literal colour. Reading
one at cell time would freeze the chart in whichever theme was active at load. Quarto's dark-mode
toggle swaps the stylesheet and then fires a `resize` event on `window` — it dispatches no theme
event of its own — so that is the hook to re-read on:

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
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
})
```
````

Plot needs no help with axes, ticks, or grid lines: it draws them in `currentColor`, and the site
stylesheet binds that to the chart-ink token.

## Not built yet

- **Deployment.** Local only. `site-url` is unset, so canonical URLs, the sitemap and OG tags are
  wrong until it is.
- **No CI and no git remote.** CI needs Node ≥22, `uv` + Python, the Quarto CLI, and
  `vault/_freeze/` committed or every notebook re-executes. It must run `npm run validate`, not just
  `npm run build` — validate is what builds the fixtures and runs the validators.
- **Backlinks.** Prep already parses every link; persisting the edges and inverting them is the
  work. Worth doing when there are enough notes to link.
- **One unpinned CDN reference**, `@jupyter-widgets/html-manager@*`, emitted by Quarto.
