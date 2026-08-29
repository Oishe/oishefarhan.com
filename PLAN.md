# Why this site is built the way it is

A record of decisions, and the measurements behind them. `WORKFLOW.md` is how to
publish; `CLAUDE.md` is what you may and may not do. This file is *why*, so that
a future change either respects the reasoning or overturns it deliberately.

## The thesis

**Prototype in Python. Ship JavaScript. Never make the reader's phone run Python.**

The predecessor site was marimo exported to WebAssembly. It proved the
explanations worked and exposed two separate costs, which are easy to conflate:

| Cost | Cause |
|---|---|
| Multi-MB boot before anything renders | Pyodide + numpy + scipy compiled to WASM |
| Slider lag *after* boot | Every interaction round-trips Python → matplotlib → PNG encode → base64 → DOM replacement |

Measured from saved DOM snapshots, which **exclude** the WASM runtime — real
transfer was worse:

- `01_signal_is_a_vector`: 1.38 MB total; 0.95 MB of HTML, ~0.7 MB of it ten base64 PNGs.
- `03_compression_simple_app`: 14.74 MB total; **14.31 MB of HTML, ~14 MB of it four base64 PNGs at 3.2–3.9 MB each.**

The second cost is the interesting one. It would persist under Quarto+Shiny,
under JupyterLite, under anything that keeps Python in the interaction loop. The
fix is architectural, not a matter of picking a lighter runtime.

The general form of the argument: **check whether the interactive part is
actually closed-form before reaching for a runtime.** `basis-rotation` is a 2×2
rotation. There was never any numpy in its interactive path.

## Three tiers, and where work belongs

- **Tier 0 — build time.** Math typesetting, diagrams, static plots, pre-rendered
  animations, precomputed data. Output: SVG, MP4, JSON. Reader ships zero JS.
  *Most content lives here.*
- **Tier 1 — small client JS.** A slider re-evaluating a closed-form function; a
  canvas transforming an image the reader supplied.
- **Tier 2 — a language runtime in the browser.** Only when the *reader* must
  execute arbitrary code they typed.

## Two origins

Tier 2 is not banned — it is **relocated**. The live marimo notebooks are
genuinely worth publishing: they show the Python, and the Python is part of the
portfolio. So they get their own Cloudflare Worker on their own origin.

| | |
|---|---|
| `oishefarhan.com` | Quartz. Ships zero Python. Budgets apply. |
| `notebooks.oishefarhan.com` | marimo WASM. Pyodide lives here, and only here. |

A post links to a notebook; it never embeds one. The reader who wants a fast
page gets one, and the reader who wants the interpreter opts in. Measured, for
three notebooks: 2,219 files against Cloudflare's 20,000 free-tier limit, largest
file 4.60 MiB against 25 MiB. Pyodide itself is not bundled — the export fetches
it from jsdelivr at runtime. No COOP/COEP headers are needed, and
`require-corp` would actively break that fetch.

## Settled choices

**Quartz 5, not Astro.** The wiki layer — wikilinks, backlinks, Obsidian
compatibility — is the point. Astro's islands buy little when every widget is a
self-contained custom element.

**Not Quarto.** Its `{ojs}` cells are JavaScript anyway, so it does not keep
Python in the interactive path, and it costs the entire vault. Revisit only if
BibTeX and cross-references become a real pain point.

**marimo stays** as the prototyping, derivation and reference-implementation
environment. We changed what it *exports*, not that we use it.

**TypeScript, `strict`.** Typed arrays are where ported DSP silently breaks —
`Float64Array` vs `number[]` vs `Uint8ClampedArray` mixups produce plausible
wrong output rather than a crash. Custom element attributes are stringly typed.
And Quartz is TypeScript already.

**Lit, light DOM.** `createRenderRoot() { return this }`, so Quartz's typography
and KaTeX's global stylesheet both reach inside. Standard custom elements come
out the other end, so this survives an SSG change.

## What the build taught us

**Quartz's content root is `vault/`, not `vault/posts/`.** Its asset emitter only
copies non-Markdown files that live *inside* the content root. Rooted at
`vault/posts/`, every figure in `vault/attachments/` would 404.

**Quartz globs with `gitignore: true`.** Anything in `.gitignore` is silently
dropped from the build, locally and on Cloudflare alike. This bit once: the
widget bundle was ignored as "generated output" and simply never appeared.
Generated-but-published assets are committed.

