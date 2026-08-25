# Obsidian + Quarto + Quartz v5 Knowledge Publishing System

> **Status: architecture selected; implementation started with the Quartz v5 spike.**
>
> Quartz v5 is the default publishing and presentation layer. Astro is retained only as a fallback if the project later becomes substantially more application-like or Quartz creates a material constraint.
>
> As of **2026-08-23**, the public site is derived end to end from the vault: `scripts/prepare-publication.ts` stages it, Quarto renders the computational documents, and Quartz builds the result. Experiments 0-7 have all passed, including the browser pass and interactive client-side components (Observable JS and Jupyter Widgets). Phases 9 (publication prep), 10 (Quarto bridge), and 11 (shared visual language) are implemented; the bridge lives in `site/bridge/`, the vendored Quartz tree carries a single documented patch, and `vault/_theme/tokens.yaml` is the one place the visual language is decided. The next unbuilt piece is Phase 12, reproducibility.
>
> - **[DECIDED]** — a choice has been made and the design is written around it.
> - **[VERIFIED]** — behaviour has been checked against current Quartz v5 or Quarto documentation/source.
> - **[GATED]** — the choice still depends on a small experiment.

---

# 1. Project Overview

The goal is to create a durable personal knowledge and publishing system that combines:

- **Obsidian** for writing, knowledge management, linking, and LaTeX.
- **Quarto** for computational documents, executable code, visualizations, citations, and interactive HTML.
- **Neovim / VS Code** for code-heavy editing and debugging.
- **Quartz v5** for the public knowledge site: Obsidian-flavoured Markdown, navigation, backlinks, graph, search, page layouts, and static publishing.
- A thin **publication-prep / Quarto bridge** layer that connects `.qmd` documents to Quartz without rebuilding Quartz's knowledge-graph features.

The filesystem remains the source of truth.

```text
                         AUTHORING

                  ┌───────────────────┐
                  │   Obsidian Vault  │
                  │                   │
                  │  .md   .qmd       │
                  │  YAML  assets     │
                  └─────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
         Obsidian        Neovim         VS Code
         writing         coding          coding
         linking         LSP             debugging
         LaTeX           editing         execution
             │              │              │
             └──────────────┴──────────────┘
                            │
                            ▼
                       Source files
                            │
                  ┌─────────┴─────────┐
                  │                   │
                  ▼                   ▼
          Publication Prep          Quarto
                  │                   │
          public .md files       computation
          .qmd index stubs       frozen output
          safe attachments       rendered HTML
          link map                  assets
                  │                   │
                  └─────────┬─────────┘
                            ▼
                         Quartz v5
                            │
             ┌──────────────┼──────────────┐
             │              │              │
         wikilinks       backlinks       search
         graph           layouts         navigation
             │              │              │
             └──────────────┴──────────────┘
                            │
                            ▼
                       Static Website
```

The central design is now:

> **Quartz owns the knowledge-site representation. Quarto owns the computational rendering. A generated Markdown stub lets the same Quarto document participate in Quartz's graph, backlinks, and search.**

---

# 2. Core Design Principles

## 2.1 Filesystem as the Source of Truth

Primary content remains ordinary files:

```text
.md
.qmd
.yml
.yaml
.bib
.json
.csv
.png
.jpg
.svg
.pdf
```

Obsidian, Quarto, Quartz, Neovim, and VS Code operate on filesystem content rather than an application-specific database.

Generated indexes and HTML are derivatives, not authoritative content.

## 2.2 Separate Authoring, Computation, Indexing, and Rendering

The project has four distinct responsibilities:

1. **Authoring** — Obsidian / Neovim / VS Code.
2. **Computation** — Quarto and its execution engines.
3. **Knowledge indexing** — Quartz processing of Markdown plus generated Quarto stubs.
4. **Presentation** — Quartz pages and Quarto pages in one static output tree.

Ordinary Markdown should not need Quarto.

Quartz should not execute Python, R, or Julia.

Quarto should not need to recreate Quartz's graph or search implementation.

## 2.3 One Logical Content Model, Two Renderers

```text
.md source
   │
   └──────────────► Quartz ─────────────► Quartz HTML

.qmd source
   │
   ├──────────────► Quarto ─────────────► Quarto HTML
   │
   └─► generated .md stub ─► Quartz ───► graph/search/backlinks metadata
```

Both source types should participate in:

- links
- backlinks
- tags
- aliases
- navigation
- search
- graph relationships
- publishing rules

Only their final page renderer differs.

## 2.4 Prefer Adaptation Over Reimplementation

Quartz v5 already supplies the majority of the knowledge-site layer. The project should not rebuild these unless a demonstrated limitation requires it:

```text
link resolution
Obsidian-flavoured Markdown
backlinks
graph
full-text search
tag pages
folder pages
RSS / sitemap
page layouts
SPA navigation
```

The custom code should remain narrowly focused on the `.qmd` boundary.

---

# 3. Repository Structure  **[DECIDED]**

A recommended layout:

```text
knowledge/
│
├── vault/                         # source of truth / Obsidian vault
│   ├── notes/
│   │   ├── probability.md
│   │   └── statistics.md
│   │
│   ├── research/
│   │   ├── monte-carlo.qmd
│   │   └── bayesian-model.qmd
│   │
│   ├── projects/
│   │   └── ...
│   │
│   ├── attachments/
│   ├── templates/
│   ├── references.bib
│   ├── _quarto.yml
│   ├── _freeze/
│   └── .obsidian/
│
├── site/                          # Quartz v5 project
│   ├── quartz.config.yaml
│   ├── quartz.lock.json
│   ├── quartz.ts                  # advanced overrides / bridge wiring
│   ├── bridge/                    # the Quarto bridge, outside the vendored tree
│   ├── package.json
│   └── content -> ../generated/quartz-content   # symlink or equivalent
│
├── generated/                     # disposable publishing intermediates
│   ├── quartz-content/
│   │   ├── notes/                 # public .md copies
│   │   ├── research/              # generated .md stubs for public .qmd
│   │   └── attachments/           # only public/referenced assets
│   │
│   ├── quarto/                    # rendered Quarto HTML + dependencies
│   └── link-map.json              # source title/alias/path -> canonical URL
│
├── scripts/
│   ├── prepare-publication.ts
│   ├── generate-qmd-stub.ts
│   └── validate-content.ts
│
└── README.md
```

The important separation is:

```text
vault/              private source tree
site/               Quartz application/configuration
generated/          safe public staging + generated Quarto artifacts
scripts/            narrow bridge/validation logic
```

## 3.1 Do Not Point Quartz at the Raw Vault

This is now a hard architectural rule.

Quartz's Markdown filters such as `ExplicitPublish` operate on Markdown content, while non-Markdown assets can still be emitted. A raw vault will eventually contain files that were never intended for publication.

Therefore:

```text
raw vault
   │
   ▼
publication-prep allowlist
   │
   ▼
generated/quartz-content
   │
   ▼
Quartz
```

Quartz sees only a **public staging tree**, never the full vault.

`ExplicitPublish` remains enabled as defense in depth, but it is not the primary privacy boundary.

## 3.2 Publication Prep Generates the Quarto Render Allowlist

Computational documents may live beside ordinary notes anywhere in the vault. Publication prep
generates `_quarto-publish.yml` from the exact set of `publish: true` `.qmd` files, and the build
activates that profile. The base configuration contains only the private-path exclusion:

```yaml
project:
  type: default
  render:
    - "!**/*_hidden/**"
    - "!**/*.hidden.md"
    - "!**/*.hidden.qmd"
```

This avoids coupling computation to folder taxonomy and prevents batch rendering of both private and
public-source drafts. Individual private experiments remain explicitly renderable during authoring.

## 3.3 Obsidian Workspace Churn

Git-ignore volatile workspace state while retaining useful Obsidian configuration:

```text
vault/.obsidian/workspace.json
vault/.obsidian/workspace-mobile.json
vault/.obsidian/cache
```

---

# 4. Obsidian's Role

Obsidian is primarily the authoring and knowledge-management interface for:

- Markdown writing
- LaTeX and mathematical notation
- notes and research writing
- conceptual organization
- wikilinks
- backlinks for native `.md`
- tags and aliases
- attachments
- browsing and discovery

Obsidian is **not** the production website renderer.

It also does not need to be the authoritative graph implementation for `.qmd`; Quartz will provide the published graph across both file types.

---

# 5. Quarto Files Inside Obsidian  **[DECIDED]**

Quarto `.qmd` files remain directly inside the vault.

Example:

```text
vault/research/monte-carlo.qmd
```

The same file can be opened with:

```text
Obsidian
Neovim
VS Code
Quarto CLI
```

There is no separate authoring copy.

This preserves the desired workflow:

```text
writing / math / links     -> Obsidian
code / LSP / debugging     -> Neovim or VS Code
computation / publication  -> Quarto
```

The known limitation is that Obsidian does not consistently treat `.qmd` as first-class Markdown across its own metadata/indexing subsystems. Plugins can improve editing and previewing, but the architecture does not rely on Obsidian's internal `.qmd` index.

---

# 6. Recommended `.md` vs `.qmd` Convention  **[DECIDED] [VERIFIED]**

Use `.md` for ordinary knowledge content.

```text
notes
essays
reference material
concept explanations
documentation
literature notes
```

Use `.qmd` when the document requires Quarto-specific functionality.

```text
computational essays
data analysis
Python / R / Julia execution
interactive Plotly or Observable content
reproducible research
Quarto cross-references
computational notebooks presented as documents
```

Conceptually:

```text
.md
 ├── prose
 ├── notes
 ├── concepts
 └── knowledge

.qmd
 ├── prose
 ├── mathematics
 ├── computation
 ├── data
 └── interactive output
```

The previous all-`.md` fallback is removed.

Current Quarto engine binding explicitly gives `.md` **no execution engine**; an `.md` document containing executable code blocks errors. `.qmd` is the correct source extension for computational documents.

Therefore:

> **Do not rename executable Quarto documents to `.md` merely to improve Obsidian indexing.**

The publication bridge solves the website-side indexing problem without corrupting the source format distinction.

---

# 7. Obsidian Plugins for Quarto

## qmd as md

Evaluate this first for day-to-day authoring.

Its role is to make `.qmd` practical to open and edit in Obsidian, with capabilities such as:

