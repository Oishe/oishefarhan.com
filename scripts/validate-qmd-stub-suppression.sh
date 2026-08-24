#!/bin/sh
set -eu

stub_html="site/public/examples/computational-features.html"
content_index="site/public/static/contentIndex.json"

test -f "$stub_html"
grep -Fq 'id="quartz-root"' "$stub_html"
grep -Fq 'class="popover-hint quarto-page"' "$stub_html"
grep -Fq 'class="quarto-content"' "$stub_html"
test -f site/public/examples/markdown-features.html
test -f site/public/quarto-features.html

grep -Fq '"examples/computational-features"' "$content_index"
grep -Fq '../examples/computational-features' site/public/examples/index.html

printf '%s\n' 'QMD stub custom Page Type validation passed.'
