#!/bin/sh
set -eu

experiment_root="experiments/quarto-frozen-prose-loop"
rendered_html="$experiment_root/_site/frozen-loop.html"

test -f "$rendered_html"
test -d "$experiment_root/_freeze"

grep -Fq 'EXECUTION_STAMP=' "$rendered_html"
grep -Fq 'Prose revision: changed without rerunning cached code.' "$rendered_html"
grep -Fq 'analytic' "$rendered_html"
grep -Fq 'simulation' "$rendered_html"
grep -Fq 'A deterministic convergence curve.' "$rendered_html"
grep -Fq 'plotly' "$rendered_html"
grep -Fq 'sample mean' "$rendered_html"
test -f "$experiment_root/_site/frozen-loop_files/figure-html/static-figure-output-1.png"
test -f "$experiment_root/_site/frozen-loop_files/libs/quarto-html/quarto.js"

printf '%s\n' 'Frozen prose rendered-output validation passed.'
