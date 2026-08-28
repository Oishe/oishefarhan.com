---
title: Publishing Examples
description: Temporary pages that exercise the prose and computational halves of the publishing boundary.
tags:
  - site/examples
publish: false
fixture: true
---

# Publishing Examples

These pages preserve the unique publishing checks from the original fixture notes in a compact,
flat section. They can be deleted once real content exercises the same capabilities.

- [Markdown Features](markdown-features.md) covers Obsidian syntax, links, citations, and attachments.
- [Computational Features](computational-features.qmd) covers Python, tables, and static and interactive
  figures.
- [Interactive Features](interactive-features.qmd) covers Observable JS and browser-only Jupyter widgets.

## Parked

The two long-form `.qmd` fixtures are `publish: false` while the site design work runs against a
single substantial Quarto page. Their frozen output is held in `vault/_freeze-parked/`; see the
README there for how to bring one back.

- `examples/a-signal-is-a-vector-python.qmd` — the Python-first rebuild of a published article, kept
  as the worked record of what NumPy, matplotlib, and `ojs_define` cost against pure Observable.
- `examples/a-signal-is-a-vector.qmd` — the pure Observable original, superseded by
  [Signals as Vectors](../articles/signals-as-vectors.qmd).

An additional `publish: false` canary remains in this folder but must never appear on the website.
