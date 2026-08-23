#!/bin/sh
set -eu

source_qmd="vault/research/monte-carlo.qmd"
stub_md="generated/quartz-content/research/monte-carlo.md"
content_index="site/public/static/contentIndex.json"

test -f "$source_qmd"
test -f "$stub_md"
test -f "$content_index"

grep -Fq 'quartoStub: true' "$stub_md"
grep -Fq 'sourcePath: "vault/research/monte-carlo.qmd"' "$stub_md"
grep -Fq '## Sampling' "$stub_md"
grep -Fq '## Convergence' "$stub_md"
grep -Fq '[[Probability]]' "$stub_md"
grep -Fq '[[Statistics]]' "$stub_md"

if grep -Fq 'estimate = ' "$stub_md" || grep -Fq 'sample_sizes = ' "$stub_md"; then
  printf '%s\n' 'Executable code leaked into the generated stub.' >&2
  exit 1
fi

grep -Fq '"research/monte-carlo"' "$content_index"
grep -Fq 'Sampling' "$content_index"
grep -Fq 'Convergence' "$content_index"
grep -Fq 'Monte Carlo Simulation' site/public/concepts/probability.html
grep -Fq 'Monte Carlo Simulation' site/public/concepts/statistics.html

printf '%s\n' 'QMD stub and Quartz index/backlink validation passed.'
