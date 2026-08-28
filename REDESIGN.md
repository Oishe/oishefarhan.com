# Dropping Quartz

Decision record for the migration from a two-renderer site (Quarto body fragments hosted inside a
vendored Quartz) to a single Quarto website. Supersedes the previous REDESIGN.md, which recorded the
design-system rebuild of `956f25a`; the parts of it that survive the migration are folded in below.

Escape hatch: tag `quartz-final` marks `956f25a`, the last commit with the fork and the bridge.

```bash
git checkout quartz-final -- site/
```

## Why

The site rendered `.md` through Quartz and `.qmd` through Quarto. The cost of that was not either
renderer. It was making two renderers agree.

Measured at `956f25a`:

| | |
|---|---|
| Project-owned glue | ~5,500 lines |
| Vendored Quartz | 139 files, no Git metadata, pinned at `075afd3` |
| `generate-design-tokens.ts` | 855 lines projecting one palette into **6** outputs |
| `prepare-publication.ts` | 901 lines |
| `quartoPageHtml.ts` | 267 lines of HTML surgery on Quarto output |
| `generate-qmd-stub.ts` | every `.qmd` compiled twice |
| Quarto profiles | 4 |
| Validators | 6, of which 4 tested the bridge |
| Documented gotchas | 18, of which 11 were Quartz internals or seam bugs |

`generate-design-tokens.ts --check` is the tell. A drift detector is the correct response to
unavoidable duplication and an admission that the duplication is structural.

What the two renderers bought, against what they cost:

- **Commit `956f25a` disabled every feature that justified Quartz.** `graph`, `explorer`,
  `backlinks`, `tag-list`, `recent-notes`, `stacked-pages`, `page-title` and `reader-mode` are all
  `enabled: false`; `left` is cleared on every page type; `obsidian-flavored-markdown` runs with
  `wikilinks: false`. Its own commit message says the Quartz chrome "read as a personal wiki rather
  than a portfolio."
- **The layout that replaced it is Quarto's default layout.** "A top bar, one reading column and a
  right-hand TOC" is what `quarto render` emits for a website project with `toc-location: right`.
  5,147 lines went into rebuilding Quartz into Quarto's shape.
- **Obsidian-only syntax in real content: zero.** The only file using `> [!note]` or `==highlight==`
  was `examples/markdown-features.md`, a fixture whose purpose was proving the feature worked.
- **Volume.** 6 published `.md` files (all index/about pages) and 1 published article, which is
  `.qmd`. The Quartz half served six index pages and a self-referential fixture.
- **Nothing was deployed.** `git remote -v` was empty. No live URLs, no SEO, no inbound links. The
  cheapest possible moment to cut.

The reverse trade was never available: `articles/signals-as-vectors.qmd` is 30 OJS cells. Dropping
Quarto was not on the table.

### The friction that actually mattered

`minimal: true` made the drafting view lie. `AUTHORING.md` said so plainly — under `quarto preview`
you got "a Quarto page, not *your* page", with dead links, unset `--qmd-chart-*` tokens and no
`themechange` event. That is the same complaint that motivated the design-system rebuild, and it was
structural to hosting a fragment. With one renderer, `minimal: true` goes away and **preview and
publish are the same render**.

Second: the `.md` / `.qmd` divergence table in `AUTHORING.md` listed six syntaxes that worked in one
engine and hard-failed in the other. One engine collapses that table to one column.

## Decisions

1. **Quarto owns the chrome.** Site becomes `project: type: website`. `minimal: true` is deleted.
2. **`_theme/quarto-preview-{light,dark}.scss` are promoted to the site theme.** They were already
   generated from `tokens.yaml`; they stop being a preview-only approximation.
3. **Links become document-relative.** Obsidian switches to `newLinkFormat: relative`.
4. **`%%` comments are dropped entirely, not stripped.** The repo is going to a public remote, so
   comment-stripping was never a privacy mechanism — the source is public either way. TODOs live in
   `_hidden/`, which is the actual privacy boundary. Publication prep *rejects* `%%` in any
   published file rather than silently passing it through to render as literal text.
