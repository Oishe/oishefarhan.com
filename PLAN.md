# Explorable Explanations: marimo → TypeScript → Obsidian vault

A build plan for a technical blog that publishes from an Obsidian vault via Quartz,
prototypes numerics in marimo, and ships interactive widgets as small, framework-free
Web Components.

**Audience:** Claude Code, working in this repo.
**Status:** Phase 0 complete (2026-08-20). Phase 1 is next.
See §12 for where the build deviated from this document.

---

## 1. The thesis

Prototype in Python. Ship JavaScript. Never make the reader's phone run Python.

The existing marimo site (`Oishe/data-driven-science-and-engineering`) proved the
explanations work but exposed two separate costs, which are easy to conflate:

| Cost | Cause | Fixed by |
|---|---|---|
| Multi-MB boot before anything renders | Pyodide + numpy + scipy compiled to WASM | Not shipping a Python runtime |
| Slider lag *after* boot | Every interaction round-trips Python → matplotlib → PNG encode → base64 → DOM replacement | Not using a print-figure renderer as a web renderer |

Measured from saved DOM snapshots (these **exclude** the WASM runtime, which the snapshot
did not capture — real transfer is worse):

- `01_signal_is_a_vector`: 1.38 MB total; 0.95 MB HTML of which ~0.7 MB is ten base64 PNGs.
- `03_compression_simple_app`: 14.74 MB total; **14.31 MB of HTML, ~14 MB of it four base64 PNGs at 3.2–3.9 MB each.**

The second cost is the interesting one. It would persist under Quarto+Shiny, under
JupyterLite, under any architecture that keeps Python in the interaction loop. The fix is
architectural, not a matter of picking a lighter runtime.

### Three tiers, and where work belongs

- **Tier 0 — build time (your machine).** Math typesetting, circuit schematics, block
  diagrams, static plots, pre-rendered animations, precomputed datasets. Output: SVG, MP4,
  JSON. Reader ships zero JS. *Most content lives here.*
- **Tier 1 — small client JS.** A slider re-evaluating a closed-form function; a canvas
  transforming an image the reader supplied. Budget: tens of KB.
- **Tier 2 — a language runtime in the browser.** Only when the *reader* must execute
  arbitrary code they typed. **We never do this.**

### Decisions already settled (do not relitigate)

- **Quartz 5, not Astro.** The wiki layer — wikilinks, backlinks, graph view, Obsidian
  compatibility — is the point. Astro's islands buy little when every widget is a
  self-contained custom element.
- **Not Quarto.** Its `{ojs}` cells are JavaScript anyway, so it doesn't let us keep Python
  in the interactive path; and it costs the entire vault. BibTeX and cross-references are
  not currently a pain point. Revisit only if they become one.
- **marimo stays** as the prototyping, derivation, and reference-implementation
  environment. We change what it *exports*, not that we use it.

---

## 2. Repository layout

```
ece-blog/
├── vault/                        # Obsidian vault. Content only. Open THIS in Obsidian.
│   ├── posts/                    # .md — kebab-case filenames, no spaces
│   ├── figures/                  # figure SOURCES: .typ, .d2, .tex (circuitikz), .py (manim)
│   └── attachments/
│       ├── figs/                 # GENERATED .svg / .mp4 — committed
│       └── data/                 # GENERATED .json — committed
├── notebooks/                    # marimo .py — prototyping + numeric reference impls
├── scripts/
│   └── export_fixtures.py        # numpy/scipy → test/fixtures/*.json
├── packages/explorables/         # the TypeScript widget package
│   ├── src/
│   │   ├── dsp/                  # pure numerics. NO DOM imports in this directory.
│   │   ├── components/           # Lit custom elements, one file per widget
│   │   └── loader.ts             # lazy registry, the only global script
│   ├── lab/                      # Vite dev pages — the marimo replacement
│   └── test/
│       ├── fixtures/             # JSON emitted by export_fixtures.py
│       └── *.test.ts
├── sites/quartz/                 # Quartz 5; content dir points at ../../vault/posts
├── justfile
└── CLAUDE.md                     # extract §9 guardrails here
```

**Why one repo:** git submodules are a tax for a solo project. Cloudflare Pages can build
from a subdirectory via its "root directory" setting, so one push rebuilds the site.

