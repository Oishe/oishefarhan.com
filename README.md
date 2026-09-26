# oishefarhan.com

Source for **[oishefarhan.com](https://oishefarhan.com)**: portfolio and technical writing on data
and ML platform engineering, with interactive articles on signals and linear algebra.

The site is an [Obsidian](https://obsidian.md) vault rendered by [Quarto](https://quarto.org). You
write in Obsidian, Quarto renders the vault in place, and a Cloudflare Worker serves the static
output. Figures are interactive in the browser through
[Observable JS](https://quarto.org/docs/interactive/ojs/), so nothing runs server-side.

| | |
|---|---|
| Writing | Obsidian, Markdown and Quarto Markdown |
| Rendering | Quarto website; Bootstrap theme generated from design tokens |
| Figures | Observable JS and Observable Plot; Python and matplotlib for static ones |
| Build checks | TypeScript on Node (`--experimental-strip-types`), no bundler |
| Hosting | Cloudflare Workers static assets, deployed from GitHub Actions |

## Quick start

Needs Node 22+ (see `.node-version`), [uv](https://docs.astral.sh/uv/), and the
[Quarto CLI](https://quarto.org/docs/get-started/).

```bash
npm install
(cd vault && uv sync)
npm run build                              # -> generated/site
npm run serve                              # http://localhost:8080
npm run preview articles/some-article.qmd  # live-reload one page while writing
```

## How publishing works

Publishing is opt-in: a page reaches the site only with `publish: true` in its frontmatter. Before
rendering, `scripts/prepare-publication.ts` reads the vault, writes the list of pages Quarto may
render, and **fails the build** rather than let an unpublished note leak. It catches:

- a published page linking to an unpublished one, or to nothing
- a section listing that would pick up drafts
- Obsidian-only syntax (`%%comments%%`, `[[wikilinks]]`, `> [!callouts]`) that would render as text
- rendered pages or frozen notebook output with no published document behind them

Anything under a `*_hidden/` folder, or named `*.hidden.md` / `*.hidden.qmd`, is private: it is
git-ignored and never rendered.

## Layout

```text
vault/                 source of truth: pages, data, theme
  _quarto.yml          site config
  _theme/              tokens.yaml, the stylesheets generated from it, the OJS preamble
  articles/            one file per article, with its data/ beside it
  examples/            unpublished feature reference pages
scripts/               publication checks, design-token generator, site validator
generated/site/        the built site (git-ignored)
```

## Commands

```bash
npm run build          # token check -> publication prep -> quarto render -> verify
npm run validate       # build, then scripts/validate-site.sh over the output (what CI runs)
npm test               # unit tests for the build scripts
npm run design-tokens  # regenerate the theme after editing vault/_theme/tokens.yaml
```

Pushing to `main` builds and deploys through `.github/workflows/deploy-site.yml`. To deploy by
hand: `npm run build && npx wrangler deploy`.

## Docs

- [AUTHORING.md](./AUTHORING.md): the writing reference covering frontmatter, syntax, figures and
  known problems.
- [vault/.obsidian/PLUGINS.md](./vault/.obsidian/PLUGINS.md): the Obsidian setup.

Until tag `quartz-final` the site rendered through a vendored Quartz v5 bridged to Quarto. The
decision record for dropping it is `REDESIGN.md` in the history (`git log -- REDESIGN.md`).
