# Working in this repo

Personal site and portfolio, served at oishefarhan.com. An Obsidian vault (`vault/`) rendered in
place by Quarto into `generated/site/`, deployed as a Cloudflare Worker with static assets only.
README.md is the overview; AUTHORING.md is the writing reference and lists the known rendering
problems. Read AUTHORING.md before editing content.

## Commits

Do not add a `Claude-Session:` trailer to commit messages. `Co-Authored-By:` is
fine. This is deliberate and applies to every commit without exception — the
session URLs are noise in a public history and resolve to nothing for anyone
reading it.

## Commands

```bash
npm test                  # unit tests for scripts/ (fast, no Quarto)
npm run build             # tokens --check, prep, quarto render, prep --require-quarto
npm run validate          # build + scripts/validate-site.sh; this is what CI runs
npm run preview <file>    # path relative to vault/; always pass a file
npm run design-tokens     # regenerate theme files from vault/_theme/tokens.yaml
```

A change is done when `npm test` and `npm run validate` both pass. For anything visual or
interactive, also serve the build (`npx wrangler dev`, which uses the production routing and 404
handling) and load the page in a browser. OJS failures show only in the console; a blank figure
still builds green.

## Where things are

- `scripts/prepare-publication.ts` is the publication gate. It validates frontmatter, links,
  listings, aliases, Obsidian syntax and frozen output, then writes `vault/_quarto-publish.yml`, the
  render allowlist.
- `scripts/generate-design-tokens.ts` projects `vault/_theme/tokens.yaml` and
  `vault/_theme/palettes/*.yaml` into `_theme/site-{light,dark}.scss` and
  `_theme/knowledge_theme/{tokens.json,knowledge.mplstyle}`.
- `scripts/validate-site.sh` checks the built tree from the outside.
- `vault/_theme/_ojs-setup.qmd` is the shared OJS preamble (`figW`, `col`), included by articles.

**Generated, never hand-edited:** everything in `generated/`, `vault/_quarto-publish.yml`,
`_theme/site-{light,dark}.scss`, and `_theme/knowledge_theme/{tokens.json,knowledge.mplstyle}`.

## Rules that are not obvious from the code

- **Privacy boundary.** Anything matching `*_hidden/` or `*.hidden.md` / `*.hidden.qmd` is
  local-only: git-ignored, never rendered, never published. It is real content that exists on disk
  and in no remote, so never delete or "clean up" a `_hidden` path because git does not track it.
- **Publication is opt-in** (`publish: true`), and the build fails rather than leaking. Never work
  around a publication gate to make a build pass; the gate is the feature. If a gate blocks
  legitimate work, change the gate deliberately, with a test, and say so.
- **Never put a positive glob in `vault/_quarto.yml`'s `render:` list.** Profile render lists
  concatenate, so it would join the generated allowlist and publish drafts. The base list is
  negations-only on purpose; `_quarto-preview.yml` adds the positive glob for drafting only.
- **Every published `listing:` needs `include: { publish: true }`.** Listings glob the filesystem,
  not the render list. Prep enforces it.
- **`wrangler.jsonc` `assets.directory` and `vault/_quarto.yml` `output-dir`** both point at
  `generated/site`. They move together.
- **`vault/404.md` must keep its name.** Quarto writes site-absolute URLs only for a page named 404,
  which is what lets it be served at any missed path.
- **`vault/_freeze/` is committed** so CI never executes Python. Frozen output for an unpublished
  document fails the build.
- **Python deps:** `vault/pyproject.toml`. The `lab` dependency group (torch and friends) is used
  only by private scripts. CI sets `UV_NO_DEFAULT_GROUPS=1` to skip it. No published page executes
  Python today.

## Deploying

Push to `main`: `.github/workflows/deploy-site.yml` builds and runs `wrangler deploy`. By hand:
`npm run build && npx wrangler deploy`. `npx wrangler versions upload` uploads without promoting it
to production traffic. It prints no preview URL for this worker, so test locally with
`npx wrangler dev`.

## Traps for agents

- **POSIX `set -e` ignores `! cmd`.** In shell validators, write `if cmd; then fail; fi`, never a
  bare `! grep …`.
- **A Quarto project whose `render:` list is only negations renders nothing** and exits 0. Scratch
  projects need a positive glob.
- **Quarto copies any unrendered file that a page links to** into the output. When probing for
  leaks, make sure your test page doesn't link the draft itself.
- **The headless browser forces dark mode**, which inverts screenshots whatever the CSS says. Turn it
  off before capturing:
  `cdp.send('Emulation.setAutoDarkModeOverride', { enabled: false })`.
- **`cd` to a directory outside the repo resets the shell** and can swallow output. Use absolute
  paths for scratch work.
- **Running `quarto` directly:** use `uv run quarto …` from `vault/` (or set `QUARTO_PYTHON` to
  `vault/.venv/bin/python` for a scratch project) so cells run in the vault's environment.
