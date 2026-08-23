---
title: Convergence Diagnostics
description: Reading Monte Carlo error curves from tables, figures, and interactive plots.
aliases:
  - Convergence Diagnostics
  - MC Diagnostics
tags:
  - research/computation
publish: true
format: html
execute:
  freeze: true
  cache: true
quartoStub: true
sourcePath: "vault/research/convergence-diagnostics.qmd"
---

Estimator error shrinks as samples accumulate, but the rate matters more than the
direction. This note works through that rate for the estimator defined in
[[Monte Carlo Simulation]], using the error conventions from [[Statistics]].

## The rate

For independent samples with finite variance $\sigma^2$, the standard error of the
sample mean is

$$
\operatorname{SE}(\bar{X}_n) = \frac{\sigma}{\sqrt{n}},
$$

so absolute error should fall roughly as $n^{-1/2}$. A log-log plot of error against
sample size should therefore be a line of slope $-\tfrac{1}{2}$.

## Tabulated estimates

## Static figure

## Interactive figure

Hovering the series below reads off the error at each sample size. This cell is the
reason the publishing bridge extracts a Quarto body rather than an iframe: the widget
has to stay live inside the Quartz page frame.

## Reading the result

Both renderings agree with the $n^{-1/2}$ rate. See [[Bayesian Inference]] for the
case where correlated draws break the independence assumption above.
