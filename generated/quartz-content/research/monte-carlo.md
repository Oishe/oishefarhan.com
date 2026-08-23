---
title: Monte Carlo Simulation
description: Approximation by repeated random sampling.
aliases:
  - Monte Carlo
  - Monte Carlo Simulation
tags:
  - research/computation
publish: true
format: html
execute:
  freeze: true
  cache: true
quartoStub: true
sourcePath: "vault/research/monte-carlo.qmd"
---

Monte Carlo methods approximate quantities by repeated random sampling. They connect [[Probability]] to practical [[Statistics]].

## Sampling

For samples $X_1, \ldots, X_n$, estimate an expectation with

$$
\hat{\mu}_n = \frac{1}{n}\sum_{i=1}^n X_i.
$$

## Convergence

The approximation generally improves as the number of samples grows. See [[Bayesian Inference]] for a common application.