- `.qmd` Markdown editing
- Quarto preview
- Quarto render
- HTML preview
- QMD outline support
- `_quarto.yml` support
- templates

## QMD Preview

Useful as a lightweight, non-authoritative preview path when the goal is prose and markup feedback rather than code execution.

## Anything as Markdown

Potentially useful for making `.qmd` participate in more Obsidian behaviours.

Treat its deeper indexing mode as optional/experimental infrastructure, not as a requirement for the publishing architecture.

## Plugin Policy

The vault should remain meaningful without any one community plugin.

Plugins improve the authoring experience; they do not define the durable content model.

---

# 8. Editing Workflow

## Writing

Prefer Obsidian for:

```text
prose
Markdown
LaTeX
research notes
wikilinks
citations
structure
conceptual organization
```

## Programming

Prefer Neovim or VS Code for:

```text
Python
R
Julia
TypeScript
large code blocks
refactoring
debugging
LSP-driven development
complex execution
```

All tools edit the same source file.

```text
                       analysis.qmd
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
        Obsidian         Neovim          VS Code
          prose            code             code
          math             LSP            debug
          links            Vim            tools
```

---

# 9. Quarto Execution Model

Quarto remains the sole computational renderer.

```text
.qmd
 │
 ▼
Quarto
 │
 ├── execute code
 ├── produce figures
 ├── produce tables
 ├── produce widgets
 └── produce HTML
       │
       ▼
generated/quarto/
```

Quartz does not execute notebooks during its build.

This lets the website build remain independent of Python/R/Julia environments once frozen or otherwise prepared Quarto output exists.

---

# 10. Quarto Freeze  **[VERIFIED]**

Quarto freeze should be used when computation is expensive or reproducibility matters.

```yaml
execute:
  freeze: auto
```

means a global project render re-executes when the source document changes.

```yaml
execute:
  freeze: true
```

means global project renders reuse frozen computation until it is deliberately refreshed.

Freeze is a project-build reproducibility mechanism, not the prose-iteration mechanism. Frozen Jupyter output contains the engine-produced Markdown, including the prose that existed when the document was frozen.

For prose editing without re-executing unchanged code, enable execution caching as well:

```yaml
execute:
  freeze: true
  cache: true
```

Jupyter Cache invalidates on code-cell changes rather than narrative Markdown changes. An incremental file render can therefore incorporate current prose, reuse cached cell outputs, and refresh `_freeze/` with the newly composed document.

Frozen results live under `_freeze/` and should be versioned for published computational documents when CI is expected to build without reproducing the full execution environment.

---

# 11. Cached Prose Preview Workflow  **[VERIFIED]**

Desired loop:

```text
edit prose / LaTeX
      │
      ▼
render document
      │
      ├── update prose/layout
      │
      └── reuse cached computation
                │
                ▼
              HTML
```

Use an ordinary incremental render with caching enabled:

```bash
uv run quarto render analysis.qmd
```

The QMD/project metadata supplies `execute.cache: true`. With Jupyter Cache installed, a prose-only edit produces `Notebook read from cache`, preserves the execution outputs, and updates the prose in HTML.

Do **not** use `--use-freezer` for this loop. It correctly forces the frozen engine output, but that also restores the prose stored in the frozen Markdown and therefore hides later prose edits.

`--no-execute` is diagnostic rather than a suitable fallback for a source QMD:

```bash
quarto render analysis.qmd --no-execute
```

It renders current prose and code listings, but it does not restore prior cell outputs. For a complete prose preview with computational results, use the execution cache.

---

# 12. Quarto Output Boundary  **[VERIFIED]**

Quarto documents are computational content islands inside Quartz-owned pages.

No iframe is required.

A narrow, parser-based HTML fragment extraction is required at build time. It extracts only the Quarto body and resources; it does not rewrite the completed site with string substitutions.

```text
Quartz-rendered note
/notes/probability

Quarto-rendered research page
/research/monte-carlo
```

The exact physical output convention (`slug.html` versus a directory containing `index.html`) should be matched to Quartz's generated URLs during the implementation spike. The invariant is more important than the physical shape:

> **The Quartz stub's canonical slug and the Quarto artifact's public URL must be identical.**

Quartz owns the outer document, navigation, Explorer, search, responsive frame, metadata, backlinks, graph, and theme. Quarto renders minimal HTML; the bridge extracts its computational body and required resources into a dedicated Quartz Page Type.

```text
Quartz QuartoPage
+-----------------------------------+
| Quartz Explorer / search / theme  |
| +-------------------------------+ |
| | Quarto computational content  | |
| | cells / figures / widgets     | |
| +-------------------------------+ |
| Quartz TOC / graph / backlinks    |
+-----------------------------------+
```

Quarto is configured with `format.html.minimal: true` so Bootstrap cannot restyle the Quartz shell. Navigation across the renderer boundary uses full document loads until Quarto resources have explicit Quartz SPA lifecycle handlers.

---

# 13. Why Not Iframes

Iframes provide strong isolation but create avoidable costs for first-class knowledge pages:

```text
deep-link awkwardness
height management, especially on mobile
split navigation state
dark-mode synchronization
poor print/PDF behaviour
awkward backlinks / TOC integration
weaker indexing semantics
```

The Quartz shell plus scoped Quarto content keeps navigation unified without creating a frame boundary. Quarto is rendered without Bootstrap, and its page-specific resources remain isolated beneath the computational content boundary.

---

# 14. Self-Contained Quarto Output

Quarto can produce standalone HTML:

```yaml
format:
  html:
    embed-resources: true
```

Do not use this as the normal website path.

For a site, normal resource directories allow the browser to cache shared dependencies and avoid duplicating large JavaScript libraries inside every document.

Keep `embed-resources: true` for one-off portable exports and archival copies.

---

# 15. Publication Prep Replaces the General Content Compiler  **[DECIDED]**

The earlier architecture proposed a custom compiler responsible for:

```text
metadata
IDs
slugs
aliases
links
backlinks
tags
graph
publication state
search
```

That is no longer justified for v1.

Quartz already implements most of that stack.

The bespoke layer shrinks to **publication prep**:

```text
vault
 │
 ▼
prepare-publication.ts
 │
 ├── select publish:true Markdown
 ├── select publish:true Quarto documents
 ├── generate one .md stub per .qmd
 ├── copy only allowed/referenced attachments
 ├── generate canonical link-map.json
 └── validate privacy + broken links
 │
 ├──────────────► generated/quartz-content/
 └──────────────► generated/link-map.json
```

The publication-prep layer should **not** generate separate graph, backlink, or search indexes unless Quartz proves unable to do so.

---

# 16. QMD Stub Design  **[DECIDED]**

For every published Quarto document, generate one Markdown representation for Quartz.

Source:

```text
vault/research/monte-carlo.qmd
```

Generated stub:

```text
generated/quartz-content/research/monte-carlo.md
```

Example stub:

```markdown
---
title: Monte Carlo Simulation
publish: true
quartoStub: true
sourceType: quarto
tags:
  - statistics
  - simulation
aliases:
  - Monte Carlo
---

Monte Carlo methods use repeated random sampling to estimate...

See also [[Probability]] and [[Bayesian Statistics]].

## Sampling

...

## Convergence

...
```

The stub should preserve content useful to Quartz:

```text
frontmatter
title
description
headings
prose
wikilinks
normal links
tags
aliases
```

and omit material that exists only to execute or render the computational document:

```text
executable code cells
cell options
large code output
embedded widget payloads
raw implementation HTML
```

For the prototype, a simple extractor is acceptable. Once the format stabilizes, prefer an AST-aware transformation over a regex-only parser.

## 16.1 The Stub Is an Index Representation, Not a Public Duplicate

The stub must remain in Quartz's processed Markdown collection so that search, graph, link crawling, and backlink data can see it.

But Quartz must **not emit the stub as a competing HTML page**.

This distinction is critical.

> **Do not use a Quartz Filter to remove Quarto stubs.** A Filter removes the content from the processing set, which defeats the reason the stub exists.

Instead, page emission is controlled at the Page Type layer.

---

# 17. Quartz v5 Integration  **[DECIDED] [VERIFIED]**

Quartz v5 is a better fit than the earlier Astro design because it already provides the knowledge-site features this project needs and exposes extension points exactly where Quarto integration belongs.

Current v5 exposes plugin capabilities including:

```text
Transformers
Filters
Emitters
Page Types
Components
Bases Views
```

Basic configuration is YAML in:

```text
quartz.config.yaml
```

advanced programmatic overrides can live in:

```text
quartz.ts
```

and plugin versions are pinned by:

```text
quartz.lock.json
```

The TUI/plugin registry can be used to discover available plugins.

## 17.1 Quartz Parses `.md`, Not `.qmd`

Current Quartz v5 build code globs the content directory, then explicitly filters the Markdown processing set to paths ending in `.md`.

Therefore raw `.qmd` files do not naturally enter the normal Markdown transform/filter/index pipeline.

This is exactly why the generated `.md` stub is useful.

## 17.2 Page Type Rule: Suppress Stub HTML Without Removing the Stub

Quartz's normal Content Page page type matches ordinary Markdown pages broadly.

The bridge should replace or override that matcher so it does **not** match:

```yaml
quartoStub: true
```

Conceptually:

```text
processed Markdown
      │
      ├── normal note
      │      └── Content Page matches -> Quartz emits HTML
      │
      └── Quarto stub
             └── Content Page does not match -> no Quartz HTML page
```

The stub stays available to other Quartz processing.

## 17.3 Emitter Rule: Copy Real Quarto Output Into the Quartz Output Tree

A custom Quartz Emitter copies the already-rendered Quarto tree from:

```text
generated/quarto/
```

into the final Quartz output.

Emitters are the correct abstraction because they are intended to generate/copy output files and can use ordinary Node filesystem operations.

This is preferable to abusing Quartz's `Static` plugin:

```text
Static  -> resources stored under quartz/static
Assets  -> non-Markdown assets in the Quartz content directory
Emitter -> generated Quarto output from a separate build tree
```

The Quarto output should stay outside `generated/quartz-content/` so Quartz never treats raw `.qmd` or Quarto dependency files as ordinary content assets.

## 17.4 Why This Works