5. **`site/` is deleted, not archived in-tree.** Tag `quartz-final` is the archive.
6. **No graph view.** Ruled out on page weight, independently of this migration.
7. **Backlinks are deferred**, not refused. Prep already parses every link
   (`scripts/prepare-publication.ts:325`); persisting the edges and inverting them is the work, and
   it is worth doing when there are enough notes to link.

### Why relative links, when the previous decision was absolute

`AUTHORING.md` argued against relative paths because "a bare `index.md` inside a section means that
section's index to Obsidian but the site root to Quartz." **That ambiguity was a Quartz artifact.**
Quarto resolves relative paths the way Obsidian resolves them, so the reason for vault-absolute
paths leaves with Quartz. Prep still validates every link, so a broken one fails the build.

Confirmed empirically during the spike: rendering the vault-absolute form under a Quarto website
project produces `WARN: Unable to resolve link target: examples/examples/markdown-features.md` —
Quarto resolving the path relative to the document, exactly as predicted. 22 links across 10 files.

## The spike

A throwaway `_quarto-webtest.yml` rendered the article and both interactive fixtures as a full
Quarto website (`minimal: false`, navbar, right TOC, the preview theme) with no Quartz involved.
Served on `:8995` and driven through a real browser. Results:

### Works natively; the bridge workarounds were unnecessary

`examples/interactive-features.qmd`, standalone:

| | |
|---|---|
| OJS cells rendered | 7, none empty, 0 errors |
| OJS reactive input | live |
| ipywidgets views | 11 |
| `ipyleaflet` map | renders |
| RequireJS | loaded natively |

Quarto emits `requirejs@2.3.6` and `@jupyter-widgets/html-manager` itself. The bridge's UMD-global
pinning existed only because a fragment was being hosted inside another page's script environment.
It is not needed.

`articles/signals-as-vectors.qmd`, standalone: **zero console errors.** 88 MathJax 3 containers,
34 OJS cells (0 empty, 0 errors), 32 SVG plots, the audio element, working code-fold, TOC, navbar.
The interactive basis-rotation figure responds to its slider.

### Found during the migration

Two defects that only exist because Quarto owns the chrome. Both are now guarded in
`prepare-publication.ts`, and both were found by building the thing rather than by reading docs.

**Quarto listings glob the filesystem, not the render list.** A `publish: false` draft left in
`articles/` was linked from the published `articles/index.html` *and* had its raw `.qmd` source
copied into the output tree as a listing resource. The render reports `contains no metadata` and
carries on. Quartz's folder-page could not do this because it only ever saw the staged published
tree; there is no staged tree now, so `checkListingLeaks` enforces it — an unpublished document in
a listed folder fails the build. Verified with a deliberate probe file, which the guard caught.

**`aliases:` means two different things.** Obsidian reads an entry as another *name* for the note,
for the quick switcher. Quarto reads it as another *URL* and emits a redirect page — resolved
against the aliasing document's own directory. So `Knowledge Notes` on `articles/index.md`
published a junk redirect at `articles/Knowledge Notes/index.html`, and `knowledge/index`, written
to preserve the old URL, landed at `articles/knowledge/index/` instead of the site root. Aliases
are now required to be site-absolute (`checkAliases`), and display-only aliases were dropped.
`/knowledge/index` and `/knowledge/signals-as-vectors` both resolve.

### Broken in vanilla Quarto — not a Quartz artifact

**Plotly on a page that also has maths.** Gotcha 12 from the old REDESIGN.md was recorded as a
bridge problem. It is not. Quarto nests a MathJax 2.7.5 loader inside Plotly's cell output; it
claims `window.MathJax`, and MathJax 3 aborts:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'loader')
    at https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg-full.js
