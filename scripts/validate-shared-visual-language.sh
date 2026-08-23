#!/bin/sh
set -eu

# Phase 11. The claim under test is that one set of design tokens reaches both
# renderers, and that the Quarto half of the site derives its colours from
# Quartz's theme variables rather than carrying its own.
#
# Run after `npm run build`.

quarto_page="site/public/research/convergence-diagnostics.html"
plain_page="site/public/concepts/probability.html"

test -f "$quarto_page"
test -f "$plain_page"

# --- One source of truth ----------------------------------------------------
# Every generated projection must still match design/tokens.yaml. A colour
# changed in quartz.config.yaml alone, or an .mplstyle edited by hand, fails
# here rather than drifting quietly.
npm run --silent design-tokens -- --check

# --- Tokens reach the page --------------------------------------------------
token_css=$(grep -l -- '--qmd-syntax-keyword' site/public/component-*.css)
test -n "$token_css"
grep -Fq "$(basename "$token_css")" "$quarto_page"

# Both themes are defined, or the toggle has nothing to switch to. (The
# minifier drops the attribute-value quotes the source writes.)
grep -Eq ':root\[saved-theme="?dark"?\]' "$token_css"

# --- Quarto styling stays scoped --------------------------------------------
# Section 24: the Quarto frame may not restyle the Quartz shell around it.
# Everything except the custom-property definitions themselves must sit under
# .quarto-page.
selectors() {
  grep -o '[^{}]*{' "$token_css" | grep -v 'quarto-page' | grep -v '^:root' | grep -v '^@'
}
if selectors | grep -q .; then
  printf '%s\n' 'A Quarto rule escaped the .quarto-page scope:' >&2
  selectors >&2
  exit 1
fi

# --- Code reads the same on both sides of the boundary ----------------------
# Quartz highlights Markdown code with shiki; pandoc emits bare token classes.
# Colouring those classes from the shared tokens is what makes a Python cell in
# a .qmd look like a fenced block in a .md.
grep -Fq 'span.kw' "$token_css"
grep -Fq 'var(--qmd-syntax-keyword)' "$token_css"
# `im` is pandoc's import token; the page's first cell is an import.
grep -Fq 'class="im"' "$quarto_page"
grep -Fq 'span.im' "$token_css"

# --- No literal colours in the Quarto stylesheet ----------------------------
# Anything that is not a var() cannot follow the theme toggle. The --qmd-* and
# :root definitions are the values themselves and are exempt.
if grep -oq '[a-z-]*: *#[0-9a-fA-F]\{3,8\}' site/bridge/styles/quartoPage.scss 2>/dev/null; then
  printf '%s\n' 'quartoPage.scss names a colour instead of a theme variable.' >&2
  exit 1
fi

# --- The runtime pass for output CSS cannot reach ---------------------------
# Plotly writes its surface colours into the figure JSON, so the bridge rewrites
# them from the same theme variables on load and on every theme change.
theme_script=$(grep -rl 'js-plotly-plot' site/public/static/scripts/)
test -n "$theme_script"
grep -Fq 'themechange' "$theme_script"
grep -Fq 'paper_bgcolor' "$theme_script"
grep -Fq "$(basename "$theme_script" | sed 's/\.js$//')" site/public/postscript-*.js

# --- Figures carry no baked-in white ----------------------------------------
# Plotly's default template paints white paper and a #E5ECF6 plot area into the
# payload; the shared Plotly template in vault/_theme replaces both.
for page in site/public/research/convergence-diagnostics.html; do
  if grep -Fq '"paper_bgcolor":"white"' "$page" ||
    grep -Fq '"plot_bgcolor":"#E5ECF6"' "$page" ||
    grep -Fq '"gridcolor":"white"' "$page"; then
    printf '%s\n' "Plotly default surfaces survived into $page." >&2
    exit 1
  fi
done

# --- The plain Quartz pages are untouched -----------------------------------
if grep -Fq 'quarto-content' "$plain_page"; then
  printf '%s\n' 'A plain Quartz page picked up Quarto content markup.' >&2
  exit 1
fi

printf '%s\n' 'Shared visual language: tokens current, Quarto styling scoped and derived.'