```text
                         monte-carlo.qmd
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
             stub generator                Quarto
                 │                           │
                 ▼                           ▼
        monte-carlo.md                  real HTML
                 │                           │
                 ▼                           │
              Quartz                         │
                 │                           │
        graph/search/backlinks               │
                 │                           │
       no stub page emitted                  │
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
                         same public slug
```

Quartz owns the **knowledge representation**.

Quarto owns the **rendered computational page**.

---

# 18. Linking Strategy  **[DECIDED — reversed 2026-08-24, refined 2026-08-25]**

Use **Markdown links as the authoring syntax**, everywhere, in both `.md` and `.qmd`, and always
write **the path from the vault folder** with the real source extension.

```markdown
[Bayesian Statistics](knowledge/bayesian-statistics.md)
[simulation notes](research/monte-carlo-simulation.md)
[Computational Features](examples/computational-features.qmd)
![Convergence](attachments/convergence.svg)
```

Obsidian is configured with `useMarkdownLinks: true` and `newLinkFormat: absolute`, so it writes
this form, resolves it, follows it, and rewrites it on rename exactly as it did wikilinks.

## 18.1 Why This Reverses The Original Decision

The original decision was wikilinks, on the reasoning that Quartz supports them natively and only
Quarto needs an adapter. That adapter turned out to be the whole cost.

Pandoc does not understand `[[...]]`, so wikilinks survive Quarto rendering as literal text. Making
them work meant walking text nodes in already-rendered HTML and rebuilding anchors by hand, against
a bespoke title/alias/basename index with priority tiers and ambiguity sentinels — a second
resolver that had to agree with Quartz's by hand, with the coupling maintained only by a comment.

Markdown links need none of it. Quarto passes hrefs through verbatim under `project: type: default`
(it performs no extension rewriting), so a link written in a `.qmd` arrives in the artifact intact
and is resolved with Quartz's own `transformLink` against its own slug list. The bespoke index is
gone; the two link paths now share one resolution rule.

What this costs: linking by title. `[[Markdown Features]]` had to become
`[Markdown Features](markdown-features.md)`, so a title appears twice and renaming a note's
frontmatter title no longer updates link text. Path rename-tracking is unaffected. There is also no
transclusion — link to the source note instead.

## 18.2 Why The Path Is From The Vault Folder

Obsidian offers three link formats. The choice is not cosmetic — two of them are ambiguous against
Quartz, and that ambiguity is the only remaining source of subtlety in link handling.

| Obsidian format | Sibling section index is written as | Quartz resolves it to |
|---|---|---|
| Shortest path when possible | `index.md` | the **site root** |
| Path from current file | `index.md` | the **site root** |
| Path from vault folder | `examples/index.md` | `/examples/` |

Under either of the first two, a link to a section's own index silently leaves the section, because
Quartz collapses a bare `index.md` to the root regardless of the directory it was written in. This
is not bridge-specific: the Quartz link crawler does it on ordinary Markdown pages too.

Making those formats work meant a "document-relative first, then vault-root" precedence rule in
publication prep *and* a matching one in the bridge — the same class of hand-synchronised agreement
that made wikilinks expensive. The vault-folder form removes the question rather than answering it
in three places, so prep resolves a target with a single lookup and no fallbacks, and the bridge
calls `transformLink` with no preamble.

Quartz is set to the matching `markdownLinkResolution: absolute`. A target that only resolves
relative to the document now fails the build instead of being guessed at.

## 18.3 The One Remaining Transform

Quartz slugification strips `.md` and `.html` but leaves every other extension in place, so a
`.qmd` href would publish broken. Publication prep rewrites `.qmd` link targets to `.md` while
staging, which is correct because every published document reaches the content tree as `.md`:

```text
[x](section/note.qmd)  --staging-->  [x](section/note.md)  --Quartz slugify-->  /section/note
```

That single mechanical substitution replaces the entire wikilink resolver stack.

## 18.4 One Resolver, Narrow Scope

The project still needs canonical link resolution, but only for the bridge:

```text
relative source-file href
            │
            ▼
   Quartz transformLink
            │
            ▼
       public URL
```

Quartz handles this for Quartz content, and the bridge now calls the same function for Quarto
content rather than reimplementing it.

---

# 19. Cross-Format Linking

The system must support:

```text
.md  -> .md
.md  -> .qmd
.qmd -> .md
.qmd -> .qmd
```

## 19.1 `.md -> .md`

Handled natively by the Quartz link crawler (`markdownLinkResolution: absolute`).

## 19.2 `.md -> .qmd`

The generated `.md` stub makes the Quarto document a valid Quartz link target.

Quartz resolves the link to the stub's slug; the Quarto emitter places the real Quarto HTML at that slug.

## 19.3 `.qmd -> .md` and `.qmd -> .qmd`

Quarto emits the href verbatim; the bridge resolves it with Quartz's `transformLink` against the
full slug list, applying the same `.qmd -> .md` normalisation publication prep applies to staged
source. The Quartz link crawler never sees the Quarto artifact — it runs over the `.qmd` stub — so
this resolution has to happen in the bridge.

## 19.4 Heading Links Need a Separate Test

Page-level links are the v1 requirement.

Links such as:

```markdown
[[Monte Carlo Simulation#Convergence]]
```

are more subtle because Quartz and Pandoc/Quarto may not derive identical heading IDs in every case.

Do not assume cross-renderer heading links are reliable until tested.

A robust later rule is to use explicit heading IDs for cross-renderer targets when necessary.

## 19.5 Block References and Transclusions

Obsidian block references and full transclusions into Quarto documents are not part of the v1 contract.

A Quartz transclusion of a Quarto stub can at most embed the **textual stub representation**, not the interactive Quarto application.

Treat interactive document embedding as a separate feature, not as ordinary link resolution.
Transclusion is not supported at all now that wikilink syntax is gone.

---

# 20. Canonical URLs, Slugs, and IDs

The system should distinguish:

```text
source path
display title
canonical slug
optional stable ID
```

For v1, keep this simple.

Example:

```yaml
---
title: Monte Carlo Simulation
aliases:
  - Monte Carlo
publish: true
---
```

Derive the slug predictably from the source path unless a real need for custom slugs appears.

Stable IDs can be introduced later when moves/retitles create enough value to justify them:

```yaml
id: monte-carlo
```

The key invariant for Quarto integration is:

```text
Quartz stub slug == Quarto public URL
```

Build-time validation should fail if those diverge.

---

# 21. Frontmatter as the Interoperability API

YAML frontmatter is the main metadata boundary between systems.

Example source:

```yaml
---
title: Monte Carlo Simulation
description: An introduction to Monte Carlo methods.
aliases:
  - Monte Carlo
  - MC Simulation
tags:
  - statistics
  - simulation
publish: true
---
```

Generated-only bridge metadata belongs in the stub, not necessarily in source:

```yaml
quartoStub: true
sourceType: quarto
sourcePath: research/monte-carlo.qmd
```

Avoid overloading source frontmatter with implementation details that exist solely for Quartz.

---

# 22. Publishing and Privacy  **[DECIDED]**

Publishing is opt-in.

```yaml
publish: true
```

Anything else is private by default.

The raw vault may eventually contain:

```text
drafts
scratch notes
meeting notes
private research
templates
temporary files
data
PDFs
notebooks
credentials accidentally pasted into notes
plugin state
```

Therefore:

```text
vault != Quartz content directory
```

## 22.0 Two Ways to Mark Content Private

Two path conventions place content outside the boundary entirely, independent of frontmatter:

```text
*_hidden/                     any directory whose name ends in `_hidden`, anywhere in the
                              vault -- notes, attachments, frozen output. The bare
                              `_hidden/` is the common case; `drafts_hidden/` also counts.
*.hidden.md, *.hidden.qmd     a single file, for one local note inside an otherwise
                              public folder
```

Both are git-ignored and both are skipped during source discovery, so publication prep never reads
them and `publish: true` inside them has no effect. Source discovery tests the `_hidden` suffix
separately from its existing "_"-prefix rule, because `drafts_hidden/` carries no leading
underscore. Underscores are not slug-safe, so no publishable folder can carry the suffix by
accident. Skipping them in prep rather than relying on
`.gitignore` alone is what keeps a local run and a CI run over the committed tree on the same file
set: a published note linking into hidden content fails the build locally, not for the first time in
CI where the target file does not exist.

## 22.1 Two Privacy Layers

### Layer 1 — Publication Prep

Only selected content and attachments enter:

```text
generated/quartz-content/
```

This is the primary boundary.

### Layer 2 — Quartz ExplicitPublish

Enable Quartz's explicit-publish filter as a second check.

This protects Markdown pages but must not be mistaken for a general asset privacy system.

## 22.2 Validation Must Fail on Leaks

The build should fail if private content appears in any public derivative:

```text
emitted pages
QMD stubs
link-map entries
search/graph metadata
backlink targets
RSS/sitemap
copied attachments
Quarto output
```

Also check `_freeze/`: frozen output can contain results derived from private data even when the source document itself is not public.

---

# 23. Search, Backlinks, and Graph  **[DECIDED]**

Do not build separate v1 implementations.

The generated QMD stub exists so Quartz can use its existing content machinery.

```text
public .md ───────┐
                  │
QMD .md stub ─────┼──► Quartz processed content
                  │
                  ├──► search
                  ├──► graph
                  ├──► backlinks
                  ├──► tags
                  └──► navigation metadata
```

The source `.qmd` remains invisible to Quartz's Markdown parser; the stub is its indexable representation.

This removes the former need for:

```text
content-index.json
search-index.json
graph.json
custom backlink generation
```

unless a future feature requires exporting those data separately.

---

# 24. Quarto Pages and Quartz UI

A limitation of the sibling-page design is important:

> Quartz can know about a Quarto document, but the final Quarto HTML page is not rendered by Quartz's page frame.

Therefore a Quarto page does not automatically receive Quartz UI components such as:

```text
backlinks panel
Explorer sidebar
graph widget
Quartz table of contents
reader-mode controls
```

This is acceptable for v1 because site-wide search, graph, and backlinks **from Quartz pages** can still understand the document through the stub.

Later, if desired, add a small bridge artifact such as:

```text
quarto-page-metadata.json
```

and inject selected site UI into Quarto via template partials.

Do not make this a prerequisite for initial publishing.

---

# 25. Citations and Mathematics  **[REVISED]**

