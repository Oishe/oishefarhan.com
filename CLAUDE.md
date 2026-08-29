# oishefarhan.com

Explorable explanations for signals, systems, and linear algebra.
**Prototype in Python. Ship JavaScript. Never make the reader's phone run Python.**

`WORKFLOW.md` is the runbook — how to publish. `PLAN.md` is the authority on
*why*. This file is the authority on *what you may and may not do* in the repo.

## Layout

```
vault/          Obsidian vault AND Quartz's content root. Open this in Obsidian.
  posts/        .md — kebab-case, no spaces
  attachments/  GENERATED .svg/.mp4/.json — committed, published
notebooks/      marimo .py — prototyping, reference numerics, figure sources,
                and the source of the live notebooks on the subdomain
scripts/        export_figures.py   — notebook plots → vault/attachments/figs/*.svg
                export_fixtures.py  — numpy/scipy → test/fixtures/*.json
                build_notebooks.py  → notebooks-dist/ (WASM, deployed by CI)
sites/quartz/plugins/explorables/   local Quartz transformer (loader.js + lazy images)
packages/explorables/   the TypeScript widget package
  src/dsp/      pure numerics. NO DOM imports here.
  src/components/  Lit custom elements, one file per widget
  src/loader.ts    lazy registry, the only global script
  lab/          the playground — auto-discovers every widget
sites/quartz/   Quartz 5 (vendored upstream; your changes are quartz.config.yaml
                and plugins/, not quartz/)
pyproject.toml  the marimo launcher and nothing else. NOT for notebook deps.
```

Quartz's content root is **`vault/`, not `vault/posts/`**, so `vault/attachments/`
sits inside the content tree and gets published. Posts serve under `/posts/`.

`sites/quartz` and `packages/explorables` are independent npm projects. There is
no root workspace; Quartz needs its own lockfile and `legacy-peer-deps`.

**Every Python environment here is built from a PEP 723 `# /// script` header.**
Each notebook and each `scripts/*.py` declares its own dependencies inline;
`marimo edit --sandbox` and `uv run --script` build an isolated env from exactly
that header, so there is no shared venv for a numeric dependency to drift out
of. Root `pyproject.toml` + `uv.lock` + `.venv/` exist for one reason: to pin the
marimo *launcher* so `just edit`, `just notebooks` and CI all drive the same
marimo. Nothing a notebook imports belongs in it.

**Quartz globs content and `quartz/static/` with `gitignore: true`.** Anything in
`.gitignore` is silently dropped from the build — locally *and* on Cloudflare. So
generated-but-published assets (widget bundles, figure SVGs) are committed, never
ignored. `just publish` writes bundles to `sites/quartz/quartz/static/explorables/`.

## Two origins

| | |
|---|---|
| `oishefarhan.com` | Quartz. Ships **zero** Python. Budgets below apply. |
| `notebooks.oishefarhan.com` | marimo WASM exports. Pyodide lives here, and only here. |

This is what keeps "never ship a language runtime" honest while still publishing
the live notebooks: they are a separate Worker on a separate origin, one click
from a post, so a reader opts in. Linking to them is encouraged. Embedding one in
a post, or putting Pyodide on the main origin, is not.

## Commands

`just` lists everything. Eight recipes, one per thing you actually do —
see `WORKFLOW.md`.

## Never

- Ship Pyodide, marimo-WASM, JupyterLite, or any language runtime **on
  `oishefarhan.com`**. The notebooks subdomain is the sanctioned place for it.
- Enable a Quartz plugin without checking what it fetches at runtime. The graph
  view pulled 2.6 MB of pixi.js + d3 from a CDN on every page; it is off.
- Base64-encode an image into HTML or Markdown.
- Emit matplotlib PNGs. SVG only (`fig.savefig(out, format="svg", bbox_inches="tight")`).
- Use `number[]` in `packages/explorables/src/dsp/`. Always `Float64Array`.
- Import DOM APIs inside `src/dsp/` — it must run headless under Vitest.
- Add a widget without a static fallback child and an `alt` string.
- Introduce a UI framework: React, Vue, Svelte, Astro, Tailwind.
- Run a full-image transform on the main thread. Use a Worker.
- Add a dependency before a widget imports it. An unused dependency is the same
  mistake as unused code, and this repo has already paid for that once.
- Put numpy, scipy, matplotlib or any other notebook import in root
  `pyproject.toml`. It goes in that file's `# /// script` header. The kernel runs
  `--isolated --no-project`, so a dependency added to the project would work on
  your machine and be missing everywhere else.

## Always

- **Parity-test the numerics you wrote by hand.** A hand-rolled FFT gets a
  numpy fixture before it gets a widget. Code that calls a library does not —
  a round-trip (`idct(dct(x)) ≈ x`) plus one known-good value is enough.
  Tolerance `1e-10` for orthonormal transforms; loosen only with a comment saying why.
- Light DOM for Lit components: `protected createRenderRoot() { return this }`.
  Quartz's typography and the page's colour variables both need to reach inside.
- Lazy-load widget code through `loader.ts`. Nothing else global.
- Give a widget a `static lab` block so the playground can generate its controls
  with sensible bounds. It doubles as documentation of the ranges it was built for.
- Kebab-case, space-free vault filenames, so wikilinks resolve identically everywhere.
- Name a component file after its tag: `src/components/basis-rotation.ts` defines
  `<basis-rotation>`. Both `loader.ts` and the lab assume it.
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

## Budgets (gzipped, `oishefarhan.com` only)

| Asset | Budget |
|---|---|
| `loader.js` | ≤ 2 KB |
| Any single widget chunk | ≤ 120 KB |
| Total JS on any one post | ≤ 250 KB |
| Any figure SVG | ≤ 80 KB |
| Any manim clip | ≤ 2 MB |

The widget budgets are deliberately loose enough for a real library — Observable
Plot for charts, KaTeX for typesetting, `ml-matrix` / `fft.js` for linear algebra
— rather than forcing everything to be hand-written and hand-verified. Reach for
one when it deletes code you would otherwise have to test. Do not reach for one
to replace code that already works and has no verification burden: that spends
the budget and buys nothing.

The `loader.js` budget is not negotiable. It loads on every page, including posts
with no widget at all.

## The one escape hatch

If a transform is genuinely too slow in JS **after profiling**, a hand-written
Rust→WASM module of ~20 KB is acceptable. That is categorically different from
shipping a general-purpose language runtime. Profile first.
