# Site redesign — status and continuation

Working document for the design and portfolio overhaul. Delete it when the work
lands. Branch: `markdown-links`. Last verified state: 59 script tests, 27 bridge
tests, six validators, `npm run build` and `npm run validate` all green, working
tree clean.

## Why

`oishefarhan.com` has two jobs in tension. As a publishing system it renders
`.md` through Quartz and `.qmd` through Quarto. As a portfolio it has to present
Oishe to recruiters, hiring managers, and technical managers.

Two problems drove the work:

1. **Drafting happened against a page that lied.** A published `.qmd` is a body
   fragment (`minimal: true`), so `quarto preview` had to restore bootswatch
   chrome just to be readable, and every Observable Plot rendered near-invisible
   grey-on-black.
2. **The site does not present anyone.** It was titled "Knowledge Garden", the
   name Oishe Farhan appeared nowhere, and the chrome (graph, 320px explorer,
   backlinks, a properties table above every article) read as a personal wiki.

## Architecture decision — the fragment stays

Re-litigated with evidence before committing to it.

Quarto emits a body fragment; Quartz owns all chrome. `assertNoBootstrapResources()`
in `site/bridge/quartoPageHtml.ts` hard-fails if Bootstrap survives. Keep this.

`site/bridge/styles/quartoPage.scss` is 377 lines, and its own header comment
splits them two ways, which holds up on inspection:

- **~215 lines** restate Quartz conventions for markup Quartz never sees
  (pandoc's `pre.sourceCode`, Quarto's `.cell-output`, tables, figures).
  Rendering non-minimal would not delete this — it would replace "write on a
  blank slate" with "override Bootstrap until it looks like Quartz."
- **~135 lines** neutralise hardcoded colours that client-side libraries paint
  inline (Plotly, Lumino, Leaflet, Observable Inputs). Unavoidable in any
  architecture.

So the file size is the cost of two renderers, not of `minimal: true`. The real
cost is a small set of Quarto *content* features whose CSS nobody wrote — see
Step 8.

**Rejected: Bootstrap/Bootswatch inside Quartz.** Quartz's `base.scss` is not
Bootstrap-derived; Reboot would reset typography, spacing and form controls
across every component. Turns a bounded problem into an unbounded one.