## 25.1 Citations

Keep one bibliography at vault root:

```text
vault/references.bib
```

Quarto handles citations natively for `.qmd`.

Quartz v5 also has a citations plugin based on a bibliography file, so ordinary `.md` notes do **not** need to be forced through Quarto merely because they contain citations.

The exact authoring syntax and CSL style should be standardized during Phase 3 so the Markdown and Quarto paths render consistently.

## 25.2 Mathematics

Use **one math engine across the stack** so an equation cannot render in Obsidian and fail on a
publication path. The implementation settled on **KaTeX**, not the MathJax originally proposed here:

```text
Obsidian -> MathJax (built in)
Quartz   -> KaTeX   (@quartz-community/latex, renderEngine: katex)
Quarto   -> KaTeX   (html-math-method: katex)
```

Both publication paths agree, which is the property that matters. Note that Quartz's KaTeX does not
reach inside `.quarto-content` — that fragment is injected HTML and never passes through Quartz's
Markdown pipeline — so Quarto must keep its own client-side math method rather than delegating.

Two loose ends: Quarto's KaTeX reference is unpinned (`katex@latest`) and should be pinned, and
Plotly pulls in a third engine (MathJax 2.7.5 from cdnjs) that nothing on these pages uses.

---

# 26. Reproducible Computational Environments

Freeze preserves output, not the environment that produced it.

Important projects should eventually track dependencies.

Example:

```text
research/
└── housing/
    ├── index.qmd
    ├── pyproject.toml
    ├── uv.lock
    └── data/
```

Alternatives include:

```text
requirements.txt
conda environments
renv for R
containers
Nix
```

Rule of thumb:

> If losing the frozen output would be painful, preserve enough environment metadata to regenerate it.

---

# 27. Git

Track durable source and reproducibility state:

```text
vault content
selected .obsidian configuration
site/quartz.config.yaml
site/quartz.lock.json
site/quartz.ts
bridge/plugin source
publication scripts
Quarto configuration
dependency lockfiles
published _freeze output
```

Generated publication staging should normally be rebuildable:

```text
generated/quartz-content/
generated/link-map.json
generated/quarto/
```

Whether rendered Quarto HTML itself is committed depends on deployment architecture.

For published computational documents, commit the corresponding `_freeze/` state when CI is expected not to execute the computation.

---

# 28. Build Pipeline  **[DECIDED]**

Publication prep happens before Quarto rendering so the staged tree and the render allowlist are both current.

```text
                           VAULT
                             │
                             ▼
                   validate source metadata
                             │
                             ▼
                  prepare-publication.ts
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
 generated/quartz-content/          generated/link-map.json
 .md + QMD stubs + assets                   │
              │                             │
              │                             ▼
              │                           Quarto
              │                             │
              │                             ▼
              │                    generated/quarto/
              │                             │
              └──────────────┬──────────────┘
                             ▼
                          Quartz v5
                             │
                  ┌──────────┴──────────┐
                  │                     │
          normal Quartz pages     QMD stubs indexed
                                  but not emitted
                  │                     │
                  └──────────┬──────────┘
                             │
                    Quarto bridge Emitter
                             │
                             ▼
                        static output
```

Potential orchestration command:

```bash
bun run build
```

with stages approximately:

```text
validate
-> prepare public staging + link map
-> render/reuse Quarto artifacts
-> build Quartz
-> verify output URLs and privacy
```

---

# 29. Quartz v5 Configuration and Bridge Plan

Quartz v5 moved normal configuration to YAML and keeps programmatic escape hatches for advanced behaviour.

The project should favor configuration first and custom code second.

## 29.1 Use Existing Quartz Plugins for Existing Problems

Configure first-party/community packages for features such as:

```text
Obsidian-flavoured Markdown
search
graph
backlinks
citations
LaTeX
ExplicitPublish
Explorer / navigation
RSS / sitemap
```

Do not create project-local equivalents.

## 29.2 The Custom Bridge Has Only Two Quartz Responsibilities

### A. Page Type behaviour

Prevent `quartoStub: true` Markdown from being emitted as a Quartz content page while leaving it in processed content.

### B. Emitter behaviour

Copy `generated/quarto/` into the final output tree at the canonical URLs represented by those stubs.

That is the entire required Quartz integration for v1.

## 29.3 `Static` vs `Assets` vs Custom Emitter

Keep these responsibilities distinct:

```text
Static
  Quartz-owned static resources under quartz/static

Assets
  non-Markdown files inside the Quartz content tree

Quarto bridge Emitter
  generated computational site artifacts outside the content tree
```

---

# 30. Future Quartz-Native QMD Integration

Quartz v5 Page Types can define new file extensions and can generate virtual pages.

That creates a possible future design:

```text
.qmd
 │
 ▼
custom Quarto Page Type
 │
 ├── extract metadata/prose/links
 ├── create virtual Quartz representation
 └── coordinate final Quarto artifact
```

Virtual pages are made available to later Quartz emitters, so a sufficiently complete QMD Page Type could eventually remove the physical stub files.

Do **not** begin there.

Physical generated `.md` stubs are simpler because they naturally pass through Quartz's ordinary Markdown transformer pipeline. That gives the project Obsidian-flavoured Markdown handling, link crawling, tags, descriptions, and indexing with much less custom code.

If the bridge proves generally useful, it could later become a standalone Quartz v5 plugin in the `quartz-community` ecosystem.

---

# 31. Astro as a Fallback, Not a Dependency  **[DECIDED]**

Astro is removed from the v1 architecture.

Reconsider it only if the project becomes substantially more application-like, for example:

```text
authenticated areas
server endpoints
complex client-side application state
dashboards
commerce
heavy custom application routing
UI requirements that continually fight Quartz's page model
```

If the site remains primarily:

```text
knowledge base
digital garden
research site
essays
computational documents
interactive visualizations
```

Quartz is the better default because it removes a large amount of infrastructure that Astro would require this project to build or assemble.

---

# 32. Important Design Constraints

Avoid assumptions such as:

```text
Obsidian will always exist
Quartz will always exist
Quarto will always exist
one community plugin will always work
all Markdown dialects are identical
all vault files are safe to publish
file paths will never change
```

Prefer durable concepts:

```text
plain text
Markdown
YAML
BibTeX
HTML
filesystem paths
Git
static output
stable metadata conventions
```

The architecture should make replacing an application inconvenient, not catastrophic.

---

# 33. Known Risks and Pitfalls  **[REVISED]**

## Markdown Dialect Differences

The main authoring/rendering dialects still differ:

```text
Obsidian Markdown
Quartz / unified Markdown pipeline
Pandoc / Quarto Markdown
```

Quartz removes most Obsidian-vs-site duplication for `.md`, but any syntax used inside `.qmd` still needs Quarto compatibility.

Keep a small supported subset and test it explicitly.

## Obsidian `.qmd` Indexing

Editing `.qmd` in Obsidian is practical; first-class graph/backlink/search behaviour is less dependable.

The generated Quartz stub fixes the **published** knowledge graph, not Obsidian's internal metadata cache.

Avoid depending on automatic rename-updates-links for QMD targets until Experiment 1 proves the exact local behaviour.

## QMD Stub Drift

A stale stub can cause search/graph metadata to disagree with the real Quarto page.

Mitigation:

```text
never hand-edit stubs
generate them on every build
record source hash if useful
fail validation if expected stub is missing
```

## Stub/Page URL Collision

If Quartz emits the stub and Quarto also writes the same URL, the build is invalid.

Mitigation: exclude `quartoStub: true` at the **Page Type** matching stage and verify only one final file owns each public URL.

## Quarto URL Drift

If Quarto's output path differs from the Quartz stub slug, search and graph links lead to a missing page.

Mitigation: one canonical URL map plus an output validation step.

## Cross-Renderer Heading IDs

`[[Page#Heading]]` may not be safe across Quartz and Quarto until anchor-generation rules are tested.

Start with page-level links and use explicit IDs for important cross-renderer headings if needed.

## Transclusions

Quartz can transclude a generated textual stub, but that is not equivalent to embedding the interactive Quarto page.

Keep interactive embedding out of v1.

## Quarto Preview Execution

`freeze: auto` is not a prose-only cache. Use `freeze: true`, `--use-freezer`, or chunk caching according to the workflow being performed.

## Private Asset Leakage

Quartz explicitly warns that non-Markdown assets can be published regardless of Markdown filters.

This is why Quartz receives a staged public directory rather than the raw vault.

## Attachment Management

Use a stable attachment convention that both source types can resolve.

Prefer a single known attachment root and standard relative Markdown image links when possible.

## Quarto Page UI Divergence

Quarto pages will not automatically contain every Quartz component.

Shared typography/navigation is a v1 goal; full component parity is not.

## Reproducibility

Frozen output is not a preserved environment. Track dependency versions for important work.

## Quartz v5 Ecosystem Maturity

Quartz v5 has a substantial official plugin ecosystem and a plugin registry/TUI, but the v5 ecosystem is newer than long-established editor ecosystems. Pin plugin versions with `quartz.lock.json`, prefer first-party/official community plugins for critical functions, and keep the custom bridge small.

---

# 34. Remaining Open Decisions

The major architecture question is resolved. Remaining decisions are implementation details rather than platform selection.

| # | Decision | Default | Gate |
|---|---|---|---|
| 1 | Quartz vs Astro | **Quartz v5** | Decided |
| 2 | Link syntax | **Markdown links, path from vault folder** | Decided; reversed from wikilinks 2026-08-24, format fixed 2026-08-25, see §18.1–18.2 |
| 3 | `.qmd` vs all-`.md` | **Keep `.qmd`** | Verified by Quarto engine rules |
| 4 | QMD knowledge representation | **Generated `.md` stub** | Confirm in Quartz spike |
| 5 | Stub suppression | **Page Type matcher, not Filter** | Confirm with prototype |
| 6 | Quarto artifact integration | **Custom Emitter** | Confirm exact output paths |
| 7 | Prose computation reuse | `freeze: true` + `cache: true`; incremental file render | Verified with Quarto 1.10.18 |
| 8 | Cross-renderer heading links | page-level only initially | Experiment |
| 9 | Deployment target | static host + CI | Still open |

## Deployment Target

A static host with CI is the default assumption.

Deployment choice determines:

