---
title: Hello World
description: Phase 0 smoke test — wikilinks, math, and the vault-to-site pipeline.
tags:
  - meta
---

This post exists to prove one thing: a file in the Obsidian vault becomes a page on the
site, with wikilinks and math intact and nothing else in between.

## A wikilink

Back to the [[index|front page]]. If that link resolves both in Obsidian's editor and on
the deployed site, the content pipeline is wired correctly.

## Some math

Inline first: the DFT of a length-$N$ signal is a change of basis, nothing more.

$$
X_k = \sum_{n=0}^{N-1} x_n \, e^{-i 2\pi k n / N}
$$

Written that way it looks like an algorithm. Written as $X = F x$, with $F$ the matrix
whose rows are complex exponentials, it looks like what it is — measuring the same vector
against a different set of axes.

That reframing is the whole reason this site exists, and it is also why the interactive
figures here need no numerical runtime: a change of basis is a matrix multiply, and a
matrix multiply is twenty lines of JavaScript.
