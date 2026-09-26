#!/bin/sh
# Checks the built site from the outside, after `npm run build`.
#
# Prep already refuses to leak during the build; this re-checks the output tree
# itself, because Quarto copies listing contents and page resources on its own
# and that is only visible in what it wrote.
set -eu
cd "$(dirname "$0")/.."

site="generated/site"
fail() { echo "$1" >&2; exit 1; }
test -d "$site" || fail "no site; run npm run build"

# 1. Privacy. The allowlist never names a private source, and nothing private,
#    no template and no raw source file reaches the rendered tree. (`! cmd`
#    does not trip `set -e`, so each of these fails explicitly.)
if grep -qE '_hidden|\.hidden\.|^\s+- "templates/' vault/_quarto-publish.yml; then
  fail "the render allowlist names a private source"
fi
leaked=$(find "$site" \( -path '*_hidden*' -o -name '*.hidden.*' -o -name 'tpl-*' -o -name '*.qmd' -o -name '*.md' \) -print)
test -z "$leaked" || fail "private or raw source in the site: $leaked"

# 2. Interactive components fail silently -- a blank figure on a green build --
#    so a page with Observable cells must ship the runtime.
if grep -rlq 'ojs-cell' "$site" --include='*.html'; then
  test -f "$site/site_libs/quarto-ojs/quarto-ojs-runtime.js"
fi

# Quarto nests a MathJax 2 loader inside Plotly output, which breaks the page's
# maths (AUTHORING.md, "Plotly and maths do not coexist").
if grep -rlq 'cdn.plot.ly' "$site" --include='*.html'; then
  fail "a published page uses Plotly; see AUTHORING.md before publishing it"
fi

# 3. The tokens reach both compiled Bootstrap bundles. Quarto compiles one per
#    mode, so a token missing from one is a mode that silently falls back.
test "$(ls "$site"/site_libs/bootstrap/bootstrap*.min.css | wc -l)" -ge 2
for bundle in "$site"/site_libs/bootstrap/bootstrap*.min.css; do
  grep -Fq -- '--qmd-syntax-keyword' "$bundle"
  grep -Fq -- '--qmd-chart-series-1' "$bundle"
done

# No hand-written stylesheet may carry a literal colour; that is how a second
# palette gets in, and `design-tokens --check` only compares generated files.
for sheet in vault/_theme/*.scss; do
  case "$sheet" in */site-light.scss|*/site-dark.scss) continue ;; esac
  if grep -q '#[0-9a-fA-F]\{3,8\}' "$sheet"; then
    fail "hand-written colour in $sheet; put it in tokens.yaml"
  fi
done

echo "site: ok"