```text
whether generated Quarto HTML is committed
whether CI needs Quarto installed
whether preview builds are required
how build caches are configured
```

The design should not require server-side computation.

---

# 35. Verified Implementation Facts and Reference Points

These facts materially changed the architecture and should be rechecked if Quartz or Quarto makes a major version change.

## Quartz v5

- Quartz 5 is a ground-up rearchitecture centered on extensibility and Obsidian compatibility.
- Configuration moved to `quartz.config.yaml`; `quartz.ts` remains available for advanced programmatic overrides.
- Plugins are standalone packages, with discovery through the TUI/registry and version pinning through `quartz.lock.json`.
- Plugin capabilities include Transformers, Filters, Emitters, Page Types, Components, and Bases Views.
- Emitters are intended for output generation and can use normal Node filesystem APIs.
- Page Types define how categories of pages render and can also generate virtual pages.
- Current build code only sends files ending in `.md` through normal Markdown parsing.
- `ExplicitPublish` filters Markdown pages, but Quartz warns that non-Markdown assets are still emitted unless excluded.

Useful references:

- <https://quartz.jzhao.xyz/getting-started/whats-new>
- <https://quartz.jzhao.xyz/advanced/making-plugins>
- <https://quartz.jzhao.xyz/features/private-pages>

## Quarto

- `.qmd` automatically binds a computational engine when executable cells are present.
- `.md` has no execution engine; executable cells in `.md` are an error.
- `--use-freezer` is a documented render option that forces frozen computations for an incremental file render.
- Jupyter Cache ignores narrative-only changes when deciding whether cached computation is reusable.

Useful references:

- <https://quarto.org/docs/computations/execution-options.html>
- <https://quarto.org/docs/computations/caching.html>
- <https://quarto.org/docs/projects/code-execution.html>
- <https://quarto.org/docs/cli/render.html>

## Pandoc / Wikilinks  **[NOT USED]**

Pandoc supports a wikilink syntax extension. It was never enabled, and is moot since link syntax
reversed to Markdown links (§18.1), which Pandoc handles natively.

Reference:

- <https://pandoc.org/MANUAL.html#wikilinks>

---

# 36. Desired End State

```text
I want to write
      │
      ▼
   Obsidian

I want to program
      │
      ▼
Neovim / VS Code

I want computation
      │
      ▼
    Quarto

I want a knowledge website
      │
      ▼
   Quartz v5

I want Quarto documents in that knowledge graph
      │
      ▼
QMD stub + narrow bridge
```

No one application owns the knowledge base.

The files do.

Quartz provides the site-level knowledge model rather than a custom compiler, while Quarto remains authoritative for computational rendering.

---

# 37. Incremental Approach

The project should be built by proving the risky boundaries first. Do not implement the final bridge before the core assumptions work with real files.

## Experiment 0 — Quartz v5 Spike  **(first)**

Use a throwaway Quartz v5 site and roughly ten representative notes.

Confirm:

1. `quartz.config.yaml` and the TUI/plugin workflow are comfortable to maintain.
2. Wikilinks, aliases, callouts, transclusions, backlinks, graph, search, tags, and citations behave correctly with representative notes.
3. Theme/layout customization is sufficient without introducing Astro.
4. The site can consume a staged/symlinked content directory rather than the raw vault.
5. Plugin versions are reproducible through `quartz.lock.json`.

**Exit criterion:** Quartz is accepted unless a concrete requirement proves difficult enough that Astro materially simplifies the project.

The architecture no longer treats Astro and Quartz as equally likely branches.

### Experiment 0 implementation status — 2026-08-23

**Automated spike: passing. Manual visual/interactive QA: pending.**

Implemented:

- copied the official Quartz `v5` branch at commit `075afd3f712da0088a07f5284a7b3aba37dd61b6` into `site/` without nested Git metadata;
- initialized the Obsidian template and pointed `site/content` at `../generated/quartz-content` with a directory symlink;
- added ten representative Markdown notes plus a BibTeX file and SVG attachment;
- enabled citations and kept the default graph, search, backlinks, aliases, tags, folder pages, LaTeX, callouts, and transclusion plugins;
- produced a successful static build of all ten Markdown inputs;
- verified generated HTML/index output for callouts, a collapsed callout, transclusion, citations, math, tags, folder pages, aliases, the search index, and copied assets;
- verified that the local preview server responds successfully over HTTP.

Observed constraints:

- Quartz's setup command assumes its working tree is the Git repository root and attempts to configure an `upstream` remote. In this monorepo layout, the initial setup completed content/config creation but could not modify the parent repository's Git configuration. Upstream provenance is therefore recorded explicitly in `site/QUARTZ_UPSTREAM.md`.
- Default plugins from the Obsidian template are npm packages pinned by `package-lock.json`. `quartz.lock.json` applies to Git-sourced plugins; it is not created when the site uses only the bundled npm plugin set.
- Wikilinks resolve most predictably from a filename/path. A title that differs from its filename needs an explicit alias, which Quartz emits as a redirect URL. Canonicalization and graph behaviour across alias redirects should be considered when defining vault naming conventions.
- The default Open Graph image emitter attempted a network-dependent font operation and then failed with the available system-font fallback. It is disabled for this local spike and is not required for the knowledge-site boundary.
- The browser pass was completed after this section was first written. Explorer, Graph View, search, Table of Contents, breadcrumbs, and the Properties panel all render and initialise correctly; SPA transitions between ordinary notes work, and navigation across the Quarto renderer boundary is a full document load by design. The one defect it found is recorded in the Experiment 5 addendum.

Run the verified build with:

```bash
cd site
npm install
node quartz/bootstrap-cli.mjs build
```

---

## Experiment 1 — `.qmd` in Obsidian

Create:

```text
test-vault/
├── note-a.md
├── note-b.md
├── analysis.qmd
├── _quarto.yml
└── .obsidian/
```

Test:

1. opening/editing `.qmd` with the selected Obsidian plugin;
2. `.md -> .qmd` links;
3. `.qmd -> .md` links;
4. `.qmd -> .qmd` links;
5. backlinks, graph, search, quick switcher;
6. rename behaviour for a linked `.qmd`;
7. Quarto rendering with the project allowlist.

The file-extension decision is **not** gated by this experiment anymore: executable Quarto documents stay `.qmd`. The experiment measures the authoring UX and determines whether an optional Obsidian indexing plugin is worth using.

### Experiment 1 implementation status — 2026-08-23

**Source and Quarto rendering checks: passing. Obsidian UI checks: pending.**

Implemented in a disposable fixture that was removed after the behaviour was integrated:

- a disposable vault containing two Markdown files and two QMD files with all four link directions;
- `showUnsupportedFiles: true`, automatic link updates, vault-folder-path Markdown links (`useMarkdownLinks: true`, `newLinkFormat: absolute`), and the `qmd-as-md-obsidian` community plugin ID;
- an explicit Quarto render allowlist for `research/**/*.qmd`;
- an isolated `uv` project with a locked Jupyter environment;
- repeatable source and rendered-output validation scripts.

Verified with Quarto 1.10.18:

- the allowlist renders only the two QMD files;
- both Python cells execute through the `uv` environment;
- output is written under `_site/research/`;
- plain Quarto leaves Obsidian wikilinks as literal `[[...]]` text. This forced the Quarto-side adapter in Experiment 6, and is ultimately why link syntax reversed to Markdown links (§18.1), which Pandoc renders natively.

Still manual:

- install/enable `qmd as md` inside the disposable vault;
- assess QMD editing, backlinks, graph, search, quick switcher, and rename behaviour in Obsidian.

---

## Experiment 2 — Frozen Prose Loop

Build one real `.qmd` containing:

```text
prose
LaTeX
Python
a table
a static figure
an interactive figure
```

Test:

1. normal render;
2. `freeze: true` on a prose-only change;
3. incremental render with `--use-freezer`;
4. `--no-execute` as a diagnostic fallback;
5. interactive behaviour after serving the generated files from a plain static server.

Use an execution side effect such as a timestamp to prove whether code actually re-ran.

### Experiment 2 implementation status — 2026-08-23

**Passing.** Interactive behaviour was subsequently confirmed inside the Quartz shell; see Experiment 5.

The now-removed disposable fixture contained prose, LaTeX, four Python cells, a table, a static Matplotlib figure, and an interactive Plotly figure. Its Python/Jupyter environment was locked with `uv`.

Observed with Quarto 1.10.18:

- the initial render executed all four cells and wrote `_freeze/` plus complete HTML dependencies;
- after a prose-only source edit, both `--use-freezer` and a global project render preserved the original execution stamp **and the original prose**;
- `--no-execute` incorporated current prose but omitted all previous cell results;
- enabling Jupyter Cache, priming it once, editing only prose, and incrementally rendering the file produced `Notebook read from cache`;
- that cached render retained execution stamp `2026-08-23T06:28:22.548464+00:00` while updating the HTML prose;
- the cached incremental render also refreshed the versioned `_freeze/` artifact;
- the final HTML contains the table, static figure dependency, Plotly payload, LaTeX, and normal Quarto dependency directory.

Interactive Plotly behaviour was later verified end-to-end through the Quartz bridge rather than a plain static server, because that is the environment that actually matters. See the Experiment 5 addendum.

The generated page loads Plotly, MathJax, and KaTeX from public CDNs, one of them unpinned (`katex@latest`). A fully offline/self-contained policy remains a separate decision, but the unpinned reference should be pinned regardless.

---

## Experiment 3 — QMD Stub Proof of Concept

Use one Quarto document:

```text
vault/research/monte-carlo.qmd
```

Generate:

```text
generated/quartz-content/research/monte-carlo.md
```

The stub should contain:

```text
frontmatter
prose
headings
wikilinks
no executable code
quartoStub: true
```

Confirm that Quartz:

1. sees the stub in full-text search;
2. includes it as a graph node;
3. produces backlinks to/from it;
4. resolves an ordinary note's `[[Monte Carlo Simulation]]` link to its slug.

Do not integrate Quarto HTML yet.

### Experiment 3 implementation status — 2026-08-23

**Passing.**

Implemented:

- authoritative source at `vault/research/monte-carlo.qmd`;
- prototype TypeScript generator at `scripts/generate-qmd-stub.ts`;
- unit coverage for frontmatter injection, executable-cell removal, prose/wikilink retention, ordinary code retention, and malformed fences;
- generated index representation at `generated/quartz-content/research/monte-carlo.md`.