**Why `dsp/` has no DOM imports:** it must run unmodified in Vitest (node environment) so
the numpy-parity tests are fast and headless. Enforce with an ESLint boundary rule or a
grep in CI.

---

## 3. Should we use TypeScript?

**Yes.** Not for ideology — for four concrete reasons in this specific codebase:

1. **Typed arrays are where ported DSP silently breaks.** `Float64Array` vs `number[]` vs
   `Uint8ClampedArray` mixups produce plausible-looking wrong output rather than a crash.
   TS catches these at the boundary.
2. **Custom element attributes are stringly-typed.** `getAttribute()` returns
   `string | null`, always. TS forces the parse/validate step you'd otherwise skip.
3. **Quartz is already TypeScript.** Its plugin API is typed (`QuartzTransformerPluginInstance`),
   so a custom transformer drops in with no impedance mismatch.
4. **Six-month recall.** Autocomplete on your own DCT library is worth more than the setup cost.

Cost is near zero: Vite transpiles TS with no config, `tsc --noEmit` type-checks in CI.

**Style:** `strict: true`. Keep types shallow — no branded types, no conditional-type
gymnastics. Two aliases carry most of the weight:

```ts
export type Signal = Float64Array;
export type Complex = { re: Float64Array; im: Float64Array };
```

**Always `Float64Array`, never `number[]`,** in `dsp/`. It matches numpy semantics, avoids
boxing, and is measurably faster in hot loops.

---

## 4. Stack

### Core

| Package | Size (gz) | Role | Rationale |
|---|---|---|---|
| `lit` | ~6 KB | Web Components | Reactive properties + templates + attribute reflection, without a framework. Standard custom elements out the other end, so this survives an SSG change. |
| `vite` | dev only | Dev server + bundler | HMR is the marimo replacement (§6). Library mode for the production bundle. |
| `vitest` | dev only | Tests | Shares Vite config. Watch mode against numpy fixtures. |
| `typescript` | dev only | Types | `tsc --noEmit` in CI |
| `katex` | ~25 KB + fonts | Math | Same engine as Obsidian and as build-time `rehype-katex`, so inline math, live-updating widget math, and vault preview all agree. |

### Numerics

| Package | Role | Notes |
|---|---|---|
| `fft.js` | Radix-4 complex FFT | Small and fast. DCT-II derives from it with pre/post-twiddle (~40 lines). |
| `ml-matrix` | SVD, eigendecomposition, QR, LU | **Matters for the roadmap.** Brunton & Kutz is SVD-heavy; this is the best-maintained JS linear algebra package. |
| `discrete-wavelets` | Haar + Daubechies DWT | *Verify db4 support before committing.* If absent, hand-roll db4 lifting steps — ~60 lines, coefficients are published. |
| `mathjs` | Expression parsing | **Only** if readers type formulas. ~150 KB gz — lazy-load it, never bundle it globally. |

### Plotting

| Package | Size (gz) | Use for |
|---|---|---|
| `uplot` | ~15 KB | Line/scatter/time-series. **Default choice.** |
| `d3-scale` + `d3-axis` | ~5 KB | Axis math for hand-drawn SVG. Micro-imports only — never `import * as d3`. |
| (none — raw canvas) | 0 | Images, heatmaps, spectrograms, coefficient maps. `ctx.putImageData()` directly. A charting library is the wrong tool here. |
| `@observablehq/plot` | ~90 KB | Only if you want faceting or layered marks quickly. Lazy-load. |

### Workers

| Package | Size (gz) | Role |
|---|---|---|
| `comlink` | ~2 KB | Ergonomic `postMessage`. **Required for the sparsity explorer** — a full-image FFT on the main thread will jank the slider. Transfer `Float64Array` buffers, don't copy. |

Consider `OffscreenCanvas` so the worker renders directly. Optional, and Safari support
should be checked before relying on it.

### Explicitly not used

React, Vue, Svelte, Astro, Tailwind, Plotly, full `d3`, Pyodide, any WASM Python.

**One escape hatch:** if a specific transform is genuinely too slow in JS after profiling,
a hand-written Rust→WASM module of ~20 KB is acceptable. That is categorically different
from shipping a general-purpose language runtime. Profile first; this should not be needed.

---

## 5. The Python → JavaScript bridge

