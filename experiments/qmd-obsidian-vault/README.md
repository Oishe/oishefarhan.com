# Experiment 1: QMD in Obsidian

This disposable vault tests authoring and link behaviour across `.md` and `.qmd` files.

## Prepared configuration

- Obsidian's **Detect all file extensions** setting is enabled through `showUnsupportedFiles`.
- Obsidian's **Automatically update internal links** setting is enabled.
- Wikilinks use the shortest-path format.
- The selected community plugin ID is `qmd-as-md-obsidian` (`qmd as md`).
- Quarto renders only `research/**/*.qmd` into `_site/`.

The plugin ID in `.obsidian/community-plugins.json` enables the plugin after it is installed; it does not download plugin code.

## Manual Obsidian checks

- [ ] Install and enable **qmd as md** in this vault.
- [ ] Open and edit both QMD files in Obsidian.
- [ ] Confirm `.md -> .md`, `.md -> .qmd`, `.qmd -> .md`, and `.qmd -> .qmd` navigation.
- [ ] Confirm backlinks for all four directions.
- [ ] Confirm QMD files appear in graph, search, and quick switcher.
- [ ] Rename `research/analysis.qmd` and confirm `note-a.md` and `comparison.qmd` update.
- [ ] Undo the rename so the fixture returns to its committed state.

## Quarto checks

Create the isolated Python/Jupyter environment with `uv`, then render:

```bash
cd experiments/qmd-obsidian-vault
UV_CACHE_DIR=/private/tmp/knowledge-uv-cache uv sync
UV_CACHE_DIR=/private/tmp/knowledge-uv-cache uv run quarto render
```

- [ ] Confirm only the two files under `research/` render.
- [ ] Confirm both Python cells execute.
- [ ] Confirm output is written beneath `_site/`.

The automated render currently confirms that plain Quarto preserves wikilinks as literal `[[...]]` text. That is expected until Experiment 6 adds the Quarto-side adapter.

Source-level validation can be run from the repository root:

```bash
./scripts/validate-qmd-obsidian-spike.sh
./scripts/validate-qmd-obsidian-render.sh
```
