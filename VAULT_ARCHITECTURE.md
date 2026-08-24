# Vault architecture

This vault is both a personal knowledge system and the source for a public digital garden. Build it
incrementally; this document describes conventions, not folders that must exist immediately.

## Visibility

| State | Convention | GitHub | Website |
|---|---|---:|---:|
| Private | Any path containing `_private/` | no | no |
| Unpublished | Normal path with `publish: false` | yes | no |
| Published | Normal path with `publish: true` | yes | yes |

Path is the privacy boundary; frontmatter is the publication switch. Private attachments and
private frozen output must also remain below an `_private/` path. A note may move through:

```text
_private/inbox -> section/_private -> section (publish: false) -> section (publish: true)
```

## Information architecture

Create sections only when content needs them. The intended public shape is:

```text
about/       identity, resume, and current focus
projects/    polished case studies and standalone work
experience/  professional practice and applied expertise
courses/     ordered curricula, lectures, and course labs
knowledge/   evergreen, topic-oriented reference notes
writing/     essays and longer-form synthesis
```

Folders express a note's primary identity. Wikilinks, backlinks, tags, and metadata express
cross-cutting relationships such as tools, skills, prerequisites, and audiences. Every substantial
folder should eventually have an `index.md` that explains where to start; the explorer is secondary
navigation, not the site's only guide.

Ordered material may use numbered files or an `order` property. Evergreen notes use stable,
descriptive names. Course labs stay with the course; work that becomes independently valuable gets a
project case-study page linking back to the course and underlying knowledge notes.

## Computation

`.md` and `.qmd` files may live together anywhere. Use `.qmd` only when a page needs executable or
interactive content.

The vault has one shared Quarto project and one modest, locked `uv` environment. Publication prep
generates `_quarto-publish.yml`, an exact render list of `publish: true` `.qmd` files. Consequently,
the website build is independent of folder location and never batch-renders `_private` or
`publish: false` documents. A private document can still be rendered explicitly while developing:

```bash
cd vault
uv run quarto preview path/to/_private/experiment.qmd
```

Give a substantial project its own environment or repository only when it develops incompatible or
heavy dependencies, deployable code, or an independent test/release lifecycle. Keep its public case
study in the vault.

## Public navigation

The homepage and section indexes should provide curated entry points for recruiting, technical, and
research readers. Projects demonstrate evidence; experience explains applied judgment; courses and
knowledge notes show depth. Searchable technology names should appear naturally in summaries and
project pages, not only in tags.