This is what makes porting safe rather than nerve-wracking, and the repo already has
`tests/`, so the habit exists.

**Python side** (`scripts/export_fixtures.py`) — dumps inputs and known-good outputs from
the functions already written in `notebooks/`:

```python
import json, pathlib
import numpy as np
from scipy.fft import dct, idct, fft

OUT = pathlib.Path("packages/explorables/test/fixtures")
rng = np.random.default_rng(0)          # fixed seed — fixtures must be reproducible

def case(x, **outputs):
    return {"input": x.tolist(), **{k: v.tolist() for k, v in outputs.items()}}

fixtures = {}
for n in (16, 64, 256):
    x = rng.standard_normal(n)
    fixtures[f"dct_{n}"] = case(x, expect=dct(x, type=2, norm="ortho"))
    fixtures[f"fft_{n}"] = case(x, re=fft(x).real, im=fft(x).imag)

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "dsp.json").write_text(json.dumps(fixtures, indent=1))
```

**TypeScript side** (`test/dsp.test.ts`):

```ts
import { describe, expect, test } from "vitest";
import fixtures from "./fixtures/dsp.json";
import { dct2 } from "../src/dsp/dct.js";

const closeTo = (got: Float64Array, want: number[], tol = 1e-10) => {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) {
    expect(Math.abs(got[i] - want[i])).toBeLessThan(tol);
  }
};

describe("DCT-II matches scipy(norm='ortho')", () => {
  for (const n of [16, 64, 256]) {
    test(`n=${n}`, () => {
      const f = fixtures[`dct_${n}`];
      closeTo(dct2(Float64Array.from(f.input)), f.expect);
    });
  }
});
```

**Rules:**

- Every function ported out of a notebook gets a parity test *before* it gets a widget.
- Tolerance `1e-10` for orthonormal transforms; loosen only with a comment justifying it.
- Fixtures are committed. `just fixtures` regenerates them; a diff in CI means the Python
  reference changed and someone must say why.
- Round-trip tests too: `idct(dct(x)) ≈ x`. They catch normalization errors that
  one-directional tests miss.

---

## 6. The dev loop (the marimo replacement)

marimo gave: edit → instant re-render, sliders bound to variables, visible intermediates,
one file. The equivalent is **two watch processes**, and it is arguably better because
correctness is asserted rather than eyeballed.

**Loop A — numerics, in the terminal:**

```
just test        # vitest --watch
```

Save `dsp/dct.ts`, the parity tests re-run in ~50 ms, red or green. This is the part
marimo could not do at all.

**Loop B — visuals, in the browser:**

```
just lab         # vite dev server over packages/explorables/lab
```

One HTML page per widget under `lab/`:

```html
<!-- lab/basis-rotation.html -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">
<basis-rotation vx="1.0" vy="1.6" theta="34"></basis-rotation>
<script type="module" src="/src/components/basis-rotation.ts"></script>
```

Save the component, HMR swaps it in without a reload. Lit's reactive properties mean
slider state survives the swap — a tighter loop than marimo's cell re-execution, because
there is no kernel to round-trip through.

`lab/index.html` should list every widget page. It doubles as a manual QA sweep before a
release, and it is where you check mobile: open it on your phone against the LAN dev
server URL that Vite prints with `--host`.

---

## 7. What goes in the vault

### The embed contract

Every widget is a custom element with **a static fallback as its child**:

```markdown
Drag the slider to turn the red axes and watch the coordinates change — the vector itself
doesn't move, only the numbers we measure it with.

<basis-rotation vx="1.0" vy="1.6" theta="34">
  <img src="../attachments/figs/basis-rotation-34.svg"
       alt="A vector measured against a standard basis in blue and a basis rotated 34 degrees in red">
</basis-rotation>
```

The fallback child earns its place four times over:

1. **Obsidian reading view** renders it — raw HTML passes through, scripts don't run, so
   your vault preview shows a real figure instead of a blank gap.
2. **No-JS and RSS readers** get the figure.
3. **First paint** shows it before the component hydrates — no layout shift.
4. **`alt` text** is the accessibility story, and it's forced rather than optional.

Generate the fallback from the same marimo notebook at the default parameter value, so one
source produces both the static and interactive forms. Never let them drift.

### Worked example

