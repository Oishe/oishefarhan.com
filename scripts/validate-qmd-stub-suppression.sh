#!/bin/sh
set -eu

stub_html="generated/fixture-site/examples/computational-features.html"
content_index="generated/fixture-site/static/contentIndex.json"

test -f "$stub_html"
grep -Fq 'id="quartz-root"' "$stub_html"
grep -Fq 'class="popover-hint quarto-page"' "$stub_html"
grep -Fq 'class="quarto-content"' "$stub_html"
test -f generated/fixture-site/examples/markdown-features.html
test -f generated/fixture-site/quarto-features.html

grep -Fq '"examples/computational-features"' "$content_index"
grep -Fq '../examples/computational-features' generated/fixture-site/examples/index.html

printf '%s\n' 'QMD stub custom Page Type validation passed.'
