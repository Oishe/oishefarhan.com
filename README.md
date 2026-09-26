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
- a `listing:` without `include: { publish: true }` — Quarto listings glob the filesystem, not the
  render allowlist, so an unfiltered one links drafts beside it
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
npm test          # unit tests
npm run validate  # build, then scripts/validate-site.sh over the output
```

`npm run validate` is what CI runs. It checks the built site from the outside: no private or raw
source in the tree, the Observable runtime present where cells are, no Plotly on a published page,
and the design tokens in both compiled theme bundles.

## History

The site previously rendered `.md` through a vendored Quartz v5 and `.qmd` through Quarto, with a
bridge hosting Quarto body fragments inside Quartz pages. Tag `quartz-final` is the last commit with
that arrangement; `git checkout quartz-final -- site/` restores it, and
`Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md` at that tag is the original architecture
note for that design.
