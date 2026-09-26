---
title: Articles
description: Technical writing on science and engineering.
tags:
  - site/section
publish: true
toc: false
listing:
  id: section-listing
  contents:
    - "*.qmd"
    - "*.md"
  # Listings glob the filesystem, not the render list. Without this a draft
  # beside a published article is linked here and its source is copied into the
  # site. Prep fails the build if a listing drops it.
  include:
    publish: true
  type: default
  sort: "date desc"
  fields: [title, description, date]
  filter-ui: false
  sort-ui: false
---

These articles explore topics I find interesting. My current focus is on data-driven
science and engineering. I combine explanations with interactive explorations.
