# oishefarhan.com

Explorable explanations for signals, systems, and the linear algebra underneath them.

**Prototype in Python. Ship JavaScript. Never make the reader's phone run Python.**

The interactive figures are framework-free Web Components: a slider moves and a
closed-form function is re-evaluated in a few hundred lines of TypeScript. No Python
runtime in the browser, no matplotlib PNG round-trip, no base64 in the HTML. Most
content renders at build time and ships as SVG.

The Python is published too — as [live WASM notebooks](https://notebooks.oishefarhan.com)
on their own origin, one click from a post, so a reader who just wants to read never
waits for an interpreter.

## Getting started

Requires Node ≥ 22, [`just`](https://github.com/casey/just), and [`uv`](https://docs.astral.sh/uv/).

```sh
npm install                          # root: wrangler only
npm --prefix packages/explorables ci
npm --prefix sites/quartz ci

just --list
```

## The docs

| | |
|---|---|
| **[WORKFLOW.md](WORKFLOW.md)** | **how to publish** — start here |
| [SETUP.md](SETUP.md) | one-time Cloudflare and GitHub setup |
| [CLAUDE.md](CLAUDE.md) | the guardrails: what you may and may not do |
| [PLAN.md](PLAN.md) | why the architecture is the way it is, and what it measured |

## Credits

Built on [Quartz](https://github.com/jackyzha0/quartz) by Jacky Zhao.
Content follows *Data-Driven Science and Engineering* by Brunton & Kutz.