`packages/explorables/src/components/basis-rotation.ts`:

```ts
import { LitElement, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import katex from "katex";

@customElement("basis-rotation")
export class BasisRotation extends LitElement {
  // Light DOM, not shadow DOM: KaTeX's global stylesheet and Quartz's typography
  // both need to reach inside. Scope your own CSS with a class prefix instead.
  protected createRenderRoot() { return this; }

  @property({ type: Number }) vx = 1.0;
  @property({ type: Number }) vy = 1.6;
  @property({ type: Number }) theta = 34;
  @state() private live = this.theta;

  private coords(deg: number) {
    const t = (deg * Math.PI) / 180;
    const c = Math.cos(t), s = Math.sin(t);
    // Bᵀv, with B the rotation whose columns are the new basis vectors
    return { x: c * this.vx + s * this.vy, y: -s * this.vx + c * this.vy, c, s };
  }

  render() {
    const { x, y, c, s } = this.coords(this.live);
    const S = 60, O = 150;                       // px per unit, origin
    const P = (a: number, b: number) => `${O + a * S},${O - b * S}`;

    return html`
      <figure class="br">
        <svg viewBox="0 0 300 300" role="img"
             aria-label="Vector at ${this.vx}, ${this.vy} against a basis rotated ${this.live.toFixed(0)} degrees">
          <line x1=${P(-2, 0).split(",")[0]} y1=${O} x2=${O + 2 * S} y2=${O}
                stroke="var(--br-std)" stroke-width="1.5"/>
          <line x1=${O} y1=${O + 2 * S} x2=${O} y2=${O - 2 * S}
                stroke="var(--br-std)" stroke-width="1.5"/>
          <line x1=${O} y1=${O} x2=${P(2 * c, 2 * s).split(",")[0]} y2=${P(2 * c, 2 * s).split(",")[1]}
                stroke="var(--br-rot)" stroke-width="1.5"/>
          <line x1=${O} y1=${O} x2=${P(-2 * s, 2 * c).split(",")[0]} y2=${P(-2 * s, 2 * c).split(",")[1]}
                stroke="var(--br-rot)" stroke-width="1.5"/>
          <line x1=${O} y1=${O} x2=${P(this.vx, this.vy).split(",")[0]} y2=${P(this.vx, this.vy).split(",")[1]}
                stroke="var(--br-vec)" stroke-width="3"/>
        </svg>

        <label class="br-control">
          rotate the basis θ (degrees)
          <input type="range" min="0" max="90" step="1" .value=${String(this.live)}
                 @input=${(e: Event) => { this.live = +(e.target as HTMLInputElement).value; }}>
          <output>${this.live.toFixed(0)}°</output>
        </label>

        <div class="br-math" .innerHTML=${katex.renderToString(
          String.raw`\begin{bmatrix}${c.toFixed(2)} & ${(-s).toFixed(2)} \\
                     ${s.toFixed(2)} & ${c.toFixed(2)}\end{bmatrix}
                     \begin{bmatrix}${x.toFixed(2)} \\ ${y.toFixed(2)}\end{bmatrix}
                     = \begin{bmatrix}${this.vx.toFixed(2)} \\ ${this.vy.toFixed(2)}\end{bmatrix}`,
          { throwOnError: false, displayMode: true }
        )}></div>
      </figure>
    `;
  }
}
```

The whole interaction is a 2×2 rotation. There was never any need for numpy here — which
is the general shape of the argument: *check whether the interactive part is actually
closed-form before reaching for a runtime.*

### The loader

One global script, ~1 KB. It imports nothing until a widget is actually on the page and
nearly in view:

```ts
// src/loader.ts
const REGISTRY: Record<string, () => Promise<unknown>> = {
  "basis-rotation":    () => import("./components/basis-rotation.js"),
  "fn-plot":           () => import("./components/fn-plot.js"),
  "sparsity-explorer": () => import("./components/sparsity-explorer.js"),
};

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      REGISTRY[e.target.tagName.toLowerCase()]?.();
    }
  },
  { rootMargin: "200px" }   // start fetching just before it scrolls into view
);

for (const tag of Object.keys(REGISTRY)) {
  document.querySelectorAll(tag).forEach((el) => io.observe(el));
}
```

