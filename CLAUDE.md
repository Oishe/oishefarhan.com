# Working in this repo

## Commits

Do not add a `Claude-Session:` trailer to commit messages. `Co-Authored-By:` is
fine. This is deliberate and applies to every commit without exception — the
session URLs are noise in a public history and resolve to nothing for anyone
reading it.

## Shape of the thing

`vault/` is the source of truth and Quarto renders it in place; there is no
staging step. `generated/` is disposable and git-ignored — never edit or commit
anything under it. README.md has the build, AUTHORING.md the writing reference,
REDESIGN.md why the system is shaped this way.

## Privacy boundary

Anything matching `*_hidden/` or `*.hidden.md` / `*.hidden.qmd` is local-only:
git-ignored, never rendered, never published. It is real content that exists on
disk and in no remote, so do not "clean up" a `_hidden` path on the grounds that
git does not track it.

Publication is opt-in — `publish: true` in frontmatter — and the build fails
rather than leaking. Do not work around a publication gate to make a build pass;
the gate is the feature.

## Deploying

`npm run build` then `npx wrangler deploy`, or push to `main` and let
`.github/workflows/deploy-site.yml` do it. `wrangler.jsonc` serves
`generated/site`, which is Quarto's `output-dir` set in `vault/_quarto.yml` —
those two paths move together.
