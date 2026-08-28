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

interactive_page="generated/fixture-site/examples/interactive-features.html"
plotly_page="generated/fixture-site/examples/computational-features.html"

# --- Observable JS ----------------------------------------------------------
test -f "$interactive_page"
test -f "generated/fixture-site/examples/interactive-features_files/libs/quarto-ojs/quarto-ojs-runtime.js"

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

# Plotly nests a MathJax 2 loader in its cell output so LaTeX in chart labels
# renders. It claims window.MathJax, which aborts the MathJax 3 runtime this
# site loads for prose maths and leaves the page typeset by a third renderer in
# markup no stylesheet here targets. It must not survive extraction.
for page in "$interactive_page" "$plotly_page"; do
  if grep -Eq 'mathjax/2\.[0-9]' "$page"; then
    printf '%s\n' "Plotly's MathJax 2 loader survived extraction in $page; it breaks MathJax 3." >&2
    exit 1
  fi
done

# Prose maths is MathJax on both sides -- rehype-mathjax at build time for .md,
# the pinned SVG runtime here for .qmd -- so KaTeX must be gone from the page
# chrome. The Observable runtime bundles its own KaTeX for maths written inside
# reactive cells; that is out of reach by construction and is not what this
# checks, hence the CDN-reference match rather than a bare 'katex'.
for page in "$interactive_page" "$plotly_page"; do
  if grep -Fq 'cdn.jsdelivr.net/npm/katex' "$page"; then
    printf '%s\n' "A KaTeX CDN reference survived in $page; maths should be MathJax on both sides." >&2
    exit 1
  fi
done
grep -Fq 'mathjax@3.2.2/es5/tex-svg-full.js' "$plotly_page"

# The d3/PIXI preload race is gone with the graph: site/quartz.ts records why
# those preloads existed and what re-enabling the graph would require. What is
# worth asserting now is the opposite -- that nothing is paying for them.
for page in "$interactive_page" "$plotly_page"; do
  if grep -Fq 'd3@7/dist/d3.min.js' "$page" || grep -Fq 'pixi.js@8' "$page"; then
    printf '%s\n' "A d3/PIXI preload is still shipping on $page; nothing on the site consumes either." >&2
    exit 1
  fi
done

# --- Both pages remain first-class Quartz pages -----------------------------
for page in "$interactive_page" "$plotly_page"; do
  grep -Fq 'id="quartz-root"' "$page"
  grep -Fq 'data-frame="default"' "$page"
  grep -Fq 'class="page-header"' "$page"
  grep -Fq 'class="site-nav"' "$page"
  grep -Fq 'class="quarto-content"' "$page"
done

grep -Fq '"examples/interactive-features"' generated/fixture-site/static/contentIndex.json
grep -Fq '"examples/computational-features"' generated/fixture-site/static/contentIndex.json

printf '%s\n' 'Interactive component validation passed.'
