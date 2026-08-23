---
title: Observable JS
description: Validating Observable JS reactivity and the Python-to-OJS data handoff.
aliases:
  - Observable JS
  - OJS
tags:
  - research/computation
  - research/interactive
publish: true
format: html
execute:
  freeze: true
  cache: true
quartoStub: true
sourcePath: "vault/research/interactive-ojs.qmd"
---

Observable JS is Quarto's native client-side reactive runtime. Unlike Jupyter Widgets it
needs no widget manager: cells re-evaluate in dependency order in the browser. This note
checks that the runtime survives extraction into the Quartz page frame, and that data
computed in Python reaches it. Background in [[Monte Carlo Simulation]].

## Handing data from Python to Observable

`ojs_define` serialises a Python value into the page for the Observable runtime to pick up.

## A reactive input

Moving the slider must recompute the filtered table and the chart below it without a page
reload. This is the core reactivity test: if the runtime failed to initialise, the input
would not render at all.

## A reactive chart

## A reactive table

Compare with the widget approach in [[Jupyter Widgets]].
