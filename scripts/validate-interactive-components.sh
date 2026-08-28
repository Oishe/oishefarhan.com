#!/bin/sh
# Interactive client-side components are a hard requirement for this system.
#
# The old version of this check existed because Quarto output was extracted as
# an HTML fragment and re-hosted inside a Quartz page, which broke script
# loading in ways that only showed up in a browser. That architecture is gone:
# Quarto owns the page, so these libraries load the way Quarto intends. What is
# left is worth keeping anyway -- a Quarto or kernel upgrade can still drop a
# dependency, and the failure is silent (a blank figure, a dead widget) with a
# completely green build.
set -eu
cd "$(dirname "$0")/.."

interactive="generated/fixture-site/examples/interactive-features.html"
computational="generated/fixture-site/examples/computational-features.html"
test -f "$interactive" && test -f "$computational"

# Observable JS: the runtime ships, and cells actually reached the page. A
# website project shares one copy in site_libs/ rather than emitting a per-page
# libs/ directory, so the runtime is checked at the shared path.
test -f "generated/fixture-site/site_libs/quarto-ojs/quarto-ojs-runtime.js"
grep -Fq 'quarto-ojs-runtime' "$interactive"
grep -Fq 'ojs-cell' "$interactive"

# Jupyter widgets are AMD modules: without RequireJS and the widget manager the
# state blob is inert and the page renders an empty div.
grep -Fq 'requirejs' "$interactive"
grep -Fq '@jupyter-widgets/html-manager' "$interactive"
grep -Fq 'application/vnd.jupyter.widget-state+json' "$interactive"
grep -Fq 'application/vnd.jupyter.widget-view+json' "$interactive"

# Python -> Observable handoff.
grep -Fq 'ojs_define' "$interactive" || grep -Fq 'ojs-define' "$interactive"

# Plotly renders into a div the bundle finds by id.
grep -Fq 'plotly-graph-div' "$computational"
grep -Fq 'cdn.plot.ly' "$computational"

# Maths. Both fixtures carry equations, and the runtime is pinned in
# _quarto.yml so a CDN cannot change under the site.
grep -Fq 'mathjax@3.2.2' "$computational"

# KNOWN DEFECT, tracked in REDESIGN.md gotcha 4. Quarto nests a MathJax 2.7.5
# loader inside Plotly's cell output; it claims window.MathJax and MathJax 3
# aborts with "Cannot read properties of undefined (reading 'loader')". Under
# KaTeX it double-renders instead. This asserts the defect is still confined to
# the one fixture that uses Plotly -- if a real article ever grows a Plotly
# figure, this check is the thing that should stop the build.
plotly_sources=$(grep -rl 'import plotly\|plotly.express' vault --include='*.qmd' | grep -v _freeze || true)
if [ "$plotly_sources" != "vault/examples/computational-features.qmd" ]; then
  echo "Plotly is used outside the fixture:" >&2
  echo "$plotly_sources" >&2
  echo "A page with both Plotly and maths renders maths twice or not at all." >&2
  echo "See REDESIGN.md gotcha 4 before publishing it." >&2
  exit 1
fi

echo "interactive components: ok"
