#!/bin/sh
# One set of design tokens paints the whole site.
#
# vault/_theme/tokens.yaml is the only place a colour, font, or chart value is
# written down. `npm run design-tokens -- --check` proves the generated files
# are reproducible from it; this checks the other half -- that the generated
# files are what the built page and the Python plots actually use, and that
# nothing hand-written has smuggled in a second palette.
#
# The claim used to be "one palette reaches *both* renderers", and most of this
# file was reconciling them. There is one renderer now, so what is left is the
# part that was always the point.
set -eu
cd "$(dirname "$0")/.."

page="generated/fixture-site/examples/computational-features.html"
test -f "$page" || { echo "no fixture site; run npm run fixtures" >&2; exit 1; }

# 1. The generated stylesheets are current. This is the whole drift argument in
#    one command: if tokens.yaml moved and nobody regenerated, fail here rather
#    than shipping two palettes.
npm run design-tokens --silent -- --check >/dev/null

# 2. The compiled Bootstrap bundle carries the tokens, in both modes. Quarto
#    compiles one bundle per mode and switches them by toggling `rel`, so a
#    token missing from one bundle is a mode that silently falls back.
for bundle in generated/fixture-site/site_libs/bootstrap/bootstrap*.min.css; do
  grep -Fq -- '--qmd-syntax-keyword' "$bundle"
  grep -Fq -- '--qmd-chart-series-1' "$bundle"
done
test "$(ls generated/fixture-site/site_libs/bootstrap/bootstrap*.min.css | wc -l)" -ge 2

# 3. Both mode stylesheets are generated from the same source and say so, and
#    each paints exactly one mode. A dark-mode selector inside the light sheet
#    would mean the two bundles disagree about which one is in charge.
for mode in light dark; do
  sheet="vault/_theme/site-$mode.scss"
  grep -Fq 'Generated from vault/_theme/tokens.yaml' "$sheet"
  grep -Fq "color-scheme: $mode;" "$sheet"
  ! grep -q "prefers-color-scheme" "$sheet"
done

# 3b. The top bar is painted from the palette in both modes. Left unset it keeps
#     Bootswatch's own $gray-100 in both bundles, so the bar stays light on a
#     dark page -- and because Quarto hardcodes data-bs-theme="dark" on the
#     <nav> and one HTML serves both stylesheets, the foreground has to be
#     explicit too or the light bundle gets light text on a light bar.
for mode in light dark; do
  sheet="vault/_theme/site-$mode.scss"
  for var in navbar-bg navbar-fg navbar-hl; do
    grep -q "^\$$var: #[0-9a-fA-F]\{6\};$" "$sheet"
  done
  # The bar shares the page ground, so it needs an edge rather than a fill.
  grep -q 'border-bottom: 1px solid #' "$sheet"
done
# The bar and the page must be the same colour, or "shares the page ground" is
# just a claim.
for mode in light dark; do
  sheet="vault/_theme/site-$mode.scss"
  body=$(sed -n 's/^\$body-bg: \(#[0-9a-fA-F]*\);$/\1/p' "$sheet")
  navbar=$(sed -n 's/^\$navbar-bg: \(#[0-9a-fA-F]*\);$/\1/p' "$sheet")
  test "$body" = "$navbar"
done

# 4. The Python plotting style derives from the same tokens rather than a second
#    hand-kept copy, and paints no background of its own -- the page supplies it,
#    so a figure follows the mode instead of pinning one.
grep -Fq 'Generated from vault/_theme/tokens.yaml' vault/_theme/knowledge_theme/knowledge.mplstyle
grep -Fq 'Generated from vault/_theme/tokens.yaml' vault/_theme/knowledge_theme/tokens.json
grep -q '^figure.facecolor: *none' vault/_theme/knowledge_theme/knowledge.mplstyle
grep -q '^axes.facecolor: *none' vault/_theme/knowledge_theme/knowledge.mplstyle

# 5. No hand-written stylesheet may carry a literal colour. Every .scss in the
#    theme is generated; a hand-edited one is how a second palette gets in, and
#    it would survive --check because --check only compares generated files to
#    their source.
for sheet in vault/_theme/*.scss; do
  case "$sheet" in
    */site-light.scss|*/site-dark.scss) continue ;;
  esac
  if grep -oq '#[0-9a-fA-F]\{3,8\}' "$sheet"; then
    echo "hand-written colour in $sheet; put it in tokens.yaml" >&2
    exit 1
  fi
done

# 6. The reading measure is one number. It is set in the generated theme as a
#    Bootstrap grid variable, and a figure sized from the column width is sized
#    from the same value.
grep -q '^\$grid-body-width: [0-9]*px;$' vault/_theme/site-light.scss
light_measure=$(sed -n 's/^\$grid-body-width: \([0-9]*\)px;$/\1/p' vault/_theme/site-light.scss)
dark_measure=$(sed -n 's/^\$grid-body-width: \([0-9]*\)px;$/\1/p' vault/_theme/site-dark.scss)
test "$light_measure" = "$dark_measure"

echo "shared visual language: ok (measure ${light_measure}px)"
