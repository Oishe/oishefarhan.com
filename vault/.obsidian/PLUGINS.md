# Obsidian setup for this vault

Plugin and theme *code* is gitignored; the settings that describe the setup are tracked —
`app.json`, `appearance.json`, `community-plugins.json`, `core-plugins.json`, `hotkeys.json`,
`.vimrc`, `snippets/`, the core-plugin settings (`bookmarks.json`, `graph.json`, `backlink.json`,
`switcher.json`, `templates.json`, `note-composer.json`), and each community plugin's `data.json`
and `manifest.json`. On a fresh clone, install the plugins below from Settings → Community plugins,
then restart Obsidian; the tracked `data.json` files are picked up as-is.

Expect "failed to load plugin" notices on that first launch, before the install: the tracked
`manifest.json` files describe plugins whose code is not there yet. Installing overwrites them.

| Plugin | Why it is here |
|---|---|
| qmd as md | Makes Obsidian treat `.qmd` as Markdown, so those files open, edit, and link like notes. Not vendored — reinstall from the community store, or from https://github.com/danieltomasz/qmd-as-md-obsidian |
| Vimrc Support | Loads `.obsidian/.vimrc` |
| Code Editor Shortcuts | Required by `.vimrc`: the `o`/`O` remaps call `insertLineBelow`/`insertLineAbove` |
| Outliner | List manipulation, Alt-hjkl |
| Linter | Whitespace-only rules on save. Deliberately touches no YAML, so `publish:` is safe |
| Footnote Shortcut | Footnote insertion for long-form writing |
| Paste URL into selection | Paste a URL onto selected text to make a link |
| Templater | `templates/` scaffolds the frontmatter block that gates publication |
| Homepage | Opens `index.md` on start |
| Omnisearch | Full-text search over prose, and the only search here that indexes `.qmd` |
| Tag Wrangler | Safe tag renaming — tags reach the published site |
| Quiet Outline | Outline pane for long documents |
| Custom File Explorer sorting | File explorer order, driven by `vault/sortspec.md` |
| Data Files Editor | Opens `.yaml`/`.json` in place, so `_theme/tokens.yaml` is editable without leaving Obsidian. File *creation* is off, deliberately |
| Style Settings | Theme configuration UI for Catppuccin |
| Hider | Hides UI chrome |
| Git | Manual staging and diff UI. See the caution below |
| Advanced Tables | Table formatting and navigation |
| Latex Suite | Math snippets; the site renders them via KaTeX |
| Open in Terminal | Terminal at the vault or repo root |

No version column: each plugin's `manifest.json` is tracked, so the `id`, the store name, and the
version come from the plugin itself and move when it does. A hand-maintained column would only
drift. Names above are the manifest names, so they match what you search for in the store.

Theme: **Catppuccin**, named in `appearance.json` but not vendored — install it from
Settings → Appearance. Its flavour and options are unset; configure them through Style Settings.
`appearance.json` also pins **Fira Code** and **JetBrainsMono Nerd Font** and enables both files in
`snippets/`. Install those two fonts or the UI silently falls back to defaults.

Authoring rules that depend on this setup — the `.md`/`.qmd` syntax differences, the `.qmd` search
caveat, the templates, the publication-state bookmarks — live in `AUTHORING.md`.

## Rendering `.qmd`

`qmd as md` never spawns Quarto: its `quartoPath` is empty and `previewInObsidian` is false. The
plugin is here for editing and linking only. Render from a terminal instead, which also sidesteps a
Dock-launched Obsidian inheriting launchd's environment rather than a login shell's:

```bash
cd vault && uv run quarto render examples/note.qmd
```

An explicit file argument bypasses the project render list, so this needs no profile; output lands
in `generated/quarto/`. `quarto preview <file>` does *not* bypass that list and fails with "No
output created", so live reload goes through the preview profile instead:

```bash
npm run preview examples/note.qmd
```

See "Drafting one `.qmd` on its own" in `AUTHORING.md`.

## Obsidian Git caution

`basePath` is `./..`, so the plugin operates on the whole repository, not just `vault/`. All
auto-intervals are 0 and `autoCommitOnlyStaged` is true: nothing is committed unless you stage it
first, so a commit made from Obsidian will not sweep up unrelated changes in `site/` or `scripts/`.