**The graph view costs 2.6 MB.** `@quartz-community/graph` eagerly loads pixi.js
(2.3 MB) and d3 (273 KB) from a CDN on *every* page, with no option to defer, to
draw a graph of a handful of notes. It is off. Wikilinks and backlinks are the
wiki behaviour that actually earns its keep. Revisit if the plugin learns to
defer its renderer.

**Webfonts cost 28 Lighthouse points.** Quartz's font emitter does not
self-host despite `fontOrigin`'s naming, so the configured typography meant two
render-blocking requests to a second origin plus ~250 KB. Turning it off moved
mobile performance from 70 to 98. `theme.typography` still names the faces, so
it is one line to revert if the typography is worth it.

**A heatmap is raster data.** `matrix-equation.svg` embeds a PNG for its 64×64
heatmap — 22 KB of a 32 KB file. The vector alternative is 4096 `<rect>`s and a
much larger file. It is the only figure that does this, and it is correct.

**KaTeX in a widget is now affordable, and it was the CSS that was expensive.**
The original argument was that KaTeX is ~78 KB gz to typeset eight numbers, so
`basis-rotation` drew its matrix equation with a CSS grid. What that missed:
Quartz's latex plugin already loads KaTeX's stylesheet on *every* page, math or
not, so the marginal cost of using it in a widget is JS only — and the CSS
version could never match the typography of the display math surrounding it.
The dependency is pinned to the same version Quartz serves, because the CSS on
the page and the JS in the bundle have to agree. Typesetting measures 0.63 ms
cold, 0.003 ms cached.

The cost to a reader is zero, and this is worth understanding rather than
trusting: the widget chunk is lazy-loaded and sits below the fold, so it does not
appear in the post's initial network payload at all. Measured after the swap,
mobile Lighthouse over gzip: **performance 95 on the post, 97 on the landing
page, TBT 0 ms, CLS 0**, post weight 256 KiB. Measure over a *compressing*
server — `python3 -m http.server` sends no gzip and scores the same page 76,
which is an artefact of the server, not the site.

## Budgets

They exist to prevent the failure this whole architecture is a reaction to. They
were loosened once, deliberately, so that a real library can be used where it
deletes code that would otherwise need hand-verification — but a library that
replaces working code with no verification burden spends the budget and buys
nothing. Current numbers live in `CLAUDE.md`.

`loader.js ≤ 2 KB gz` is not negotiable: it loads on every page, including posts
with no widget at all. It is currently 841 bytes.

## Backlog

- **The sparsity explorer.** `<input type="file">` → `createImageBitmap` →
  `getImageData` → Worker (Comlink) → transform → threshold → `putImageData`. No
  PNG encode anywhere. Expect it to beat the desktop marimo version, because the
  encode/base64/DOM-replace round trip is gone. This is what `src/dsp/` was built
  for and it is still the only consumer that would justify it.
- **Wavelets (db4).** Deferred until DFT and DCT are proven in a shipped post.
  Verify `discrete-wavelets`' db4 support before committing, or budget ~60 lines
  of hand-rolled lifting steps.
- **The figure pipeline beyond matplotlib.** CircuiTikZ for ECE schematics, D2 or
  Typst+CeTZ for block diagrams, manim for motion — all compiled to committed
  SVG/MP4 at build time so no deploy ever needs LaTeX installed. A `figures.mk`
  for this existed with zero inputs for long enough to be deleted; write it again
  when there is a first real figure to build, not before.
- **KaTeX CSS is render-blocking** (~830 ms of a mobile run) because
  `@quartz-community/latex` hardcodes a jsdelivr URL. Fixing it means owning the
  math plugin, which is also the prerequisite for subsetting the fonts.
  Performance is 98 with it in place, so it can wait.
- **Three accessibility failures remain, all in Quartz's own chrome** (a11y 89
  on a post, 94 on the landing page, measured under Lighthouse 13.4.1):
  an `aria-*`/role mismatch on `div.explorer`; footer links whose opacity drops
  them below 4.5:1; and no `<main>` landmark on any page. None originate in our
  widgets, figures or styles. The contrast one is a one-line palette change that
  would lighten every link on the site — a taste call, not a silent fix. The
  landmark and aria ones mean editing vendored Quartz components, which is a
  bigger commitment than it looks: `sites/quartz/quartz/` is upstream, and local
  edits there become merge conflicts on every update.
- **Figures carry no explicit `width`/`height`.** CLS measures 0, but that is
  luck rather than design; a manifest of intrinsic sizes would make it so.
