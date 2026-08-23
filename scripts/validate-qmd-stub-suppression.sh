#!/bin/sh
set -eu

stub_html="site/public/research/monte-carlo.html"
content_index="site/public/static/contentIndex.json"

test -f "$stub_html"
grep -Fq 'id="quartz-root"' "$stub_html"
grep -Fq 'class="popover-hint quarto-page"' "$stub_html"
grep -Fq 'class="quarto-content"' "$stub_html"
test -f site/public/research/citation-demo.html
test -f site/public/monte-carlo-simulation.html

grep -Fq '"research/monte-carlo"' "$content_index"
grep -Fq '../research/monte-carlo' site/public/concepts/probability.html
grep -Fq '../research/monte-carlo' site/public/concepts/statistics.html

printf '%s\n' 'QMD stub custom Page Type validation passed.'
