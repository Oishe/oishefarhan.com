# oishefarhan.com

Explorable explanations for signals, systems, and linear algebra.
**Prototype in Python. Ship JavaScript. Never make the reader's phone run Python.**

`PLAN.md` is the design document and the authority on *why*. This file is the
authority on *what you may and may not do* while working in the repo.

## Layout

```
vault/          Obsidian vault AND Quartz's content root. Open this in Obsidian.
  posts/        .md — kebab-case, no spaces
  figures/      figure SOURCES (.typ .d2 .tex .py) — ignored by the site build
  attachments/  GENERATED .svg/.mp4/.json — committed, published
notebooks/      marimo .py — prototyping, reference numerics, AND figure sources
scripts/        export_fixtures.py — numpy/scipy → test/fixtures/*.json
                export_figures.py  — notebook plots → vault/attachments/figs/*.svg
sites/quartz/plugins/explorables/   local Quartz transformer (loader.js + lazy images)
packages/explorables/   the TypeScript widget package
  src/dsp/      pure numerics. NO DOM imports here.
  src/components/  Lit custom elements, one file per widget
  src/loader.ts    lazy registry, the only global script
  lab/          Vite dev pages — the marimo replacement
sites/quartz/   Quartz 5
```

Quartz's content root is **`vault/`, not `vault/posts/`**, so that
`vault/attachments/` sits inside the content tree and gets published. Posts are
served under `/posts/`. `figures/` is excluded via `ignorePatterns`.

`sites/quartz` and `packages/explorables` are independent npm projects. There is
no root workspace; Quartz needs its own lockfile and `legacy-peer-deps`.

**Quartz globs content and `quartz/static/` with `gitignore: true`.** Anything
listed in `.gitignore` is silently dropped from the build — locally *and* on
Cloudflare. So generated-but-published assets (widget bundles, figure SVGs) are
committed, never ignored. `just widgets` writes to
`sites/quartz/quartz/static/explorables/`, published at `/static/explorables/`.

## Commands

`just` lists everything. The ones that matter:

| | |
|---|---|
| `just test` | vitest --watch — the numerics loop |
| `just lab` | vite dev server over `lab/`, LAN-visible for phone QA |
| `just site` | build widgets + site into `sites/quartz/public` |
| `just serve` | same, then serve it as deployed |
| `just fixtures` | regenerate numpy/scipy parity fixtures |
| `just figures` | re-render every figure (marimo SVGs, then typst/d2/tex/manim) |
| `just check` | typecheck + tests + fixture drift (what CI runs) |

## Never

- Ship Pyodide, marimo-WASM, JupyterLite, or any language runtime to the browser.
- Enable a Quartz plugin without checking what it fetches at runtime. The graph
  view pulled 2.6 MB of pixi.js + d3 from a CDN on every page; it is off.
- Import KaTeX into a widget. It is ~78 KB gz. Draw the math with CSS or SVG.
- Base64-encode an image into HTML or Markdown.
- Emit matplotlib PNGs. SVG only (`fig.savefig(out, format="svg", bbox_inches="tight")`).
- Use `number[]` in `packages/explorables/src/dsp/`. Always `Float64Array`.
- Import DOM APIs inside `src/dsp/` — it must run headless under Vitest.
- Add a widget without a static fallback child and an `alt` string.
- Introduce React, Vue, Svelte, Astro, Tailwind, Plotly, or full `d3`.
- Run a full-image transform on the main thread. Use a Worker.

## Always

- Parity-test against a numpy/scipy fixture **before** building the widget.
  Tolerance `1e-10` for orthonormal transforms; loosen only with a comment saying why.
- Round-trip too (`idct(dct(x)) ≈ x`) — it catches normalization errors that
  one-directional tests miss.
- Light DOM for Lit components: `protected createRenderRoot() { return this }`.
  KaTeX's global stylesheet and Quartz's typography both need to reach inside.
- Lazy-load widget code through `loader.ts`. Nothing else global except KaTeX CSS.
- Kebab-case, space-free vault filenames, so wikilinks resolve identically everywhere.
- Write figure-producing plot functions as marimo `@app.function`, i.e. module
  level. Nested `def`s inside `@app.cell` cannot be imported, so the exporter
  would have to re-implement them — and a re-implemented figure drifts.
- Draw figure ink (text, spines, ticks, grid) from rcParams, never hardcoded, so
  `export_figures.py` can swap in a sentinel and rewrite it to `var(--ink)`.
  That is the only way an SVG inside `<img>` can follow the page's dark mode.
- Measure a real Lighthouse run before claiming a page is fast. Two of the three
  worst regressions so far came from Quartz defaults, not from our code.
- Native `<input type="range">` for sliders — keyboard accessibility comes free.
- rAF-throttle slider handlers; never recompute synchronously per `input` event.
- `playsinline` on every `<video>`, or iOS Safari hijacks it fullscreen.

## Budgets (gzipped)

| Asset | Budget |
|---|---|
| `loader.js` | ≤ 2 KB |
| Any single widget chunk | ≤ 50 KB |
| Total JS on any one post | ≤ 100 KB |
| Any figure SVG | ≤ 80 KB |
| Any manim clip | ≤ 2 MB |

## The one escape hatch

If a transform is genuinely too slow in JS **after profiling**, a hand-written
Rust→WASM module of ~20 KB is acceptable. That is categorically different from
shipping a general-purpose language runtime. Profile first.