**Rejected: two shells.** Quarto rendering complete pages gives every Quarto
feature free, but navbar and footer exist twice and drift, and the two dark-mode
toggles use different storage keys and selectors (`localStorage["theme"]` +
`:root[saved-theme]` vs Quarto's own + `body.quarto-dark`), so crossing between
an `.md` and a `.qmd` risks a flash of the wrong theme.

## Decisions taken

- Fragment-in-Quartz confirmed; pay the content-feature CSS debt.
- Quarto features to support: **wide-figure/column layouts, cross-references**.
  Tabsets excluded (need Bootstrap JS). **Callouts dropped** — same root cause:
  Quarto emits callout markup only when Bootstrap is present, so under
  `minimal: true` the div degrades to a blockquote with the type discarded
  before HTML. There are no classes for CSS to reach. `.qmd` files use a
  blockquote or a section heading; `.md` keeps Obsidian callouts, which Quartz
  renders properly.
- Layout: top navbar, no left sidebar, collapsible TOC in the right margin open
  by default. No graph, no explorer, no backlinks panel.
- Code folded by default in `.qmd`, set in the base config.
- Math: MathJax on both sides.
- Sections: **Articles · Notes · Projects**. **No resume page** — resumes are
  tailored per application.
- Palette: **Catppuccin** (Latte/Mocha), with two accents darkened for AA.
- `vault/examples/` never reaches the site.

## Done (commits `8aa6b4d`..`5d9a3d3`)

| Commit | What |
|---|---|
| `8aa6b4d` | Parked the two draft essays; `.cell.hidden` rule so suppressed cells stop printing their source |
| `f9c66e5` | Syntax colours derived from shiki themes; generated Quarto preview theme; preview gets its own output dir and becomes tracked |
| `e6c1c58` | Dropped `@quartz-themes/core` so `tokens.yaml` actually owns the palette |
| `b4ac9dc` | `fixture: true` — publishing fixtures build but never reach the site |
| `1575845` | `chart.grounds` derived from the palette |
| `4ad6249` | Catppuccin palette; alternatives saved in `_theme/palettes/` |
| `0caea34` | OJS preamble hoisted to `_theme/_ojs-setup.qmd`; preview width bug fixed; stub generator drops include shortcodes |
| `8a53927` | MathJax SVG on both sides; Plotly's MathJax 2 dropped in the bridge |
| `434bbb1` | `code-fold: true` plus the `details.code-fold.hidden` rule it needs |
| `4954b37` | Callouts dropped; guardrails and docs corrected |
| `ccd535f` | Column layouts and cross-references; `layout-features.qmd` fixture |
| `ab5bd12` | Top bar, one reading column, TOC right; wiki chrome retired; breakout gutters published; d3/PIXI preloads dropped; preview root font size pinned |
| `f1d019a` | `SiteNav` — wordmark and section links, current section marked; `page-title` retired |
| `5d9a3d3` | IA: `knowledge/` → `articles/` with aliases, Notes and Projects created, `pageTitle` → Oishe Farhan, prose scaffolded with marked TODOs |

### What each unlocked

**Preview convergence.** `vault/_quarto-preview.yml` now compiles
`vault/_theme/quarto-preview-{light,dark}.scss`, generated from `tokens.yaml`.
Verified: preview and publish resolve the same `--qmd-syntax-keyword`, the same
`--qmd-chart-ink`, the same fonts. Two files because Quarto compiles one
Bootstrap bundle per mode and swaps them by toggling `rel` on
`link#quarto-bootstrap`; `$body-bg` cannot hold both values. That split is a
benefit — each bundle defines `--qmd-*` on a plain `:root`, exactly one is
active, so a cell reading a token resolves the right mode with no dark selector.

**Syntax derivation.** `tokens.yaml` named a shiki theme instead of 22 hexes.
This closed a real bug: `quartz.config.yaml` said `github-light` while the
hand-written hexes came from `github-light-default`, so `.md` and `.qmd` code
rendered in different GitHub palettes. Derivation reproduced 9 of 11 hand-written
tokens exactly; `operator` and `meta` moved to what the theme specifies.

**Palette library.** `vault/_theme/palettes/*.yaml`, one per palette, each
carrying colour roles *and* the shiki theme name. `tokens.yaml` names one:

```yaml
palette: catppuccin   # catppuccin-warm | neutral | neutral-catppuccin-code
```

The test suite validates *every* palette for completeness and chart legibility,
so unused alternatives cannot rot.

**Shared OJS preamble.** `vault/_theme/_ojs-setup.qmd` defines `contentWidth`,
`figW` and `col` for every charted article; `signals-as-vectors.qmd` pulls it in
with `{{< include ../_theme/_ojs-setup.qmd >}}`. The move fixed a real bug: the
old `contentWidth` matched only the *published* selector and fell through to
`document.body`, so `quarto preview` sized figures from the viewport. Chaining
`main#quarto-document-content` ahead of the fallback took the measured width
from 1425 to 735 at a 1440 viewport. `col` now reads from `document.body` and
has no hardcoded grey fallback. `stripExecutableCells` drops bare include lines,
so no shortcode reaches `contentIndex.json`; the validator asserts both halves —
no `{{<` in any stub, *and* the include actually resolved in the artifact.

Verified in both renderers at 1440px: identical `--qmd-chart-ink` and series
colours, 720px plots, 32 live OJS cells, no errors.

**One maths renderer.** `renderEngine: mathjax` plus a pinned
`mathjax@3.2.2/es5/tex-svg-full.js` in `_quarto.yml`. Convergence measured, not
assumed: the same TeX through rehype-mathjax at build time and through the CDN
runtime gives byte-identical glyph paths, all nine, even though the bundled
renderer is 3.2.1 and the CDN 3.2.2. SVG output is why. Also removed the
sitewide `katex@0.16.11` CSS and `copy-tex.min.js`, left `.md` pages shipping no
maths JS at all, and closed the unpinned `katex@latest` gap. Lost:
copy-as-LaTeX.

**Folded code.** `code-fold: true` in the base config. The risk gotcha 3 flagged
was real: Signals as Vectors has 23 hidden `<details class="code-fold">` inside
*visible* cells against 9 genuine ones, so the companion
`details.code-fold.hidden` rule is what stands between the article and 23 empty
disclosure triangles. A validator now asserts both the rule and the markup,
because this is a defect that only shows up visually.

**Column layouts and cross-references.** Both survive `minimal: true` with their
classes intact — verified by rendering both ways — so only the CSS was missing.
Two measured decisions:

- **Not a grid.** The plan's named-column grid on `.quarto-content` was tried
  and measured: grid items do not collapse margins, so every gap doubled
  (16→32, 20→40, 24→48) and the article grew 3,276px, 26%. Content stays in
  normal flow; only breakout elements widen. A validator now fails if
  `.quarto-content` ever becomes a grid.
- **The shell owns the gutter.** Deriving the breakout from the viewport assumes
  the reading column is centred in it; measured, that overflowed by 162px,
  because the article fills its grid column exactly (`slack: 0`) with the TOC
  rail 5px later. `--qmd-breakout-page` / `--qmd-breakout-screen` default to
  zero, so breakouts are inert until **Step 9** publishes real values. Confirmed
  inert at 1440/1100/820/600/380px and confirmed to widen once a value is set.

`vault/examples/layout-features.qmd` covers both, with no executable cells so it
stays unfrozen and editable.

**The layout.** Graph, explorer, backlinks, reader-mode, spacer and the
properties table are off; `page-title`, `search` and `darkmode` moved from `left`
to `header`. What is left is a top bar, one reading column at `--measure: 46rem`,
and the TOC in a 16rem right rail that drops away below desktop.

The grid had to be rebuilt, not reconfigured. `DefaultFrame` renders the header
slot inside `.center`, and `.center` sits between the grid and the two children
`base.scss` already gives grid areas to — so `grid-area: grid-header` on
`.page-header` and `grid-area: grid-center` on `.center > article` were both
inert, and a full-width bar was impossible. `.center { display: contents }`
makes them real grid items; `hr` and `.page-footer` then need areas of their own
or they auto-place below the footer.

**Breakout gutters, now with values.** With the measure narrower than the column
it sits in, `--qmd-breakout-page` and `--qmd-breakout-screen` have real room to
publish and Step 8's column layouts finally widen. `--qmd-breakout-screen` is
`slack - 1rem` and `--qmd-breakout-page` is `min(4rem, screen)` — derived from
the wider one, not from the slack, because at 820px the slack is 26px and
deriving both independently made `.column-page` *wider* than
`.column-screen-inset`. The 1rem is the `100vw`-counts-the-scrollbar allowance,
and it is also what makes the inset inset.

Measured on `layout-features.qmd` at 1500/1440/1200/1100/820/600/380:
`scrollWidth === innerWidth` at every width, `.column-page ⊆ .column-screen-inset`
at every width, and the widest breakout (1112px at 1440) stays 48px clear of the
TOC rail at 1160.

**One root font size.** The convergence check turned up a defect Step 6 could not
see: Quarto scales the root to `1.0625rem`, so preview body text was 17px against
Quartz's 16px and MathJax scaled with it — the same display equation measured
224px wide in preview and 211px published, 6.25% adrift. It is `$font-size-root`
that does it, not `$font-size-base`. With the root pinned, both sides now render
16px body text, 720px plots and equation widths of 211/125/1px. A validator
compares `--measure` against `$grid-body-width` so the two renderers cannot drift
apart silently; it was checked by breaking it.

**The navbar.** `site/bridge/siteNav.tsx` renders the wordmark and the section
links and replaces `@quartz-community/page-title` — two components in the header
slot would render two wordmarks. `flex: auto` on `.site-nav` is what pushes the
search and dark-mode toolbar to the far end of the bar. Below 800px the wordmark
and links stack and the toolbar stays on the first line.

Registration is the part with teeth, and gotcha 1 predicted its shape:
`loadQuartzConfig` calls `loadQuartzLayout()` itself and hands the result to a
`PageTypeDispatcher` that closes over it, so pushing a component into
`export const layout` changes nothing. `site/quartz.ts` mutates a fresh layout —
`defaults` **and** every `byPageType` header array, which are distinct objects —
then rebuilds the dispatcher from it. That rebuild is also what carries
`SiteNav.css` into `component-*.css`, because `getQuartzComponents()` walks the
same arrays. Verified: the CSS lands in `component-98583a5c.css`, and both Quarto
validators now assert `class="site-nav"` reaches `.qmd` pages.

The active-section test is pinned by eight tests because it failed silently.
`simplifySlug` strips the **leading** slash only, so `knowledge/` and
`knowledge/index` both simplify to `knowledge/` with the trailing slash intact;
asking whether a page `startsWith(`${section}/`)` builds `knowledge//`, and the
section index — which matches by equality — is then the only page that ever
lights up. Every article rendered as though it belonged nowhere, with otherwise
perfect markup. The tests are JSX-free deliberately: the runner globs
`bridge/*.test.ts`, so a `.test.tsx` would compile and quietly stop running.

SPA navigation was checked too: clicking between sections updates the marker and
leaves exactly one `.site-nav` in the DOM.

**The information architecture.** `vault/knowledge/` → `vault/articles/`,
carrying the article and its audio fixture; `aliases:` keep `/knowledge/index`
and `/knowledge/signals-as-vectors` alive and the redirects are generated and
verified. `notes/` and `projects/` exist with section copy and no entries, each
saying so. `configuration.pageTitle` is **Oishe Farhan**, which is the `<title>`,
the OG title and `SiteNav`'s wordmark fallback. The navbar carries all four.

Everything only Oishe can write is a marked `%%` TODO rather than invented
filler — positioning line, experience, project entries, About narrative, skills
list, GitHub and LinkedIn. Obsidian comments, which the build strips; verified
that no `TODO(oishe)` string survives into the published HTML.

**Four defects that only appeared once there was prose.** Each of these had been
latent for the life of the site and cost nothing to find beyond looking at a
rendered page:

- Every page rendered its title twice — once from `article-title`, once from a
  body `# H1`.
- `hard-line-breaks` turned every source newline into a `<br>`. Prose here wraps
  at ~95 characters, so each line ended where the editor wrapped it *and* wrapped
  again at the reading measure. Disabled. A document that needs a real line break
  uses a trailing double-space, which is standard Markdown and stays local.
- Folder and tag pages wrap their body in a `.popover-hint` holding the article
  **and** the generated listing, so base.scss's `grid-area: grid-center` on
  `.center > article` never reached it and the listing spilled across the full
  column. `.center > .popover-hint` now carries the same area and measure.
- `"1 item under this folder."` sat directly under the section blurb.
  `showFolderCount: false`.

Index pages are navigation, not reading: `enableToc: false` in frontmatter, and
`.content-meta` suppressed on `[data-slug="index"]` and `[data-slug$="/index"]`
— a modified date and a reading time under a person's name is the wiki habit the
redesign exists to remove. The generated listing keeps date and title and drops
the tag column, which broke mid-word at the reading measure.

**Fixtures.** `fixture: true` folds into the existing `publish` gate at the one
place a document is read, so staging, link map, freeze check and the Quarto
allowlist all follow. `npm run build` cannot see a fixture; `npm run validate`
builds them to `generated/fixture-site` and runs all six validators there.

## Gotchas — these cost real time to find

1. **`export const layout` from `site/quartz.ts` is dead code.**
   `loadQuartzConfig()` calls `loadQuartzLayout()` itself
   (`config-loader.ts:512`) and hands that object to `PageTypeDispatcher`, which
   closes over it. Adding a header component requires **replacing the dispatcher
   instance**, not mutating the export. Two further traps:
   `buildLayoutForEntries` always assigns `result.header` (possibly `[]`), so the
   `if (!pt.header)` fallback at `config-loader.ts:707` never fires and each
   `byPageType` entry owns a distinct array; and `resolveLayout` does
   `overrides.header ?? sharedDefaults.header`, where `[] ?? x` is `[]`.

2. **Quartz globs content with `gitignore: true`** (`quartz/util/glob.ts`).
   A content root under the ignored `generated/` finds zero files. The existing
   `site/content` symlink is what hides that; `site/fixture-content` is the same
   trick. Any new content root needs a symlink from inside `site/`.

3. **A hidden `<details>` inside a visible `.cell` is invisible to
   `.cell.hidden`.** This was the `code-fold` trap, now closed in `434bbb1` —
   23 of the 32 folds on Signals as Vectors are of this shape. Kept here because
   the shape recurs: Quarto's own stylesheet carries the hiding rules for its
   markup, `minimal: true` drops it, and any *new* Quarto content feature with
   an `echo: false` path needs the same check. A config diff enabling such a
   feature always looks fine; the breakage is only visible.

4. **The MCP browser runs with Chrome force-dark.** It inverts every screenshot
   regardless of CSS — a hardcoded `#faf8f8` on `#ffffff` photographs as near
   black, and `emulateMedia`/`color-scheme` do not disable it. Before any
   screenshot:

   ```js
   const cdp = await page.context().newCDPSession(page);
   await cdp.send('Emulation.setAutoDarkModeOverride', { enabled: false });
   ```

5. **`site/quartz/styles/custom.scss` is unlayered and appended last**
   (`componentResources.ts:347` wraps base in `@layer quartz-base` then
   concatenates custom). It beats everything in `base.scss` without
   `!important`, and it is exempt from both style validators —
   `validate-shared-visual-language.sh` scopes its checks to the compiled
   `quartoPage.scss` `component-*.css` and to `quartoPage.scss` by name.

6. **The JSON schema is editor-only.** `quartz-plugins.schema.json` omits
   `header`, `footer` and `template`, but nothing validates it at build time and
   the loader honours all three. The config already violates it. Do **not** patch
   it — `QUARTZ_UPSTREAM.md` claims `spa.inline.ts` is the only patched vendored
   file, and that claim is checkable.

7. **`DefaultFrame` always renders `<div class="left sidebar">`** even when the
   `left` array is empty. Clearing `left` in config leaves a 320px empty column;
   the grid must be overridden.

8. **Freeze silently ignores edits — it does not re-execute.** The earlier note
   here had this backwards. `_freeze/*/execute-results/html.json` stores the
   document's entire executed **markdown**, prose included, and `freeze: true`
   restores that instead of reading the source. Editing a frozen `.qmd` produces
   no kernel start, no `Output created`, and no change on the page: the edit is
   simply dropped. Cost an hour of "why is my fixture not updating".
   `articles/signals-as-vectors.qmd` and `examples/layout-features.qmd` have no
   freeze entry (no executable Python), so both are editable;
   `computational-features.qmd` and `interactive-features.qmd` are frozen and
   need `--no-freeze` or a deleted freeze entry before any edit takes effect.

9. **Bash tool cwd persists between calls.** A `cd site` in one call silently
   applies to the next. This caused an edit to land in the wrong `package.json`.
   Prefix with an explicit `cd /Users/oishe/code/knowledge`.

10. **Quarto resolves `{{< include >}}` in a pre-engine text pass that ignores
    HTML comments.** Spelling the shortcode out as a usage example inside
    `_ojs-setup.qmd`'s own header comment made the file include itself and
    recurse until `RangeError: Maximum call stack size exceeded`. The stack
    trace is a thousand identical `retrieveInclude` frames and names no file;
    `grep -v retrieveInclude` is what makes the real error visible. Describe an
    include in prose, never verbatim, inside a file that can be included.

11. **An include shifts OJS source lines**, so every render of an article using
    `_ojs-setup.qmd` prints `WARN: OJS block count mismatch. Line number
    reporting is likely to be wrong` once per included cell — three today. It
    degrades the line numbers in OJS *runtime error* messages and nothing else;
    the cells evaluate normally. Accepted cost, not a regression to chase.

12. **Plotly nests a MathJax 2.7.5 loader inside its cell output** so LaTeX in
    chart labels renders. It claims `window.MathJax`, which makes MathJax 3
    abort with `Cannot read properties of undefined (reading 'loader')`, after
    which MathJax 2 typesets the page in `.MathJax_SVG` markup nothing here
    styles. Under KaTeX this was invisible. The bridge now drops it
    (`isPlotlyMathJax`), but note *where*: it is nested in the figure, not
    hoisted into head/body, so the existing resource filter could not see it and
    it needed a tree walk. Any future "strip a script Quarto emitted" work has
    to ask which of the two it is.

13. **A vault attachment referenced from a `.qmd` 404s.** Quartz rewrites
    `attachments/x.svg` to `../attachments/x.svg` on the `.md` side; the bridge
    rewrites `<a href>` for `.md`/`.qmd` targets only, so `<img src>` reaches
    the page unchanged and misses. Publication prep *accepts* the path (it
    checks the attachment exists), so the failure is silent until you look at
    the page. Not fixed — the fix needs the bridge to tell a vault attachment
    from a Quarto page-relative resource like the article's `data/flute-a4.wav`,
    which means passing the link map's `attachments` list into `quartoPage.tsx`.
    Worth doing before any article uses an attachment.

14. **`@quartz-community/note-properties` is the frontmatter parser.** Its name
    and its options describe a properties table, and turning that table off is
    the obvious way to stop it printing above every article. Do not. Its
    `markdownPlugins` step is what sets `file.data.frontmatter`; disable the
    plugin and every document has no frontmatter, `explicit-publish` filters the
    whole vault, and the build reports `Filtered out 4 files` and emits a site
    with no pages and **no error**. Suppress the table instead: no `layout`
    entry, so the component is never placed, plus `hidePropertiesView: true`.
    Cost: a full bisect of the plugin list, because nothing in the failure names
    the plugin responsible.

15. **`Header.css` never ships.** `DefaultFrame` hardcodes the `<header>`
    wrapper rather than placing it in a layout array, and `collectComponents`
    only walks those arrays, so the wrapper's `display: flex` never reaches the
    page. Invisible while the header slot was empty; the moment anything is put
    in it, the bar lays out as a block with the toolbar stacked under the
    wordmark. `custom.scss` declares the row itself. Any other frame-hardcoded
    component has the same hole.

16. **Auto margins cancel a grid item's stretch.** `max-width: var(--measure);
    margin-inline: auto` centres the article, and also makes it shrink-to-fit:
    the reading column was 736px on the article and 632px on the home page,
    changing width from page to page. `width: 100%` alongside the `max-width` is
    what fixes it. The same shape bit the footer from the other direction —
    `base.scss` leaves `margin-right: auto` on it at desktop, so it shrank to
    its content and sat against the left page edge.

17. **Publication prep resolves links inside `%%` comments.** A TODO note that
    sketches `[Title](notes/slug.md)` for a page that does not exist yet fails
    the build — before Quartz ever gets to strip the comment. Describe the link
    in prose inside a comment; never write one.

18. **Scratch HTTP servers** may still be running: 8991 (`generated/quarto-preview`),
    8992 (`site/public`), 8993 (bake-off builds — one was still holding the port
    from a previous session; 8994 was used for the fixture site instead).
    Restart as needed, and check `lsof -ti:<port>` before trusting a 404.

## Remaining work

### Step 11b — the prose Oishe has to write

The structure is built and every page renders. What is left is the content only
he has, marked in the vault as `%%` TODO comments so it is findable with
`grep -rn "TODO(oishe)" vault/`. Nothing here blocks anything else; the site is
publishable without it, it just does not yet say anything.

**`vault/index.md`**
- The positioning line — role + domain + what he is looking for, one sentence.
  It is the first thing a hiring manager reads.
- Two or three more **Featured work** entries. *Signals as Vectors* is the only
  real one; projects are the natural second and third.
- **Selected experience** — 3–5 lines of `Company — Role — the outcome in one
  line`. Outcome, not responsibility.
- GitHub and LinkedIn. Confirm `farhanoishe@gmail.com` is the address to
  publish; it was taken from git config. **No resume link** — resumes are
  tailored per application.

**`vault/about/index.md`** — 2–3 paragraphs of narrative connecting ECE, data
and software engineering, and ML into one line of work, plus an explicit skills
list a keyword-scanning recruiter can hit.

**`vault/projects/`** — at least two, one page each on a fixed skeleton:
*Problem → Approach → Result → Stack → Links*. Until then the Projects nav item
leads to a page that says it is empty, which is honest but is not the intent.

**`vault/notes/`** — the MIT flow-matching and diffusion coursework, the labs,
the prerequisite review.

Also open: the footer's `links: {}` in `site/quartz.config.yaml`, which should
carry the same GitHub / LinkedIn / email as the home page.

### Step 12 — deployment gaps

1. **`baseUrl: localhost:8080`** → `oishefarhan.com`. Feeds
   `@quartz-community/cname` (`site/public/CNAME` currently contains the literal
   `localhost`) and `basePath` in `renderPage.tsx`, so canonical URLs, sitemap,
   RSS and OG tags are all wrong until set.
2. **No CI, and no git remote at all** (`git remote -v` is empty). Needs a GitHub
   repo plus a workflow. Requirements: Node ≥22, `uv` + Python, the Quarto CLI,
   and `vault/_freeze/` committed or CI re-executes every notebook.
   ⚠️ **CI must run `npm run validate`, not just `npm run build`** — validate is
   what builds the fixtures and runs the six validators. Running only `build`
   silently drops all bridge coverage.
3. **`og-image` disabled** — every link pasted into LinkedIn or an email has no
   preview card. Disabled over a build-time font fetch; fine in CI, or pin the
   font.
4. **`footer.options.links: {}`** — fill with GitHub / LinkedIn / email.
5. **`analytics: null`** — optional.
6. **Favicon** — plugin enabled; confirm there is an icon to serve.

## Verification

```bash
npm run build      # production site -> site/public
npm run validate   # fixtures -> generated/fixture-site, then all six validators
npm test           # 58 tests
```

`npm run design-tokens -- --check` gates every token change and runs first in
`npm run build`, so a forgotten regeneration fails fast.

Bridge tests are **not** in `npm test`, which globs `scripts/*.test.ts` only.
Run them with `cd site && npx tsx --test bridge/*.test.ts` (27 today). That glob
is why `siteNav.test.ts` carries no JSX — a `.test.tsx` compiles fine and stops
being run.

**Convergence check** — the point of the exercise. Render
`articles/signals-as-vectors.qmd` both ways and compare in light and dark at
1440px:

```bash
npm run preview articles/signals-as-vectors.qmd    # port varies; read the log
npm run build-serve                                 # localhost:8080
```

Observable Plot figures should have identical ink and series colours, code blocks
identical token colours, equations identical glyphs, figures the same width.
Remember gotcha 4 before screenshotting. As of `ab5bd12` this measures: 16px root
and body text, 720px plots, display equations 211/125/1px, and a reading column
of 736px published against 738px in preview — the 2px is Quarto's own grid
padding.
