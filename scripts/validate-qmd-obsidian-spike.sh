#!/bin/sh
set -eu

spike_root="experiments/qmd-obsidian-vault"

test -f "$spike_root/note-a.md"
test -f "$spike_root/note-b.md"
test -f "$spike_root/research/analysis.qmd"
test -f "$spike_root/research/comparison.qmd"
test -f "$spike_root/_quarto.yml"
test -f "$spike_root/.obsidian/app.json"

grep -Fq '[[note-b|Note B]]' "$spike_root/note-a.md"
grep -Fq '[[research/analysis|Analysis]]' "$spike_root/note-a.md"
grep -Fq '[[note-a|Note A]]' "$spike_root/research/analysis.qmd"
grep -Fq '[[comparison|Comparison]]' "$spike_root/research/analysis.qmd"
grep -Fq '[[analysis|Analysis]]' "$spike_root/research/comparison.qmd"
grep -Fq '[[note-b|Note B]]' "$spike_root/research/comparison.qmd"

grep -Fq '"showUnsupportedFiles": true' "$spike_root/.obsidian/app.json"
grep -Fq '"alwaysUpdateLinks": true' "$spike_root/.obsidian/app.json"
grep -Fq '"qmd-as-md-obsidian"' "$spike_root/.obsidian/community-plugins.json"
grep -Fq 'research/**/*.qmd' "$spike_root/_quarto.yml"

printf '%s\n' 'QMD/Obsidian spike source validation passed.'
