#!/bin/sh
set -eu

spike_root="experiments/qmd-obsidian-vault"
analysis_html="$spike_root/_site/research/analysis.html"
comparison_html="$spike_root/_site/research/comparison.html"

test -f "$analysis_html"
test -f "$comparison_html"
test ! -e "$spike_root/_site/note-a.html"
test ! -e "$spike_root/_site/note-b.html"

grep -Fq '<pre><code>4.25</code></pre>' "$analysis_html"
grep -Fq '<pre><code>7</code></pre>' "$comparison_html"

# Literal source wikilinks are expected until Experiment 6 adds the adapter.
grep -Fq '[[note-a|Note A]]' "$analysis_html"
grep -Fq '[[comparison|Comparison]]' "$analysis_html"
grep -Fq '[[analysis|Analysis]]' "$comparison_html"
grep -Fq '[[note-b|Note B]]' "$comparison_html"

printf '%s\n' 'QMD/Obsidian rendered-output validation passed.'
