---
title: Markdown Features
description: A compact publishing check for prose Markdown — callouts, tasks, links, citations, and attachments.
tags:
  - examples/markdown
publish: false
fixture: true
---

# Markdown Features

This temporary page checks the prose side of the publishing boundary. Its aliases exercise
alternate URLs, while [Computational Features](computational-features.qmd) supplies a backlink.

## Callouts, tasks, and highlighting

::: {.callout-note}
## Quarto callout

Quarto emits callout markup whenever Bootstrap is loaded, which it is now that Quarto owns the
chrome. Under the old fragment architecture this degraded to a bare blockquote.
:::

::: {.callout-warning collapse="true"}
## Collapsible warning

This content should start collapsed.
:::

- [x] Parse task lists
- [ ] Replace this fixture with real notes

Highlighted text uses <mark>an HTML mark element</mark>.

## Mathematics and citation

Inline mathematics such as $P(A \mid B)$ and display mathematics should share the site theme:

$$
P(A \mid B) = \frac{P(A \cap B)}{P(B)}.
$$

Digital gardens connect ideas through contextual links [@bernstein1998]. A conventional footnote
also renders here.[^note]

[^note]: This footnote exists only to exercise the Markdown renderer.

## Cross-note reference

Definitions live in their own note and are linked rather than embedded:
[Shared Definition](shared-definition.md).

## Attachment

Publication prep copies an attachment only when published content references it.

![Monte Carlo estimate converging](../attachments/convergence.svg)

The same file is available as an [ordinary Markdown link](../attachments/convergence.svg).

Return to [Publishing Examples](index.md).
