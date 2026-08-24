#!/bin/sh
set -eu

source_qmd="vault/examples/computational-features.qmd"
stub_md="generated/quartz-content/examples/computational-features.md"
content_index="site/public/static/contentIndex.json"

test -f "$source_qmd"
test -f "$stub_md"
test -f "$content_index"

grep -Fq 'quartoStub: true' "$stub_md"
grep -Fq 'sourcePath: "vault/examples/computational-features.qmd"' "$stub_md"
grep -Fq '## Python output' "$stub_md"
grep -Fq '## Static Matplotlib figure' "$stub_md"
grep -Fq '[[Markdown Features]]' "$stub_md"
grep -Fq '[[Interactive Features]]' "$stub_md"

if grep -Fq 'import pandas' "$stub_md" || grep -Fq 'sample_sizes = ' "$stub_md"; then
  printf '%s\n' 'Executable code leaked into the generated stub.' >&2
  exit 1
fi

grep -Fq '"examples/computational-features"' "$content_index"
grep -Fq 'Python output' "$content_index"
grep -Fq 'Static Matplotlib figure' "$content_index"
grep -Fq '../examples/computational-features' site/public/examples/index.html

printf '%s\n' 'QMD stub and Quartz index/backlink validation passed.'
