# Knowledge Publishing System

This repository is implementing the architecture in [Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md](./Obsidian-Quarto-Quartz-v5-Knowledge-Publishing-System.md).

Current work is the Quartz v5 spike:

```text
generated/quartz-content/   disposable public test content
site/                       pinned Quartz v5 source and configuration
site/content                symlink to the staged content tree
```

Build the spike with:

```bash
cd site
npm install
node quartz/bootstrap-cli.mjs build
```

The generated site is written to `site/public/` and is ignored by Git.

## Current validation commands

```bash
./scripts/validate-qmd-obsidian-spike.sh
./scripts/validate-qmd-obsidian-render.sh
./scripts/validate-frozen-prose-render.sh
node --experimental-strip-types --test scripts/generate-qmd-stub.test.ts
./scripts/validate-qmd-stub.sh
./scripts/validate-qmd-stub-suppression.sh
./scripts/validate-quarto-emitter.sh
./scripts/validate-interactive-components.sh
```

Render the authoritative Quarto documents before building the site:

```bash
cd vault && uv run quarto render && cd ..
for f in monte-carlo convergence-diagnostics interactive-ojs interactive-widgets; do
  node --experimental-strip-types scripts/generate-qmd-stub.ts \
    "vault/research/$f.qmd" "generated/quartz-content/research/$f.md"
done
cd site && node quartz/bootstrap-cli.mjs build
```

Stub generation is still manual; Phase 9 (`prepare-publication.ts`) replaces this loop.
