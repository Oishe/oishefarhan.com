#!/bin/sh
set -eu

# Interactive client-side components are a hard requirement for this system, and
# they are the reason section 12 chose HTML-fragment extraction over an iframe.
# Each technology stresses a different part of the boundary:
#
#   Plotly      -- a plain <script> loader plus an inline initialiser
#   Observable  -- an ES module runtime driven by custom <script type="ojs-*"> tags
#   ipywidgets  -- an AMD widget manager that resolves third-party bundles at runtime
#
# htmlwidgets is deliberately absent: it is an R framework with no Python path.
# Shiny is absent because it requires a running server.

interactive_page="site/public/examples/interactive-features.html"
plotly_page="site/public/examples/computational-features.html"

# --- Observable JS ----------------------------------------------------------
test -f "$interactive_page"
test -f "site/public/examples/interactive-features_files/libs/quarto-ojs/quarto-ojs-runtime.js"

grep -Fq 'type="ojs-module-contents"' "$interactive_page"   # the cell source
grep -Fq 'type="ojs-define"' "$interactive_page"            # the Python -> OJS data handoff
grep -Fq 'quarto-ojs-runtime.js' "$interactive_page"
grep -Fq 'quarto-ojs.css' "$interactive_page"
grep -Fq '"series"' "$interactive_page"                     # ojs_define payload survived

# --- Jupyter Widgets --------------------------------------------------------
test -f "$interactive_page"

grep -Fq 'application/vnd.jupyter.widget-state+json' "$interactive_page"
grep -Fq 'application/vnd.jupyter.widget-view+json' "$interactive_page"
grep -Fq 'embed-amd.js' "$interactive_page"

# The widget manager is an AMD consumer: embed-amd.js throws "define is not
# defined" without a loader, so RequireJS must survive extraction on this page
# even though it is stripped from pages that merely carry Plotly.
if ! grep -Fq 'requirejs' "$interactive_page"; then
  printf '%s\n' 'RequireJS was stripped from a page whose widget manager requires it.' >&2
  exit 1
fi
if grep -Fq 'requirejs' "$plotly_page"; then
  printf '%s\n' 'RequireJS survived on a Plotly-only page, where it breaks Quartz library loading.' >&2
  exit 1
fi

# --- Quartz's own libraries must win the race -------------------------------
# d3 and PIXI are UMD. If an AMD loader is installed first, d3's anonymous
# define() is swallowed, window.d3 is never set, Quartz's graph dies, and the
# failed define can poison the require context badly enough that third-party
# widget bundles stop resolving. Preloading them as classic scripts ahead of the
# Quarto resources is what keeps both sides working.
for page in "$interactive_page" "$plotly_page"; do
  d3_at=$(grep -bo 'd3@7/dist/d3.min.js' "$page" | head -1 | cut -d: -f1)
  if [ -z "$d3_at" ]; then
    printf '%s\n' "Quartz's d3 preload is missing from $page" >&2
    exit 1
  fi
  loader_at=$(grep -bo 'requirejs@\|quarto-ojs-runtime.js\|cdn.plot.ly' "$page" | head -1 | cut -d: -f1)
  if [ -n "$loader_at" ] && [ "$d3_at" -gt "$loader_at" ]; then
    printf '%s\n' "d3 preload appears after the fragment's module loader in $page" >&2
    exit 1
  fi
done

# --- Both pages remain first-class Quartz pages -----------------------------
for page in "$interactive_page" "$plotly_page"; do
  grep -Fq 'id="quartz-root"' "$page"
  grep -Fq 'class="explorer nav-files-container"' "$page"
  grep -Fq 'class="quarto-content"' "$page"
done

grep -Fq '"examples/interactive-features"' site/public/static/contentIndex.json
grep -Fq '"examples/computational-features"' site/public/static/contentIndex.json

printf '%s\n' 'Interactive component validation passed.'