Verified:

- the stub retains frontmatter, prose, headings, math, tags, aliases, and wikilinks;
- executable Python cells do not appear in the stub;
- Quartz parses the stub as `research/monte-carlo`;
- the search/content index contains its prose, headings, tags, and three graph links;
- backlinks from Probability and Statistics include Monte Carlo Simulation;
- the normal Quartz content page is still emitted, as expected before Experiment 4.

The prototype deliberately copies Quarto-only frontmatter keys such as `format` and `execute`. Publication prep may remove those later if they create a concrete conflict; they are harmless in the current Quartz build.

---

## Experiment 4 — Suppress Stub HTML

Replace/override the normal content-page Page Type matcher so:

```text
quartoStub: true -> no Quartz content page emitted
normal Markdown  -> normal Quartz page emitted
```

Confirm the stub **still** participates in search/graph/backlink processing.

This is the decisive proof that the stub can be metadata/index content without becoming a duplicate page.

If filtering the stub makes it disappear from indexes, that is expected and confirms why Filter is the wrong layer.

### Experiment 4 implementation status — 2026-08-23

**Passing.**

`site/quartz.ts` now installs a higher-priority `QuartoPage` Page Type:

```text
quartoStub: true -> QuartoPage matches -> Quartz shell + Quarto body
normal Markdown  -> ContentPage matches -> normal Quartz HTML
```

Verified after a clean Quartz build:

- `site/public/research/monte-carlo.html` is owned by `QuartoPage`, not `ContentPage`;
- the stub remains present as `research/monte-carlo` in `contentIndex.json` with searchable prose and graph links;
- Probability and Statistics still render backlinks to Monte Carlo Simulation;
- the alias redirect remains emitted;
- a normal Markdown page still renders through `ContentPage`;
- the full Quartz TypeScript and Prettier check passes.

This confirms that Page Type selection is the correct integration layer. The stub remains parsed content for every earlier emitter while its final body is supplied by Quarto.

---

## Experiment 5 — Quarto Emitter Boundary

Render the real Quarto page into:

```text
generated/quarto/
```

Add the smallest possible custom Emitter that copies the Quarto output into Quartz's final output tree.

Confirm:

1. the Quarto artifact occupies the exact URL represented by the stub;
2. no Quartz stub HTML competes for that URL;
3. Quarto dependency directories are copied correctly;
4. navigation from a Quartz note to the Quarto page works;
5. browser back/forward navigation works acceptably with Quartz SPA mode;
6. direct loading of the Quarto URL works on the target static server.

If SPA navigation causes problems when crossing renderer boundaries, test a normal full-page navigation for Quarto links before considering larger architectural changes.

### Experiment 5 implementation status — 2026-08-23

**Passing**, including the computational payload and browser interaction. See the addendum below.

Implemented:

- `vault/_quarto.yml` renders the authoritative allowlisted QMD into `generated/quarto/`;
- `vault/pyproject.toml` and `uv.lock` pin its Python/Jupyter environment;
- `site/bridge/quartoArtifacts.ts` recursively copies Quarto dependency files into the Quartz output directory, excludes Quarto's complete HTML pages, and rejects artifact-tree symlinks;
- `site/bridge/quartoPage.tsx` extracts minimal Quarto content into the normal Quartz content frame;
- `site/quartz.ts` installs the artifact emitter and the higher-priority `QuartoPage` Page Type.

Verified:

- the QMD executes and produces `generated/quarto/research/monte-carlo.html` plus its dependency directory;
- the Quartz build emits the unified page at `site/public/research/monte-carlo.html`;
- the page identifies Quartz as its outer generator, contains the computed result inside `.quarto-content`, and retains Quartz root, Explorer, search, graph, and TOC markup;
- no Quarto Bootstrap resource is referenced by the unified page;
- Quarto dependency files are copied under `research/monte-carlo_files/`;
- the stub remains in Quartz's search/graph index and still produces backlinks;
- aliases still redirect to the canonical `research/monte-carlo` URL;
- a direct HTTP request to `/research/monte-carlo` succeeds with status 200 through the Quartz preview server;
- the Quartz TypeScript and formatting check passes.

The `QuartoPage` boundary now resolves relative source-file hrefs in the Quarto artifact into canonical Quartz links using Quartz's own `transformLink`. (Originally this converted literal wikilinks via a bespoke path/title/alias index; see §18.1 for why that was removed.) Quartz detects navigation into or out of `.quarto-page` and falls back to a full document load; interactive behaviour and browser back/forward remain part of the browser pass.

---

### Experiment 5 addendum — computational payload and browser pass

The original Experiment 5 fixture (`monte-carlo.qmd`) emits two scalar values. That is too weak a
payload to test the reason §12 chose HTML-fragment extraction over an iframe, which is *"cells /
figures / widgets"*. A second authoritative document was therefore added:

```text
vault/research/convergence-diagnostics.qmd
```

carrying LaTeX, a pandas table, a Matplotlib figure, a live Plotly widget, and wikilinks in all the
directions Experiment 6 cares about. `vault/pyproject.toml` gained `matplotlib`, `pandas`, and
`plotly`, re-locked with `uv`.

**This immediately surfaced a real defect that the trivial fixture had hidden.**

Jupyter widget output ships a RequireJS/AMD shim — a `require.min.js` tag, a `define('jquery', ...)`
registration, and a `window.define = undefined` guard wrapped around Quarto's KaTeX. Hoisted into
the Quartz shell by `extractQuartoPage`, that shim leaves a global `define.amd` in place. Quartz's
own bundles are UMD, so they detect AMD and register as modules instead of assigning their globals.
The observable result on the widget page was:

```text
window.d3            undefined
console              [Graph] Libraries not loaded
Graph View           empty
```

The Plotly chart itself rendered fine; it was *Quartz's* components that broke. The failure is
confined to pages carrying widget output and does not leak to other pages, because navigation into
and out of a Quarto page is a full document load.

The fix follows the same policy as the existing Bootstrap rule — Quarto's page chrome must not enter
the Quartz shell. `quartoPageHtml.ts` now drops the AMD shim and its guards during extraction, while
leaving the widget's own `<script src="...plotly.min.js">` and `Plotly.newPlot(...)` untouched. A
bare ESM preload that Quarto emits as `import "https://cdn.plot.ly/plotly-3.7.0.min"` (no extension,
403s on the CDN) is dropped too; an extension-bearing import is preserved in case it is the only
loader on the page.

Verified in the browser against the Quartz preview server:

- `/research/convergence-diagnostics` loads with **zero console errors**;
- the Plotly widget is genuinely live — a scripted `Plotly.relayout` changes the axis range and reads
  back, and the trace exposes hover handlers, so it is not a static paint;
- the Matplotlib PNG and the pandas table render inside `.quarto-content`;
- KaTeX renders all five math elements in the Quarto body;
- Quartz's Explorer, breadcrumbs, Properties panel, Graph View, and Table of Contents all render
  around it, and `window.d3` is defined again;
- QMD wikilinks resolve to Monte Carlo Simulation, Statistics, and Bayesian Inference;
- navigation from `/concepts/probability` into a Quarto page is a full document load, as intended,
  and normal pages are unaffected by the widget page's globals.

Regression coverage: two new cases in `site/bridge/quartoPage.test.ts`, and
`scripts/validate-quarto-emitter.sh` now asserts the figure, table, and Plotly payload are present
while the three AMD shim markers are absent.

**Closed by Phase 11.** The Plotly widget and the Matplotlib PNG rendered on white backgrounds in
dark mode. Plotly is now rethemed at runtime from Quartz's theme variables; the Matplotlib figure is
drawn on a transparent background in a neutral chosen to clear 3:1 against both page backgrounds.

---

### Note on `minimal: true` output shape

With `format.html.minimal: true`, Quarto emits **no** `<main id="quarto-document-content">`. The
production path through `extractQuartoPage` is therefore always the `body` fallback, not the `main`
branch that the first unit test exercises. Both branches are covered, but the fallback is the one
that matters.

### Note on `output-dir` outside the project

`vault/_quarto.yml` sets `output-dir: ../generated/quarto`, which Quarto warns about:

```text
WARN: Refusing to remove directory .../generated/quarto/research/monte-carlo_files
      since it is not a subdirectory of the main project directory.
WARN: Quarto did not expect the path configuration being used in this project.
```

The practical consequence is that Quarto will not clean stale `*_files/` directories, so a renamed or
deleted document leaves orphaned artifacts that the emitter will keep copying into the site.
Publication prep now clears `generated/quarto/` before rendering, which closes this.

---

## Experiment 6 — QMD Wikilinks  **[SUPERSEDED 2026-08-24]**

> Retained as the record of what was built and observed. The wikilink adapter described here was
> removed when link syntax reversed to Markdown links; see §18.1. The four link directions below
> are still the contract — they are now exercised with Markdown links instead.

Create all four link directions:

```text
.md  -> .md
.md  -> .qmd
.qmd -> .md
.qmd -> .qmd
```

The baseline adapter is implemented in the Quartz `QuartoPage` parser. It uses Quartz's complete file index directly, avoiding a second generated `link-map.json` artifact.

Page-level links, aliases, and heading fragments are supported. Resolution precedence is canonical path, then title/alias, then basename, which prevents generated tag pages from shadowing real notes.

Continue testing:

```text
same-name notes in different folders
embedded wikilinks
```

Do not add block-reference compatibility until there is a real use case.

---

### Experiment 6 implementation status — 2026-08-23

**Passing for the v1 contract.**

The adapter lives in the Quartz `QuartoPage` parser and uses Quartz's own file index, so no second
`link-map.json` artifact exists. All four link directions are exercised by the two authoritative
Quarto documents plus the staged notes:

```text
.md  -> .md    concepts/probability -> concepts/statistics
.md  -> .qmd   concepts/probability -> research/monte-carlo
.qmd -> .md    research/convergence-diagnostics -> concepts/statistics
.qmd -> .qmd   research/convergence-diagnostics -> research/monte-carlo
```

Verified in the browser: wikilinks written in a `.qmd` body arrive in the published page as
`class="internal internal-link"` anchors pointing at canonical Quartz slugs, and no literal `[[...]]`
survives. Aliases resolve (`MC Diagnostics` redirects to `research/convergence-diagnostics`), and
resolution precedence remains canonical path, then title/alias, then basename.

