# Knowledge Publishing System

An Obsidian vault published as a Quarto website. [AUTHORING.md](./AUTHORING.md) is the day-to-day
writing reference: frontmatter, `.md` vs `.qmd`, links, and the build commands.
[REDESIGN.md](./REDESIGN.md) records why the system is shaped this way.

```text
vault/                      source of truth: notes, Quarto documents, attachments
  _theme/                   tokens.yaml, the stylesheets generated from it, and site-custom.scss
  _hidden/                  private; never rendered, never published
generated/                  disposable derivatives (git-ignored)
  site/                     the built site
  fixture-site/             the validation build
  link-map.json             title/alias/slug/path -> canonical URL
scripts/                    publication prep, design tokens, validation
```

Nothing under `generated/` is edited by hand or committed.

Quarto renders every page, prose and computational alike. There is no staging step: it reads the
vault in place, which is why a link that works while drafting works on the site.

## Build

```bash
npm install
npm run build
npm run serve      # then http://localhost:8080
```

`npm run build` is four steps:

```text
design-tokens --check    are the generated theme files current?
prepare-publication      validate the vault, write the render allowlist, clear generated/site
quarto render            render the allowlist
prepare-publication      re-verify with --require-quarto
```

Individual stages: `npm run design-tokens`, `npm run prepare-publication`, `npm run render`.
To draft one document with live reload: `npm run preview articles/one-note.qmd`.

## Publishing a note

Publication is opt-in. A note reaches the site only with `publish: true` in its frontmatter, and an
attachment only when published content references it. The build fails rather than leaking:

- a link from a published note to an unpublished one
- an unpublished draft inside a folder that has a `listing:` — Quarto listings glob the filesystem,
  not the render allowlist
- a rendered page with no published document behind it
- frozen output belonging to a document that is not published
- Obsidian-only syntax (`%%…%%`, `> [!note]`, `==highlight==`, wikilinks) that would publish
  verbatim

## Deploy

The site is an assets-only Cloudflare Worker: no server, every page a file on disk.

```bash
npm run build
npx wrangler deploy
```

Pushing to `main` does the same through `.github/workflows/deploy-site.yml`. `wrangler.jsonc`
serves `generated/site`, which is the `output-dir` set in `vault/_quarto.yml` — change one and you
change the other. Misses are served `vault/404.md`; Quarto writes that page's URLs site-absolute
because of its name, so keep the name.

## Validation

```bash
npm test          # 52 unit tests
npm run validate  # build the fixtures, then run the three validators
```

`npm run validate` is the one that matters in CI: it builds `vault/examples/` — the fixtures that
exercise Python, Jupyter widgets, Observable and Plotly — and then checks the built HTML.
`npm run build` alone does not, because fixtures never reach the production site.

## History

The site previously rendered `.md` through a vendored Quartz v5 and `.qmd` through Quarto, with a
bridge hosting Quarto body fragments inside Quartz pages. Tag `quartz-final` is the last commit with
that arrangement; `git checkout quartz-final -- site/` restores it.
`Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md` is the original architecture note for
that design and is kept as history — it does not describe the current system.