```

Switching to `html-math-method: katex` does **not** fix it. It converts a crash into a double
render: MathJax 2 reaches inside KaTeX's `katex-mathml` annotation and typesets the MathML fallback,
so both renderings appear nested (`.MathJax_SVG` with `inKatex: true`). Both states are wrong.

The bridge's `isPlotlyMathJax` stripper was a real fix for a real Quarto bug, and deleting the
bridge gives the bug back.

**Scope: one file.** `grep -rln plotly --include='*.qmd' vault/` returns
`examples/computational-features.qmd` and nothing else. The published article uses Observable Plot
(38 `Plot.` calls) and no Python at all. This is a fixture-only defect today.

**Policy:** Observable Plot for interactive figures, matplotlib for static ones. Keep Plotly out. If
Plotly is ever wanted on a page with maths, the fix is a Lua filter doing what `isPlotlyMathJax`
did — walk the tree and drop the nested loader. Note *where*: it is inside the figure, not hoisted
into head or body, so a head/body resource filter cannot see it. (`plotly.io` may also have an
`include_mathjax` route; untested.)

## Migration

1. **Tag `quartz-final`.** Done.
2. `_quarto.yml` → `type: website`. Drop `minimal: true`. Promote the preview SCSS to the site
   theme. Navbar for articles / notes / projects / about, `toc-location: right`, built-in search.
   Delete `_quarto-preview.yml` — the base config is now the drafting view.
3. Obsidian → `newLinkFormat: relative`. Rewrite the 22 links. Strip the absolute-path branch from
   `rewriteLinkTargets`; keep validation, made relative-aware.
4. Extend prep's `%%` rejection from `.qmd` to `.md`.
5. Rebuild `articles/`, `notes/`, `projects/` indexes as Quarto `listing:` pages. Deletes
   hand-maintained index bodies; gives recent-notes and tag pages for free.
6. Repoint `generate-design-tokens.ts`: 6 targets → 4. Delete `renderQuartzThemeBlock`,
   `renderQuartzFontsBlock`, `renderQuartzSyntaxBlock`, `applyGeneratedBlock`, `blockMarkers`,
   `renderQuartoTokensScss`. `--check` still proves no drift, over the whole surface.
7. Delete `site/`, `scripts/generate-qmd-stub.*`, `validate-qmd-stub.sh`,
   `validate-qmd-stub-suppression.sh`, `validate-quarto-emitter.sh`. Reclaim callouts as
   `::: {.callout-note}` — they were unavailable only because `minimal: true` dropped Bootstrap.
8. Deploy: `site-url`, GitHub Pages, CI running `quarto render` + `npm test` + the three surviving
   validators, with `vault/_freeze/` committed.

Steps 1–7 are done. Step 8 is open.

### Net

Against `quartz-final`: **206 files changed, 1,194 insertions, 39,992 deletions.**

| | Before | After |
|---|---|---|
| Renderers | 2 | 1 |
| Vendored files | 139 | 0 |
| Design-token targets | 6 | 4 |
| Validators | 6 | 3 |
| `scripts/` | 5,498 lines | 2,586 |
| `_quarto-preview.yml` | 68 lines | 23 |
| Preview fidelity | approximation | the page |

The profile *count* did not change — base, publish, preview, fixtures — but only `preview` is
hand-written, and it no longer overrides a single format option. It exists solely to add the one
positive render glob that a negations-only base list cannot supply.

### Also deleted

`examples/a-signal-is-a-vector.qmd` (835 lines) and `examples/a-signal-is-a-vector-python.qmd`
(956 lines): `publish: false`, no `fixture: true`, so they rendered in no profile at all. A bake-off
record of the OJS route against the Python route. Git history keeps them.

`examples/computational-features.qmd` and `examples/interactive-features.qmd` stay as fixtures. OJS,
ipywidgets and Plotly can still break, and that is the one validator worth its keep.

## What survives

`prepare-publication.ts` stays. It is the publish allowlist, the privacy boundary, the link
validator and the freeze-leak check, and Quarto provides none of those. It sheds stub generation and
the `.qmd`→`.md` rewriting. `validate-publication-prep.sh` stays; it is the most important test in
the repo.

`tokens.yaml` stays the single source of colour, type and chart values.

## Gotchas that survive the migration

Renumbered. Everything about Quartz internals, `custom.scss` layering, `DefaultFrame`, the page-type
dispatcher, the note-properties frontmatter trap, and bridge link resolution is gone with `site/`.

1. **Freeze silently ignores edits — it does not re-execute.** `_freeze/*/execute-results/html.json`
   stores the document's entire executed *markdown*, prose included, and `freeze: true` restores
   that instead of reading the source. Editing a frozen `.qmd` produces no kernel start, no
   `Output created`, and no change on the page: the edit is dropped, on a green build, with no
   warning. Changing the environment — a new package, an edited `.mplstyle`, a changed token — does
   not invalidate it either.

   ```bash
   rm -rf vault/_freeze/<section>/<note>
   cd vault && uv run quarto render <section>/<note>.qmd
   ```

   **Largely fixed.** `_quarto.yml` now sets `freeze: auto` rather than `true`. `auto`
   re-executes when the source changes, which is what freeze was always assumed to do; `true` is
   what silently drops edits. The hazard that remains is narrower: a change to the *environment* —
   a new package, an edited `.mplstyle`, a changed token — still does not invalidate a frozen
   result. Delete the freeze entry by hand for those.

   Freeze also earns nothing on an OJS-only document. `signals-as-vectors.qmd` is 30 OJS cells and
   zero Python, and OJS runs in the browser.

2. **Quarto resolves `{{< include >}}` in a pre-engine text pass that ignores HTML comments.**
   Spelling the shortcode out inside `_ojs-setup.qmd`'s own header comment made the file include
   itself until `RangeError: Maximum call stack size exceeded`. The trace is a thousand identical
   `retrieveInclude` frames and names no file; `grep -v retrieveInclude` is what makes the real
   error visible. Describe an include in prose, never verbatim, inside a file that can be included.

3. **An include shifts OJS source lines**, so every render of an article using `_ojs-setup.qmd`
   prints `WARN: OJS block count mismatch. Line number reporting is likely to be wrong` once per
   included cell — three today. It degrades line numbers in OJS *runtime* errors and nothing else.
   Accepted cost, not a regression to chase.

4. **Plotly + maths is broken.** See the spike section above.

5. **Observable JS cells share one namespace.** Every `{ojs}` cell in a document, plus every name
   from `ojs_define`, lives in one scope. Defining a name twice is a runtime error visible only in
   the browser console; the build stays green. If an OJS chart renders blank, open the console.

6. **Maths inside an `{ojs}` cell is rendered by Observable's own bundled KaTeX**, which no
   configuration here reaches. It looks close to the page's MathJax but not identical. Keep
   equations in prose when you want them to match. (The spike measured 4 such KaTeX nodes on the
   article against 88 MathJax containers.)

7. **The MCP browser runs with Chrome force-dark**, which inverts every screenshot regardless of
   CSS. `emulateMedia` and `color-scheme` do not disable it. Before any screenshot:

   ```js
   const cdp = await page.context().newCDPSession(page);
   await cdp.send('Emulation.setAutoDarkModeOverride', { enabled: false });
   ```

8. **Bash tool cwd persists between calls.** A `cd vault` in one call silently applies to the next.
   Prefix with an explicit `cd /Users/oishe/code/knowledge`.

9. **Scratch HTTP servers may still be running.** Check `lsof -ti:<port>` before trusting a 404.

## Open

- **`site-url`** must be set before deployment; canonical URLs, sitemap, RSS and OG tags depend on
  it. The Quartz-specific half of this problem — the `cname` plugin writing a literal `localhost`
  into `site/public/CNAME`, and `og-image` disabled over a build-time font fetch — leaves with
  `site/`.
- **No CI and no git remote.** CI needs Node ≥22, `uv` + Python, the Quarto CLI, and
  `vault/_freeze/` committed or every notebook re-executes.
- **The prose only Oishe can write.** The positioning line, experience, project entries, the About
  narrative and the skills list are still TODO markers. They move from `%%` comments to `_hidden/`.
