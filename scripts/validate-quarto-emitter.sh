#!/bin/sh
set -eu

quarto_page="site/public/research/monte-carlo.html"
dependency_root="site/public/research/monte-carlo_files"

test -f "$quarto_page"
# With format.html.minimal, Quarto emits only the dependencies the page really
# uses -- no quarto-html or Bootstrap. The emitter must copy exactly those.
test -f "$dependency_root/libs/clipboard/clipboard.min.js"
grep -Fq 'monte-carlo_files/libs/clipboard/clipboard.min.js' "$quarto_page"

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

# --- Computational payload: figures, tables, and interactive widgets ---------
# The trivial monte-carlo fixture cannot exercise the reason this bridge extracts
# an HTML fragment instead of using an iframe. convergence-diagnostics carries a
# Matplotlib figure, a pandas table, and a live Plotly widget.

widget_page="site/public/research/convergence-diagnostics.html"
widget_deps="site/public/research/convergence-diagnostics_files"

test -f "$widget_page"
test -f "$widget_deps/figure-html/static-figure-output-1.png"

grep -Fq 'class="quarto-content"' "$widget_page"
grep -Fq 'convergence-diagnostics_files/figure-html/static-figure-output-1.png' "$widget_page"
grep -Fq '<table' "$widget_page"
grep -Fq 'plotly-graph-div' "$widget_page"
grep -Fq 'Plotly.newPlot' "$widget_page"
grep -Fq 'cdn.plot.ly/plotly-3.7.0.min.js' "$widget_page"

# Jupyter widget output ships a RequireJS/AMD shim. Left in the Quartz shell it
# defines a global define.amd, which makes Quartz's own UMD bundles register as
# AMD modules rather than setting their globals -- the graph and search
# components then fail at runtime with "Libraries not loaded".
for shim in 'requirejs' 'backupDefine' "define('jquery'"; do
  if grep -Fq "$shim" "$widget_page"; then
    printf '%s\n' "AMD shim '$shim' leaked into the Quartz shell; it breaks graph/search library loading." >&2
    exit 1
  fi
done

# Plotly's bare ESM preload omits the .js extension and 403s; the cell's own
# script tag is the real loader.
if grep -Eq 'import "https://cdn\.plot\.ly/[^"]*[^s]"' "$widget_page"; then
  printf '%s\n' 'Broken extensionless Plotly ESM preload leaked into the page.' >&2
  exit 1
fi

grep -Fq '"research/convergence-diagnostics"' site/public/static/contentIndex.json
test -f site/public/mc-diagnostics.html

printf '%s\n' 'Unified Quartz and Quarto page validation passed.'
