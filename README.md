# oishefarhan.com

Explorable explanations for signals, systems, and the linear algebra underneath them.

**Prototype in Python. Ship JavaScript. Never make the reader's phone run Python.**

The interactive figures here are framework-free Web Components — a slider moves and a
closed-form function is re-evaluated in a few hundred lines of JavaScript. There is no
Python runtime in the browser, no matplotlib PNG round-trip, and no base64 in the HTML.
Most content is rendered at build time and ships as SVG.

## How it fits together

| | |
|---|---|
| `vault/` | Obsidian vault, and Quartz's content root. Open this in Obsidian. |
| `notebooks/` | marimo notebooks — prototyping and numeric reference implementations |
| `scripts/export_fixtures.py` | dumps numpy/scipy output that the TypeScript port is tested against |
| `packages/explorables/` | the widget package: pure numerics in `src/dsp/`, Lit elements in `src/components/` |
| `sites/quartz/` | Quartz 5 |

Every function ported out of a notebook gets a parity test against a numpy fixture
*before* it gets a widget. `just fixture-drift` fails if the Python reference moves
without someone saying why.

## Getting started

Requires Node ≥ 22, [`just`](https://github.com/casey/just), and [`uv`](https://docs.astral.sh/uv/).

```sh
npm install                          # root: wrangler only
npm --prefix packages/explorables ci
npm --prefix sites/quartz ci

just --list                          # every recipe
just test                            # vitest --watch  — the numerics loop
just lab                             # vite dev server — the visuals loop
just serve                           # build and serve the site as deployed
just check                           # typecheck + tests + fixture drift
```

Deployed to Cloudflare Workers static assets with `just deploy`.

`PLAN.md` is the design document — the argument for this architecture, and a log of
where the build deviated from it. `CLAUDE.md` is the working guardrails.

## Credits

Built on [Quartz](https://github.com/jackyzha0/quartz) by Jacky Zhao.
Content follows *Data-Driven Science and Engineering* by Brunton & Kutz.