This is Astro's island behaviour, in twenty lines, inside Quartz. A post with no widgets
pays 1 KB. A post with one widget pays 1 KB plus that widget's chunk.

Register it via a Quartz transformer plugin's `externalResources` hook:

```ts
// sites/quartz/quartz/plugins/transformers/explorables.ts
export const Explorables: QuartzTransformerPlugin = () => ({
  name: "Explorables",
  externalResources: () => ({
    js: [{ src: "/explorables/loader.js", loadTime: "afterDOMReady",
           moduleType: "module", contentType: "external" }],
  }),
});
```

---

## 8. Figure pipeline

`vault/figures/` holds sources; `vault/attachments/figs/` holds generated output, and
**the generated output is committed**. That decoupling is deliberate: neither Quartz nor
Cloudflare Pages ever needs LaTeX, Typst, or manim installed, site builds stay under a
minute, and Obsidian previews every figure natively because they're just images in the vault.

```make
attachments/figs/%.svg: figures/%.typ  ; typst compile $< $@
attachments/figs/%.svg: figures/%.d2   ; d2 $< $@
attachments/figs/%.svg: figures/%.tex  ; latexmk -pdf $< && pdf2svg $(@:.svg=.pdf) $@
attachments/figs/%.mp4: figures/%.py   ; manim -qh $< --format=mp4 -o $@
```

- **Circuit schematics:** CircuiTikZ. Nothing else is close for ECE. The TikZJax Obsidian
  plugin gives in-vault preview.
- **Block/system diagrams:** D2 (good auto-layout) or Typst + CeTZ if you'd rather stay in
  Typst. Both compile to SVG at build time — never ship a diagram renderer to the browser.
- **matplotlib:** `fig.savefig(out, format="svg", bbox_inches="tight")`. **Never PNG.**
  On post 01 this alone is ~0.7 MB → ~60 KB, and crisp on retina instead of soft.
- **manim:** MP4/H.264, never GIF (often 10× larger). Embed as
  `<video autoplay loop muted playsinline preload="none" poster="...">`. `playsinline` is
  mandatory or iOS Safari hijacks it fullscreen. Respect `prefers-reduced-motion` by
  dropping `autoplay` behind a media query.

---

## 9. Guardrails → copy into `CLAUDE.md`

**Never:**
- Ship Pyodide, marimo-WASM, JupyterLite, or any language runtime to the browser.
- Base64-encode an image into HTML or Markdown.
- Emit matplotlib PNGs. SVG only.
- Use `number[]` in `packages/explorables/src/dsp/`. `Float64Array`.
- Import DOM APIs inside `src/dsp/`.
- Add a widget without a static fallback child and an `alt` string.
- Introduce React, Vue, Svelte, Astro, Tailwind, Plotly, or full `d3`.
- Run a full-image transform on the main thread. Use a Worker.

**Always:**
- Parity test against a numpy/scipy fixture before building the widget.
- Light DOM (`createRenderRoot() { return this; }`) for Lit components.
- Lazy-load widget code through `loader.ts`. Nothing else global except KaTeX CSS.
- Kebab-case, space-free vault filenames, so wikilinks resolve identically everywhere.
- Native `<input type="range">` for sliders — keyboard accessibility comes free.
- rAF-throttle slider handlers; never recompute synchronously per `input` event.

**Budgets (enforce in CI with `size-limit`):**

| Asset | Budget (gzipped) |
|---|---|
| `loader.js` | ≤ 2 KB |
| Any single widget chunk | ≤ 50 KB |
| Total JS on any one post | ≤ 100 KB |
| Any figure SVG | ≤ 80 KB |
| Any manim clip | ≤ 2 MB |

---

## 10. Phases

Each phase ends with something demonstrable. Do not start the next until the acceptance
criterion is met.

### Phase 0 — Skeleton
Repo layout from §2. Quartz 5 building from `vault/posts`. `packages/explorables` with
Vite + Vitest + `strict` TS. `justfile` with `lab`, `test`, `fixtures`, `figures`, `site`.
Cloudflare Pages deploying `sites/quartz`.

**Done when:** a hello-world post with a wikilink and a `$$…$$` block renders on the
deployed URL and in Obsidian, and `just lab` serves an empty lab index.