Still untested, as the section already noted: same-name notes in different folders, and embedded
wikilinks. Block references remain out of scope.

---

### Stub drift, observed  **[RESOLVED]**

§33 predicts stub drift and prescribes *"generate them on every build; fail validation if the
expected stub is missing."* Neither was wired up, and the failure arrived within a day: a review on
2026-08-23 found `vault/research/monte-carlo.qmd` reading `\widehat{\mu}_n` while its committed stub
still read `\hat{\mu}_n`. The source had been edited and nothing regenerated the derivative.

The stub was regenerated by hand at the time, and the *mechanism* arrived with Phase 9:
`scripts/prepare-publication.ts` rebuilds every stub from source on each build, and
`scripts/generate-qmd-stub.ts` is no longer invoked manually.

---

## Experiment 7 — Interactive Client-Side Components  **[VERIFIED]**

Interactive client-side components are a hard project requirement, so they were validated before
Phase 9 rather than after. Quarto offers four routes; two of them are ruled out by constraints this
project already has:

| Route | Engine | Deployment | Verdict |
|---|---|---|---|
| **Observable JS** | JavaScript | fully static | **Adopted** |
| **Jupyter Widgets** | Python / Jupyter | fully static | **Adopted** |
| htmlwidgets | R / Knitr | static | **Excluded** — R-only framework, no Python path |
| Shiny | R, or Shiny for Python | **requires a server** | **Excluded** — conflicts with the static-hosting constraint |

Shiny for Python exists, but plain Shiny needs a live server process. The statically deployable
variant is **Shinylive**, which compiles Python to WebAssembly and ships it as files. That remains a
viable future option and is genuinely serverless, but it is a heavyweight addition (a Quarto
extension plus a multi-megabyte WASM payload per page) and is not needed for v1.

Fixtures:

```text
vault/research/interactive-ojs.qmd       reactive input, derived cell, Plot chart, Inputs.table
vault/research/interactive-widgets.qmd   jslink slider/progress/text, Tab container, ipyleaflet map
```

`vault/pyproject.toml` gained `ipywidgets` and `ipyleaflet`, re-locked with `uv`.

### The AMD collision

Both technologies work, but getting them to coexist with Quartz exposed a genuine conflict that the
Plotly fixture had only hinted at.

Quartz loads its graph libraries — **d3 and PIXI, both UMD bundles** — lazily at runtime. A UMD
bundle checks for an AMD loader first: if `define.amd` exists, it registers as a module and **never
sets its global**. Quarto's computational output frequently installs exactly such a loader:

```text
Plotly       ships a RequireJS shim it does not actually need
ipywidgets   ships embed-amd.js, which REQUIRES a loader and throws
             "define is not defined" without one
```

This produced a pair of mutually exclusive failures:

```text
RequireJS stripped  ->  Plotly fine, graph fine   |  ipywidgets do not render at all
RequireJS kept      ->  ipywidgets render         |  window.d3 undefined, graph dead,
                                                  |  "Mismatched anonymous define() module",
                                                  |  and the poisoned require context also
                                                  |  breaks third-party widget bundles
```

Note the second row's sting: leaving RequireJS in place damaged *both* sides, because the rejected
anonymous `define()` from d3 corrupts the require context that `ipyleaflet` later needs.

### Resolution

Two rules, both in `quartoPageHtml.ts`:

1. **Strip the AMD shim only when nothing on the page consumes AMD.** A page carrying
   `embed-amd.js` keeps its loader; a page that merely carries Plotly does not.
2. **Preload Quartz's UMD libraries as classic scripts at the top of the fragment**, before any
   module or AMD loader the document brings with it. They then execute during parsing, populate
   their globals, and are immune to whatever loader appears afterwards. The URLs are supplied from
   `quartz.ts` via `QuartoPage({ preloadScripts: [...] })` so they stay next to the Quartz config
   rather than hardcoded in the extractor.

Rule 2 also fixed an unrelated d3 race that had been breaking the graph on the Observable page.

### Verified in the browser

**Observable JS** — zero console errors. Moving `viewof cutoff` from 1000 to 50 propagated through
three dependent cells simultaneously: the `md` readout (7 → 3 points), `Inputs.table` (7 → 3 rows),
and `Plot.plot` (7 → 3 marks). `ojs_define` carried the Python-computed series into the runtime
intact. Quartz's Explorer, Graph View, and TOC all render around it.

**Jupyter Widgets** — the `jslink` slider drives the progress bar and number field with no kernel;
the `Tab` container switches panes; **`ipyleaflet` renders a live, pannable OpenStreetMap map**,
proving the widget manager resolves third-party bundles beyond the built-in control set. Quartz's
graph works on the same page.

**Plotly** — unchanged, still interactive, still passing its own validation.

Regression coverage: four cases in `quartoPage.test.ts` and a new
`scripts/validate-interactive-components.sh`, which asserts the runtime markers, the conditional
RequireJS rule in both directions, and the byte-offset ordering of the d3 preload against each
page's module loader.

### Residual issues, none blocking

- Quarto emits **no `require.config` paths**, so the widget manager first probes
  `/<dir>/jupyter-leaflet.js` and 404s before falling back. Cosmetic; reproduces in plain Quarto.
- Quartz's `katex copy-tex` helper is loaded after RequireJS on widget pages and logs one
  "Mismatched anonymous define". Copy-tex silently does not register. Cosmetic.
- `@jupyter-widgets/html-manager@*` is an **unpinned** CDN reference, worse than `katex@latest`.
  Pin both before publishing.
- Widget chrome and `Inputs.table` rendered on white backgrounds in dark mode. Closed by Phase 11:
  both are overridden from Quartz theme variables, with `!important` because a library that injects
  its stylesheet at runtime is unlayered and outranks Quartz's `@layer quartz-base`.

---

## Phase 7 — Establish Vault Conventions

Once the experiments pass, freeze the authoring contract:

```text
.md vs .qmd usage
wikilinks as source syntax
attachment root
frontmatter keys
publish:true policy
citation syntax
MathJax conventions
supported cross-renderer Markdown subset
```

Do this before the vault grows substantially.

---

## Phase 8 — Minimal Production Quartz Site

Configure only:

```text
homepage
content pages
Explorer/navigation
search
backlinks
graph
ExplicitPublish
citations
MathJax
basic theme
```

Avoid custom UI beyond what is needed for the Quarto boundary.

---

## Phase 9 — Publication Prep

Implement `prepare-publication.ts` to:

```text
select publish:true source files
copy public .md
create .qmd stubs
copy only allowed attachments
build link-map.json
validate frontmatter
validate internal links
validate publication leaks
```

Keep it deliberately smaller than a general content compiler.

---

### Phase 9 implementation status — 2026-08-23

**Implemented.** `scripts/prepare-publication.ts` builds the entire public tree from the vault, and
all eight validation scripts pass against a full `npm run build`.

The vault became the source of truth in the process. The staged Markdown that previously lived in
`generated/quartz-content/` was moved into `vault/` and given `publish: true`; `generated/` is now
git-ignored in full, because every file under it is derivable. `npm run build` runs the section 28
order: prep, `quarto render`, prep again with `--require-quarto`, then `quartz build`.

Current run: 14 of 16 vault documents staged, 4 of them QMD stubs, 1 attachment copied.

What prep enforces, all as build-stopping failures:

```text
frontmatter        title present; publish boolean; aliases/tags lists of strings
slugs              published paths must already be slug-safe; no .md/.qmd URL collision
identity           no two published notes claim the same title or alias
links              every relative Markdown link resolves
privacy            a link to an unpublished note is reported as such, not as "broken"
attachments        only files under vault/attachments/ referenced by published content
artifacts          generated/quarto/ contains output for published .qmd and nothing else
freeze             vault/_freeze/ holds frozen output only for published documents
```

There is one resolution rule and no precedence: a target is a path from the vault folder. Obsidian
(`newLinkFormat: absolute`), prep, and Quartz (`markdownLinkResolution: absolute`) all read it that
way, so they cannot disagree about where a link goes.

`ExplicitPublish` is now enabled as layer 2 (section 22.1). It filters out zero files, which is the
expected result: prep already guarantees the invariant it checks.

**Decisions worth reviewing.**

`generated/link-map.json` is written but has no consumer. Experiment 6 resolved wikilinks through
Quartz's own file index and explicitly avoided this artifact. It is kept because Phase 9 names it and
because it makes the resolution contract inspectable, but if nothing reads it by Phase 13 it should
be deleted rather than maintained.

An attachment becomes public by being referenced. Attachments carry no frontmatter, so reference is
the only available signal; the allowlist is the `vault/attachments/` subtree, and a link that
escapes it does not resolve. Private binaries therefore belong outside that folder.

Published paths must already be slug-safe (`lowercase-words-with-hyphens`). Quartz would slugify a
title like `Monte Carlo.md` on its own, but Quarto derives its output path from the filename, so one
rule for both renderers is what keeps `stub slug == Quarto URL` true. Private notes are unconstrained.

Page dates no longer come from git. The staged tree is untracked, so prep copies each source file's
timestamps onto its staged derivative and `created-modified-date` runs `frontmatter, filesystem`.
Notes that need an authoritative date should carry one in frontmatter.

Prep clears `generated/quarto/` in stage mode, as the `output-dir` note requires, and leaves it
untouched under `--require-quarto`. That immediately found a latent false pass: with
`format.html.minimal`, Quarto emits only the dependencies a page references, and
`validate-quarto-emitter.sh` was asserting on `libs/quarto-html/quarto.js` — a leftover from a render
predating `minimal: true`. The assertion now checks the dependency the page actually loads. Anything
that only passes because of an uncleaned output tree is worth re-checking on a wiped `generated/`.

**Residual gap.** Quarto's render allowlist is path-based, not publish-aware: an unpublished `.qmd`
under `research/` is still rendered into `generated/quarto/`. Prep detects the resulting artifact and
fails the build, but it detects it *after* the render rather than preventing it. Closing this
properly means generating the render list from publication state, which belongs with Phase 14.

**Stub drift is now impossible by construction.** Regenerating every stub from source produced files
byte-identical to the committed ones apart from the newly added `sourceType: quarto` key, and no
build path exists that skips regeneration.

