#!/bin/sh
set -eu

quarto_page="generated/fixture-site/examples/computational-features.html"
dependency_root="generated/fixture-site/examples/computational-features_files"
interactive_page="generated/fixture-site/examples/interactive-features.html"
plain_page="generated/fixture-site/examples/markdown-features.html"
content_index="generated/fixture-site/static/contentIndex.json"

test -f "$quarto_page"
test -f "$interactive_page"
test -f "$plain_page"

# With format.html.minimal, Quarto emits only the dependencies a page uses.
test -f "$dependency_root/libs/clipboard/clipboard.min.js"
grep -Fq 'computational-features_files/libs/clipboard/clipboard.min.js' "$quarto_page"

# Quarto content must live inside the normal Quartz page frame.
grep -Fq '<meta name="generator" content="Quartz"' "$quarto_page"
grep -Fq 'id="quartz-root"' "$quarto_page"
grep -Fq 'data-frame="default"' "$quarto_page"
grep -Fq 'class="page-header"' "$quarto_page"
grep -Fq 'class="site-nav"' "$quarto_page"
grep -Fq 'class="popover-hint quarto-page"' "$quarto_page"
grep -Fq 'class="quarto-content"' "$quarto_page"
grep -Fq '<table' "$quarto_page"
grep -Fq 'plotly-graph-div' "$quarto_page"
grep -Fq 'Plotly.newPlot' "$quarto_page"

# Links in a Quarto artifact are resolved by the bridge, not the Quartz link
# crawler, so an unresolved source-file href is the failure mode to catch.
if grep -Eq 'href="[^"]*\.(md|qmd)"' "$quarto_page"; then
  printf '%s\n' 'Unresolved source-file link hrefs leaked into the unified page.' >&2
  exit 1
fi

if grep -Fq '[[' "$quarto_page"; then
  printf '%s\n' 'Literal wikilink syntax leaked into the unified page.' >&2
  exit 1
fi

if grep -Fq 'quarto-bootstrap' "$quarto_page" || grep -Fq 'libs/bootstrap' "$quarto_page"; then
  printf '%s\n' 'Quarto Bootstrap resources leaked into the Quartz page shell.' >&2
  exit 1
fi

grep -Fq '"examples/computational-features"' "$content_index"
grep -Fq '"examples/interactive-features"' "$content_index"
test -f generated/fixture-site/quarto-features.html
test -f generated/fixture-site/browser-interactivity.html
grep -Fq '.math.display' site/bridge/styles/quartoPage.scss

# `code-fold: true` wraps cell source in <details class="code-fold">. A
# suppressed cell produces a *hidden* details inside a *visible* .cell, which
# the .cell.hidden rule does not reach -- without its own rule every echo:false
# cell grows an empty disclosure triangle. Quarto's own CSS would carry this,
# but `minimal: true` drops it.
# --- Quarto content features that survive minimal rendering -----------------
# Column layouts and cross-references keep their classes under `minimal: true`;
# callouts do not, which is why they are out of scope. This fixture is the only
# .qmd with no executable cells, so it carries no _freeze/ entry and its prose
# can actually be edited -- a frozen document silently ignores source changes.
layout_page="generated/fixture-site/examples/layout-features.html"
test -f "$layout_page"

grep -Fq 'class="column-page"' "$layout_page"
grep -Fq 'class="column-screen-inset"' "$layout_page"
grep -Fq 'column-margin' "$layout_page"
grep -Fq 'class="quarto-xref"' "$layout_page"
# Numbering is the half a stylesheet cannot fake. Pandoc joins the label to the
# number with a non-breaking space, which the bridge emits as a literal U+00A0
# rather than an entity, so match either side of it rather than the pair.
grep -Eq 'Table.?1' "$layout_page"
grep -Eq 'Section.?2' "$layout_page"

# The breakout is keyed to a value the shell publishes, defaulting to zero. A
# fragment must not guess the room it has: deriving it from the viewport assumes
# the reading column is centred there, which overflowed by 162px against the
# real layout.
grep -Fq -e '--qmd-breakout-page' site/bridge/styles/quartoPage.scss
grep -Fq -e '--qmd-breakout-screen' site/bridge/styles/quartoPage.scss

# .quarto-content must stay in normal flow. Making it a grid is the textbook way
# to do column layouts and it breaks this page: grid items do not collapse
# margins, so every gap between blocks doubled and the article grew 26%.
if grep -A3 'quarto-content {' site/bridge/styles/quartoPage.scss | grep -Eq 'display: *grid'; then
  printf '%s\n' '.quarto-content became a grid; margins stop collapsing and the vertical rhythm doubles.' >&2
  exit 1
fi

grep -Fq 'details.code-fold.hidden' site/bridge/styles/quartoPage.scss
grep -Fq '<details class="code-fold">' "$quarto_page"
# Only a cell that is both folded and suppressed exercises the rule, and the
# Plotly fixture has no suppressed cells -- the OJS article does.
grep -Fq '<details class="code-fold hidden">' generated/fixture-site/articles/signals-as-vectors.html

# Quarto scripts initialize on a full document load, so navigation into or out
# of a Quarto page leaves Quartz's SPA lifecycle.
grep -Fq 'data-spa-exclude' "$quarto_page"
if grep -Fq 'data-spa-exclude' "$plain_page"; then
  printf '%s\n' 'A plain Quartz page claims the SPA exclusion marker.' >&2
  exit 1
fi
if ! grep -rlFq 'querySelector("[data-spa-exclude]")' generated/fixture-site/static/scripts >/dev/null 2>&1; then
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
