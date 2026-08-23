# Knowledge Publishing System

This repository is implementing the architecture in [Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md](./Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md).

Phases 9 and 10 are in place: the public site is fully derived from the vault, and the Quarto bridge
is packaged in `site/bridge/` rather than scattered through the vendored Quartz tree.

```text
vault/                      source of truth: notes, Quarto documents, attachments
generated/                  disposable derivatives (git-ignored)
  quartz-content/           staged public tree Quartz reads through site/content
  quarto/                   rendered Quarto HTML and dependencies
  link-map.json             title/alias/slug/path -> canonical URL
site/                       pinned Quartz v5 source and configuration
  bridge/                   the Quarto bridge: Page Type, body extraction, artifact emitter
scripts/                    publication prep, stub generation, validation
```

Nothing under `generated/` is edited by hand or committed. `scripts/prepare-publication.ts` rebuilds it.

## Build

```bash
npm install
npm run build
```

That runs the section 28 pipeline in order:

```text
prepare-publication      select publish:true sources, stage them, write the link map, validate
quarto render            render published .qmd into generated/quarto/
prepare-publication      re-verify with --require-quarto (stub slug == Quarto URL)
quartz build             emit site/public/
```

Individual stages are available as `npm run prepare-publication`, `npm run render`, and `npm run site`.
Prep clears `generated/quarto/` when it stages, because Quarto will not remove stale dependency
directories from an output tree outside its own project; re-run `npm run render` after it.

## Publishing a note

Publication is opt-in. A note reaches the site only with `publish: true` in its frontmatter, and an
attachment only when published content references it. The build fails rather than leaking: a link
from a published note to an unpublished one, a stale Quarto artifact for a private document, or
frozen output for a document that is not published all stop the pipeline.

## Validation

```bash
npm test                     # publication prep and stub generation
(cd site && npm test)        # Quartz and the Quarto bridge
./scripts/validate-publication-prep.sh
./scripts/validate-qmd-obsidian-spike.sh
./scripts/validate-qmd-obsidian-render.sh
./scripts/validate-frozen-prose-render.sh
./scripts/validate-qmd-stub.sh
./scripts/validate-qmd-stub-suppression.sh
./scripts/validate-quarto-emitter.sh
./scripts/validate-interactive-components.sh
```

The rendered-output validators read artifacts produced by `npm run build`, plus the two experiment
sites under `experiments/` (`uv run quarto render` in each).
