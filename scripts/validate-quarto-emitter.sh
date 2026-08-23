#!/bin/sh
set -eu

quarto_page="site/public/research/monte-carlo.html"
dependency_root="site/public/research/monte-carlo_files"

test -f "$quarto_page"
test -f "$dependency_root/libs/quarto-html/quarto.js"
test -f "$dependency_root/libs/clipboard/clipboard.min.js"

grep -Fq '<meta name="generator" content="Quartz"' "$quarto_page"
grep -Fq 'id="quartz-root"' "$quarto_page"
grep -Fq 'class="explorer nav-files-container"' "$quarto_page"
grep -Fq 'class="popover-hint quarto-page"' "$quarto_page"
grep -Fq 'class="quarto-content"' "$quarto_page"
grep -Fq '<pre><code>0.49</code></pre>' "$quarto_page"
grep -Fq 'href="../concepts/probability" class="internal internal-link"' "$quarto_page"
grep -Fq 'href="../concepts/statistics" class="internal internal-link"' "$quarto_page"
grep -Fq 'href="../concepts/bayesian-inference" class="internal internal-link"' "$quarto_page"

if grep -Fq '[[Probability]]' "$quarto_page" || grep -Fq '[[Statistics]]' "$quarto_page"; then
  printf '%s\n' 'Literal QMD wikilinks leaked into the unified page.' >&2
  exit 1
fi

if grep -Fq 'quarto-bootstrap' "$quarto_page" || grep -Fq 'libs/bootstrap' "$quarto_page"; then
  printf '%s\n' 'Quarto Bootstrap resources leaked into the Quartz page shell.' >&2
  exit 1
fi

grep -Fq '"research/monte-carlo"' site/public/static/contentIndex.json
grep -Fq '../research/monte-carlo' site/public/concepts/probability.html
test -f site/public/monte-carlo-simulation.html
grep -Fq '.math.display' site/quartz/plugins/pageTypes/styles/quartoPage.scss

printf '%s\n' 'Unified Quartz and Quarto page validation passed.'
