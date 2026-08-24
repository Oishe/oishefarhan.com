# Authoring and rebuilding

How to write in the vault and see the result. The architecture behind this is in
`Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md`; this file is the operating manual.

## The shape of it

```text
vault/          you edit here, and only here
generated/      derived, gitignored, never edited
site/public/    the built site
```

`vault/` is a normal Obsidian vault. Nothing in `generated/` or `site/public/` survives a rebuild,
so never fix a problem there — fix it in `vault/` and rebuild.

## Choosing `.md` or `.qmd`

| | `.md` | `.qmd` |
|---|---|---|
| Rendered by | Quartz | Quarto, then wrapped by Quartz |
| Executable code cells | no | yes |
| Obsidian editing | native | native (the `qmd as md` plugin) |

The rule is only about execution. Prose, wikilinks, callouts, and maths all work in both. Use
`.qmd` when a page computes something; use `.md` otherwise. A `.qmd` with no executable cell is
just a slower `.md`.

Executable cells in a `.md` are an error in Quarto, not a silent no-op.

## Frontmatter that matters

```yaml
---
title: Convergence Diagnostics       # falls back to the filename
description: One line.               # used for search and previews
aliases: [MC Diagnostics]            # extra URLs and wikilink targets
tags: [research/computation]
publish: true                        # WITHOUT THIS THE PAGE IS NOT PUBLISHED
---
```

`publish: true` is the website gate. Publication prep stages only what carries it, and a second
Quartz-side filter fails the build if anything unpublished reaches the content tree. Any path with
an `_private/` segment is excluded from Git, publication prep, and batch Quarto rendering.

A published page may not link to an unpublished one. That fails the build with the offending file
named — it is the privacy boundary doing its job, not a bug.

## The rebuild

```bash
npm run build          # the whole pipeline
```

That is four steps, and knowing them tells you which one broke:

```text
1  design-tokens --check    are the generated theme files current?
2  prepare-publication      stage vault -> generated/quartz-content, clear generated/quarto
3  quarto render            render the generated allowlist of published .qmd files
4  prepare-publication      re-check, now requiring a rendered artifact per published .qmd
5  quartz build             generated/quartz-content -> site/public
```

To build and serve the result:

```bash
npm run build-serve # the whole pipeline + serve
```

Faster loops while you work:

```bash
npm run site               # prose-only change to a .md — skips Quarto entirely
cd vault && uv run quarto render path/to/one-note.qmd   # one document, anywhere in the vault
```

After either, rerun `npm run site` before reloading the browser.

### Checking it did what you meant

```bash
npm test                                    # publication prep, stubs, design tokens
(cd site && npx tsx --test bridge/*.test.ts)  # the Quarto bridge
for f in scripts/validate-*.sh; do sh "$f" || echo "FAILED $f"; done
```

`scripts/validate-*.sh` run against the built site, so build first.

## Things that will bite you

**Freeze can serve you a stale page.** `execute: freeze: true` means Quarto reuses the frozen result
in `vault/_freeze/` instead of re-executing. It keys on the source file, so an ordinary edit
invalidates it — but a change that only affects the *environment* (a new package, an edited
`.mplstyle`, a changed token) does not. If a rendered page disagrees with the source you are looking
at, force it:

```bash
cd vault && uv run quarto render research/one-note.qmd
```

`vault/_freeze/` is committed on purpose, so CI need not execute anything. Commit the freeze churn
along with the source change that caused it.

**Observable JS cells share one namespace.** Every `{ojs}` cell in a document, plus every name
handed over by `ojs_define`, lives in the same scope. Defining a name twice is a runtime error that
appears only in the browser console — the build stays green. If an OJS chart renders blank, open the
console first.

**Quarto pages are a full page load.** Navigating into or out of a `.qmd`-backed page leaves the SPA
deliberately: Quarto's scripts initialise on document load and have no Quartz lifecycle hooks. A
visible reload there is correct behaviour.

**Attachments live under `vault/attachments/`.** Only attachments a published page references get
copied. An unreferenced image simply will not appear on the site.

**Wikilinks work everywhere, including inside `.qmd`.** They are resolved by title, alias, filename,
or path. An ambiguous target — two pages claiming the same title — fails the build rather than
guessing.

## Changing how it looks

Every colour, font, and chart value comes from **`vault/_theme/tokens.yaml`**. Edit that file, then:

```bash
npm run design-tokens
```

which rewrites the four generated files it feeds — the Quartz theme block, the Quarto stylesheet's
custom properties, and the two files the vault's Python environment reads. Never edit those four by
hand; `npm run build` checks them and fails on a stale one.

Two caveats worth carrying:

- **The `colors` block in `tokens.yaml` is currently inert.** The site loads `@quartz-themes/core`,
  whose CSS is injected unlayered and outranks the palette Quartz generates. The live values are
  `#ffffff` and `#1C1C1C`, recorded separately as `chart.grounds`. Changing `colors` will not change
  what you see; changing the theme plugin will. Resolving which one should own the palette is an
  open decision.
- **Figures are drawn once for both themes.** A matplotlib PNG cannot follow the light/dark toggle,
  so `chart.ink` and `chart.series` are picked to stay legible against both backgrounds. The
  generator refuses colours that fall below 3:1 on either. Live output — Plotly, Observable Plot —
  is rethemed in the browser and uses the theme's real colours.

Writing Quarto-specific CSS goes in `site/bridge/styles/quartoPage.scss`, scoped beneath
`.quarto-page`, using `var(--…)` only. A literal hex there fails validation.

For a Python figure, one hidden setup cell picks up the shared styling:

````markdown
```{python}
#| label: theme-setup
#| include: false
import knowledge_theme
knowledge_theme.apply()
```
````

In Observable, read the palette from the page instead of naming a colour:

````markdown
```{ojs}
seriesColor = (n) => getComputedStyle(document.documentElement)
  .getPropertyValue(`--qmd-chart-series-${n}`).trim()
```
````

## What is not built yet

- **Reproducibility (Phase 12).** `vault/uv.lock` pins the Python environment and `_freeze/` is
  committed, so today's documents already rebuild deterministically. The gap is that nothing
  *enforces* it — no CI, no check that the lockfile and the freeze agree.
- **Deployment (Phase 13).** Local only. `baseUrl` is `localhost:8080`.
- Two CDN references are unpinned (`katex@latest`, `@jupyter-widgets/html-manager@*`). Harmless
  locally, must be pinned before publishing.