### Phase 1 — Numeric core
Port from `notebooks/`: FFT, DCT-II/III, DWT (db4), `threshold_keep`, `energy_curve`,
`psnr`, `mse`. Fixture bridge from §5. Every function parity-tested.

**Done when:** `just test` is green, all transforms round-trip to 1e-10, and `src/dsp/`
imports nothing DOM-related.

### Phase 2 — First widget and first post
`basis-rotation` per §7. Port `01_signal_is_a_vector` prose to `vault/posts/`. Add the
marimo export target that emits SVG figures + the fallback SVG.

**Done when:** the post is live; total JS ≤ 30 KB gz; total page weight ≤ 200 KB;
Lighthouse mobile performance ≥ 95; and the post is legible in Obsidian reading view with
the fallback figure visible.

*This is the pilot. If it feels wrong, stop and reassess before Phase 3.*

### Phase 3 — The sparsity explorer
Standalone app page, linked from a post rather than inlined. `<input type="file">` →
`createImageBitmap` → `getImageData` → Worker (Comlink) → transform → threshold →
`putImageData`. No PNG encode anywhere in the pipeline.

**Done when:** slider holds 60 fps on a 1024×1024 image on a mid-range phone, total
payload ≤ 60 KB gz, and PSNR output matches the notebook to 1e-6.

*Expect this to be faster than the current desktop marimo version — you've deleted the
encode/base64/DOM-replace round trip entirely.*

### Phase 4 — Figure pipeline
Makefile from §8. One CircuiTikZ schematic, one D2 block diagram, one manim clip, each
committed as generated output and embedded in a real post.

**Done when:** a fresh clone can build the site with only Node installed.

### Phase 5 — Guardrails in CI
`tsc --noEmit`, `vitest run`, `size-limit`, fixture-drift check, and a link checker for
broken wikilinks.

**Done when:** CI fails on a deliberately over-budget widget.

---

## 11. Open questions to resolve early

1. **`discrete-wavelets` db4 support** — verify before Phase 1, or budget ~60 lines for
   hand-rolled lifting steps.
2. **`OffscreenCanvas` in Safari** — check before designing Phase 3's worker boundary
   around it; fall back to transferring `ImageData` buffers if unavailable.
3. **Quartz `externalResources` granularity** — if it turns out to be per-build rather than
   per-page, that's fine: `loader.js` is 1 KB and no-ops when no widget tags are present.
   Don't build a per-page mechanism unless measurement says it matters.
4. **KaTeX font loading** — subset the fonts. The full set is heavier than KaTeX itself.

---

## 12. Build log — deviations from the plan above

### Phase 0, 2026-08-20

**Quartz content root is `vault/`, not `vault/posts/`** (§2 said otherwise).
Quartz's asset emitter only copies non-Markdown files that live *inside* the
content root. With the root at `vault/posts/`, everything in `vault/attachments/`
would have been skipped and every figure would 404. Pointing it at `vault/` makes
the Obsidian vault root and the site root the same thing, which is also how
wikilinks already behave. Posts are served under `/posts/`; `vault/figures/`
(figure sources) is excluded via `ignorePatterns`.

**Quartz 5 restructured plugins**, so §7's custom-transformer sketch no longer
applies verbatim. v5 has no `quartz.config.ts`/`quartz.layout.ts`: configuration
is `quartz.config.yaml` and plugins are npm packages under `@quartz-community/*`.
The good news for §7 and open question 3 — local-path plugin sources (`./path`)
are supported and get symlinked in, so the Explorables transformer can live in
this repo as a normal local plugin. Its exact API needs checking against v5's
`QuartzTransformerPlugin` type when Phase 2 wires up `loader.js`.

**Quartz globs with `gitignore: true`.** Anything in `.gitignore` is silently
dropped from the build — locally and on Cloudflare alike. This bit once already:
the built widget bundle was ignored as "generated output" and simply never
appeared in `public/`. Generated-but-published assets are therefore committed,
which is what §8 already prescribed for figures; it now applies to widget
bundles too.

**Deploying to Cloudflare Workers static assets, not Pages** (§10 said Pages).
Same static output, same custom domain; Workers is Cloudflare's current
recommendation for new static projects. `wrangler.jsonc` declares an assets-only
Worker with no `main` script.

**Production sourcemaps are off.** The bundle is committed, and `.map` files are
pure diff noise.
