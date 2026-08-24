#!/bin/sh
set -eu

quarto_page="site/public/examples/computational-features.html"
dependency_root="site/public/examples/computational-features_files"
interactive_page="site/public/examples/interactive-features.html"
plain_page="site/public/examples/markdown-features.html"
content_index="site/public/static/contentIndex.json"

test -f "$quarto_page"
test -f "$interactive_page"
test -f "$plain_page"

# With format.html.minimal, Quarto emits only the dependencies a page uses.
test -f "$dependency_root/libs/clipboard/clipboard.min.js"
grep -Fq 'computational-features_files/libs/clipboard/clipboard.min.js' "$quarto_page"

# Quarto content must live inside the normal Quartz page frame.
grep -Fq '<meta name="generator" content="Quartz"' "$quarto_page"
grep -Fq 'id="quartz-root"' "$quarto_page"
grep -Fq 'class="explorer nav-files-container"' "$quarto_page"
grep -Fq 'class="popover-hint quarto-page"' "$quarto_page"
grep -Fq 'class="quarto-content"' "$quarto_page"
grep -Fq '<table' "$quarto_page"
grep -Fq 'plotly-graph-div' "$quarto_page"
grep -Fq 'Plotly.newPlot' "$quarto_page"

if grep -Fq '[[Markdown Features]]' "$quarto_page" || grep -Fq '[[Interactive Features]]' "$quarto_page"; then
  printf '%s\n' 'Literal QMD wikilinks leaked into the unified page.' >&2
  exit 1
fi

if grep -Fq 'quarto-bootstrap' "$quarto_page" || grep -Fq 'libs/bootstrap' "$quarto_page"; then
  printf '%s\n' 'Quarto Bootstrap resources leaked into the Quartz page shell.' >&2
  exit 1
fi

grep -Fq '"examples/computational-features"' "$content_index"
grep -Fq '"examples/interactive-features"' "$content_index"
test -f site/public/quarto-features.html
test -f site/public/browser-interactivity.html
grep -Fq '.math.display' site/bridge/styles/quartoPage.scss

# Quarto scripts initialize on a full document load, so navigation into or out
# of a Quarto page leaves Quartz's SPA lifecycle.
grep -Fq 'data-spa-exclude' "$quarto_page"
if grep -Fq 'data-spa-exclude' "$plain_page"; then
  printf '%s\n' 'A plain Quartz page claims the SPA exclusion marker.' >&2
  exit 1
fi
if ! grep -rlFq 'querySelector("[data-spa-exclude]")' site/public/static/scripts >/dev/null 2>&1; then
  printf '%s\n' 'The emitted SPA router does not honour the data-spa-exclude marker.' >&2
  exit 1
fi

# The consolidated computation fixture carries a Matplotlib figure, a pandas
# table, and a live Plotly widget.
test -f "$dependency_root/figure-html/fig-static-convergence-output-1.png"
grep -Fq 'computational-features_files/figure-html/fig-static-convergence-output-1.png' "$quarto_page"
grep -Fq 'cdn.plot.ly/plotly-3.7.0.min.js' "$quarto_page"

# A Plotly-only page must not retain the RequireJS shim used by Jupyter widgets.
for shim in 'requirejs' 'backupDefine' "define('jquery'"; do
  if grep -Fq "$shim" "$quarto_page"; then
    printf '%s\n' "AMD shim '$shim' leaked into the Plotly-only page." >&2
    exit 1
  fi
done

# Plotly's bare ESM preload omits the .js extension and 403s; the cell's own
# script tag is the real loader.
if grep -Eq 'import "https://cdn\.plot\.ly/[^"]*[^s]"' "$quarto_page"; then
  printf '%s\n' 'Broken extensionless Plotly ESM preload leaked into the page.' >&2
  exit 1
fi

# The companion page verifies the opposite loader branch: widget state and its
# AMD manager must survive extraction.
grep -Fq 'application/vnd.jupyter.widget-state+json' "$interactive_page"
grep -Fq 'embed-amd.js' "$interactive_page"
grep -Fq 'requirejs' "$interactive_page"

printf '%s\n' 'Unified Quartz and Quarto page validation passed.'