---

## Phase 10 — Quarto Bridge

Package the tested Page Type override and Emitter behaviour cleanly.

The bridge has three required responsibilities:

```text
select a dedicated Quartz Page Type for QMD stubs
extract minimal Quarto bodies into the Quartz content frame
copy Quarto dependency artifacts to their canonical URLs
```

Add more only when a concrete requirement appears.

---

### Phase 10 implementation status — 2026-08-23

**Implemented.** All three responsibilities were already working when Phase 9 closed; what Phase 10
changed is where they live and how they attach to Quartz.

The bridge moved out of the vendored tree into `site/bridge/`:

```text
bridge/index.ts                the bridge's public surface, and the only thing quartz.ts imports
bridge/quartoPage.tsx          the Page Type for quartoStub: true Markdown
bridge/quartoPageHtml.ts       minimal-body extraction and source-link resolution
bridge/quartoArtifacts.ts      the dependency-artifact Emitter
bridge/styles/quartoPage.scss  styling scoped beneath .quarto-page
```

`quartz.ts` now reads `import { QuartoArtifacts, QuartoPage } from "./bridge"`. Nothing else in the
project reaches into bridge internals, so the three responsibilities can be re-implemented behind
that one import — including as a `quartz-community` package, if section 30's "if the bridge proves
generally useful" ever comes true.

**One upstream file is still patched, deliberately.** The vendored tree was diffed against the
pinned commit (`075afd3`) to make the claim checkable rather than hopeful. Inside `quartz/`, exactly
one file differs: `components/scripts/spa.inline.ts`. The other differences are project-owned files
at the root — `quartz.ts`, `quartz.config.yaml`, `tsconfig.json`, and `package.json`.

That patch exists because Quarto's scripts initialize on a full document load and have no Quartz
`nav`/cleanup handlers, so navigation across the renderer boundary must leave the SPA lifecycle. It
was rewritten to carry no Quarto knowledge: the router now honours a generic `data-spa-exclude`
marker on a page's root element, and the bridge is what sets it. Any Page Type whose body brings its
own document-lifecycle scripts can use the same opt-out.

```text
before   spa.inline.ts asked whether the page was article.quarto-page
after    spa.inline.ts asks whether any element claims data-spa-exclude
```

**Why the marker cannot be replaced by link marking.** `QuartoPage` already tags content links to
Quarto pages with `data-router-ignore`, but tree transforms only reach the content tree — not the
Explorer, the header, or the graph and search components, which navigate programmatically through
`spaNavigate`. Checking the fetched document is the only place that catches every entry path.

Both directions were verified in a browser against the built site: entering a Quarto page through
`spaNavigate` destroys the JavaScript context (a full load) and the page's Plotly and Matplotlib
output renders; leaving one through a frame link does the same; navigation between two ordinary
Quartz pages stays in the SPA.

**Newly covered by tests.** `QuartoArtifacts` had only end-to-end coverage. It now has unit tests for
the contract it is easy to get wrong: relative paths are preserved, `.html` is excluded when asked,
a symlink in the artifact tree is refused rather than followed, and a missing artifact directory
fails loudly. `validate-quarto-emitter.sh` additionally asserts the boundary marker — present on the
Quarto page, absent from an ordinary page, honoured by the emitted router bundle.

**Residual gap.** The bridge reads `generated/quarto/` twice, once per responsibility: the Page Type
reads each artifact HTML, the Emitter copies everything except HTML. That is why `includeHtml: false`
has to be passed at the call site, and why an artifact for an unpublished document would be copied if
prep had not already failed the build. A single artifact index shared by both halves would remove
the coupling; it is not worth building until Phase 14 makes the render list publication-aware.

---

## Phase 11 — Shared Visual Language

Create shared design tokens for both renderers:

```text
colors
typography
spacing
content width
light/dark theme variables
```

Quartz now supplies shared navigation directly through the `QuartoPage` frame. Keep Quarto-specific styling scoped beneath `.quarto-content` and derive it from Quartz theme variables.

---

### Phase 11 implementation status — 2026-08-23

**Implemented.** `vault/_theme/tokens.yaml` is now the only place a colour, font, or chart value is
written down. `scripts/generate-design-tokens.ts` projects it into the four consumers that cannot
read YAML at build time, and `--check` proves none has drifted:

```text
site/quartz.config.yaml                          configuration.theme + the fonts plugin, between markers
site/bridge/styles/quartoTokens.scss             CSS custom properties and the pandoc-class mixin
vault/_theme/knowledge_theme/tokens.json         the token tree, for the Python side
vault/_theme/knowledge_theme/knowledge.mplstyle  matplotlib rc derived from the chart tokens
```

`npm run design-tokens` rewrites them; `npm run build` runs `--check` first and fails on a stale one.

**The work splits three ways, by what can actually reach the pixels.**

*CSS, for markup inside the Quartz frame.* `bridge/styles/quartoPage.scss` grew from a stub to a
full sheet, still scoped beneath `.quarto-page`. Every value in it is a Quartz theme variable or a
`--qmd-*` token — a validation step fails the build on a literal hex — so the Quarto fragment
follows the theme toggle without knowing the toggle exists. The largest addition is code
highlighting: Quartz colours Markdown code with shiki's `github-light`/`github-dark`, and pandoc
under `minimal: true` emits its token classes with no colours at all, so a Python cell used to
render as flat text beside a fully highlighted fenced block. The generated mixin colours those
classes from the same GitHub Primer values shiki uses.

*Runtime, for output CSS cannot reach.* Plotly keeps its surface, axis and hover colours in the
figure JSON and writes them into inline SVG attributes at draw time. `bridge/scripts/quartoTheme`
rewrites them from the same theme variables on load, whenever a figure appears late, and on every
`themechange`. This is strictly better than a build-time fix: a live figure gets the theme's real
text colour rather than a compromise neutral.

*Build time, for output that is rasterised once.* `vault/_theme/knowledge_theme` is a uv path
dependency of the vault environment exposing `apply()`, which installs the generated matplotlib
style and registers a Plotly template with transparent surfaces and the shared palette. A document
that draws figures calls it once in a hidden setup cell.

**One colour cannot be a theme variable, and the tokens say so.** A matplotlib figure is rasterised
once and served to both themes. No single ink can clear the 4.5:1 AA text threshold against both
page backgrounds — 4.35:1 and 3.91:1 is the best available pair — so `chart.ink` and the six
`chart.series` colours are chosen to maximise the smaller ratio, and the generator refuses to emit
any chart colour below the 3:1 WCAG 1.4.11 floor on either ground. That check is what stops someone
tuning a chart for light mode and losing it in dark.

**`configuration.theme` is inert, and this matters.** The site loads `@quartz-themes/core`, whose
Obsidian theme CSS is injected *unlayered*; Quartz emits its own palette inside `@layer
quartz-base`, and unlayered declarations beat layered ones at any specificity. The browser resolves
`--light` to `#ffffff` and `#1C1C1C`, not to the values in `quartz.config.yaml`. Two consequences:

- `chart.grounds` in `vault/_theme/tokens.yaml` records the backgrounds that actually ship, separately
  from `colors.*.light`, so the legibility check measures a palette someone can see.
- Every rule in `quartoPage.scss` that overrides a colour a third-party script painted —
  `Inputs.table`'s white sticky header, widget chrome, Leaflet, the Plotly modebar — carries
  `!important`. That is the cascade-layer rule, not specificity padding; the rules that merely
  restate a Quartz convention do not need it.

  Deciding whether the theme plugin or `configuration.theme` should own the palette is a real
  choice and is deferred, not resolved. Until it is made, the generated theme block is documentation
  of intent rather than the live palette.

**Covered by tests.** `scripts/generate-design-tokens.test.ts` (12 cases) covers token validation,
the contrast floor in both directions, marker replacement, and that all four projections are
current. `site/bridge/quartoTheme.test.ts` (5 cases) covers the Plotly update: no white survives, no
colour that is not a theme variable appears, every declared axis is touched, and no axis the figure
does not declare is named — `relayout` would otherwise draw one.
`scripts/validate-shared-visual-language.sh` asserts the end-to-end claims against the built site.

**Residual gaps.**

- The matplotlib figure remains the one piece that cannot follow the toggle. Inlining the SVG
  through the bridge would make it fully theme-reactive and is the obvious next move if a static
  figure ever carries text that matters; it needs id-namespacing and is not worth it yet.
- The Observable and widget chrome rules beyond `Inputs.table` are written from the libraries'
  published class names but only `Inputs.table`, Observable Plot, and Plotly have been checked in a
  browser. The Leaflet and Lumino rules are unverified.
- Spacing and content width are inherited from the Quartz frame rather than tokenised. Nothing in
  the Quarto fragment sets its own width, so there is currently no divergence to reconcile.


---

## Phase 12 — Reproducibility

Add lockfiles/environments to computational projects that matter.

Commit `_freeze/` output for published computational documents when CI should not execute them.

---

## Phase 13 — Deployment

Choose the static host and CI strategy.

Verify:

```text
clean URLs
Quarto dependency paths
SPA/full-page transitions
404 behaviour
RSS/sitemap URLs
cache headers
preview builds
```

---

## Phase 14 — Automation

Only after each stage works independently, create one build command:

```bash
bun run build
```

Conceptually:

```text
validate vault
      ↓
prepare publication staging + link map
      ↓
prepare/render Quarto artifacts
      ↓
build Quartz
      ↓
validate final output
      ↓
static site
```

---

## Phase 15 — Optimize Only When Necessary

Possible later improvements:

- incremental QMD stub generation
- dependency-aware Quarto rendering
- a Quartz-native virtual QMD Page Type
- packaging the bridge as a reusable Quartz plugin
- richer metadata on Quarto pages
- Quarto-side backlinks
- shared navigation/footer components
- asset fingerprinting
- deployment caching
- CI broken-link checks
- cross-renderer explicit heading IDs

The first objective is to prove this loop:

```text
write in Obsidian
       ↓
edit code in Neovim / VS Code
       ↓
render with Quarto
       ↓
generate QMD stub
       ↓
index + publish with Quartz v5
       ↓
follow links seamlessly between .md and .qmd pages
```

Once that loop works reliably, expand the system without rebuilding functionality Quartz already provides.
