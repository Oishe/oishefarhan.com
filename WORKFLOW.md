# How to publish

Four stages. You rarely touch more than one.

```
1. WRITE      Obsidian, in vault/posts/
2. PROTOTYPE  marimo, in notebooks/        just figures
3. OPTIMIZE   only if a figure should move  just lab
4. PUBLISH                                  just publish
```

Everything below stage 1 is optional. A post with no interactive figure never
leaves stage 1 and 4.

---

## 1. Write

Write in Obsidian. `vault/` is both the Obsidian vault and Quartz's content
root — open `vault/` itself as a vault.

When a note in your personal vault is ready, copy it into `vault/posts/`.
Filenames are **kebab-case with no spaces**, so wikilinks resolve the same in
Obsidian and on the site.

Frontmatter that matters:

```yaml
---
title: A Signal is a Vector
description: One sentence. It becomes the meta description and the preview text.
tags: [signals, linear-algebra]
---
```

That is the whole of stage 1. `just publish` and you are done.

---

## 2. Prototype

Derivations, numerics and figures live in `notebooks/` as marimo notebooks.

```sh
just edit 01      # marimo, sandboxed from the notebook's own PEP 723 header
just figures      # → vault/attachments/figs/*.svg, committed
```

`just edit` is a thin wrapper. By hand it is:

```sh
uv run marimo edit --sandbox --no-token --watch ./notebooks/01_signal_is_a_vector.py
```

`uv run` needs no setup step — a fresh clone syncs `.venv/` from `uv.lock` on
first use. That venv holds *only* marimo, because `--sandbox` builds the
notebook's real environment from its `# /// script` header instead. Add numpy or
scipy to a header, never to `pyproject.toml`.

Two rules make `just figures` work, and both are load-bearing:

1. **Every plotting function is `@app.function`** — module level, not nested
   inside a cell. `scripts/export_figures.py` imports the notebook and calls
   them. A nested `def` is invisible to it, so the figure would have to be
   re-implemented, and a re-implemented figure drifts from the notebook.
2. **Figure ink comes from rcParams, never hardcoded.** The exporter draws with
   a sentinel colour and rewrites it to `var(--ink)`, which is the only way an
   SVG inside `<img>` follows the page's dark mode.

Figures are byte-reproducible: re-running `just figures` on an unchanged
notebook produces no git diff.

### The live notebooks

Push to `main` and CI exports every notebook to WebAssembly and deploys it to
**notebooks.oishefarhan.com** — real Python, running in the reader's browser.

That subdomain is a separate Cloudflare Worker on a separate origin, which is
what keeps the main site's promise intact: `oishefarhan.com` ships zero Python.
Link to a notebook from a post; never embed one.

> `notebooks/` here is the copy the site publishes from. The same notebooks also
> exist in `/Users/oishe/code/sparsity`, which has its own GitHub Pages deploy
> and is not touched by this repo. If you edit one, edit the copy here.

---

## 3. Optimize

Only when a figure should stop being a picture and start answering back.

```sh
just lab      # the playground — every widget, live, with generated controls
just test     # vitest --watch, if you hand-wrote numerics
```

Write the component at `src/components/<tag>.ts`. **The filename is the tag
name** — `basis-rotation.ts` defines `<basis-rotation>`. Both the lab and
`loader.ts` rely on that.

The lab discovers it automatically and builds a control for every reactive
property. Give it bounds:

```ts
static lab: LabSpec = {
  about: "One line on what this widget is for.",
  fallback: { src: "/my-figure.svg", alt: "…" },
  controls: { theta: { min: -90, max: 90, step: 1 } },
}
```

Then register the tag in `src/loader.ts` so the site lazy-loads it, and embed it
with its static fallback as a child:

```html
<basis-rotation vx="1.0" vy="1.6" theta="30">
  <img src="../attachments/figs/basis-rotation-30.svg" alt="…" />
</basis-rotation>
```

The fallback is not optional. It is what Obsidian's reading view shows, what a
no-JS reader gets, and what paints before the widget hydrates.

**On porting numerics:** parity-test what you write by hand, against a
`just fixtures` numpy fixture. If you called a library instead, a round-trip
test and one known-good value is enough. Reach for a library when it deletes
code you would otherwise have to verify.

---

## 4. Publish

```sh
just publish     # check → build → deploy
```

`just serve` first if you want to see it exactly as deployed.

---

## Every command

| | |
|---|---|
| `just lab` | the widget playground |
| `just test` | vitest --watch |
| `just check` | typecheck + tests. No Python needed |
| `just figures` | notebooks → committed SVGs |
| `just fixtures` | notebooks → numpy parity fixtures |
| `just notebooks` | build the WASM exports locally (CI does this on push) |
| `just serve` | build and serve as deployed |
| `just publish` | check, build, deploy |

## Where things live

| | |
|---|---|
| `vault/` | the Obsidian vault and Quartz's content root |
| `notebooks/` | marimo — prototyping, figures, and the live WASM notebooks |
| `scripts/` | the three exporters: figures, fixtures, WASM notebooks |
| `packages/explorables/` | widgets: `src/dsp/` numerics, `src/components/` Lit elements |
| `sites/quartz/` | Quartz 5. Your changes are `quartz.config.yaml` and `plugins/` |

`CLAUDE.md` is the guardrails — what you may and may not do.
`PLAN.md` is why the architecture is the way it is.

## Gotchas that have bitten before

- **Never `.gitignore` anything under `vault/` or `quartz/static/`.** Quartz
  globs both with `gitignore: true`, so an ignored file is silently dropped from
  the build — locally and on Cloudflare alike. Generated-but-published assets
  are committed on purpose.
- **Check what a Quartz plugin fetches before enabling it.** The graph view
  pulled 2.6 MB of pixi.js and d3 from a CDN on every page.
- **Measure Lighthouse; don't assume.** Two of the three worst regressions so
  far came from Quartz defaults, not from our code.
