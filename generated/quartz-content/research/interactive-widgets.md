---
title: Jupyter Widgets
description: Validating ipywidgets interactivity through the Quarto-to-Quartz bridge.
aliases:
  - Jupyter Widgets
  - ipywidgets
tags:
  - research/computation
  - research/interactive
publish: true
format: html
execute:
  freeze: true
  cache: true
quartoStub: true
sourcePath: "vault/research/interactive-widgets.qmd"
---

Jupyter Widgets let a Python author place JavaScript components on the page. There is no
Python kernel behind a published site, so only the JavaScript half survives — the widget
renders and responds to the reader, but it cannot call back into Python. This note checks
that the surviving half arrives intact through the bridge described in
[[Monte Carlo Simulation]].

## Widget state without a kernel

The reliable pattern is `jslink`, which wires two widgets together entirely in the browser.
Dragging the slider below must move the progress bar and update the number, with no server
involved.

## A container widget

Tabs exercise the widget manager's layout handling rather than a single leaf control.

## A third-party widget

`ipyleaflet` is a separate widget package with its own JavaScript bundle. It checks that the
widget manager resolves modules beyond the built-in `@jupyter-widgets/controls` set. The map
should pan and zoom.

Compare with the Observable approach in [[Observable JS]].
